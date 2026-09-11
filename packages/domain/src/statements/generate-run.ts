import { recordActivity } from '@grove/audit';
import { and, eq, schema, sql } from '@grove/db';
import { randomUUID } from 'node:crypto';
import { DomainError, type CommandContext } from '../context';
import { emit } from '../outbox';

export interface GenerateStatementRunInput {
  practiceId: string;
  minimumBalanceCents?: number;
  dueInDays?: number;
}

export interface GenerateStatementRunResult {
  statementRunId: string;
  statementCount: number;
  totalBalanceCents: number;
}

/**
 * One cycle of patient statements for a practice: every patient carrying a ledger
 * balance on the `patient` side above the minimum gets a statement, itemized from
 * their own ledger entries. Cycle number increments per patient so a patient who
 * already got a first notice gets a second-notice tone next time, not a duplicate
 * first notice — see `dunning_policies` for the schedule this is meant to follow.
 */
export async function generateStatementRunCommand(ctx: CommandContext, input: GenerateStatementRunInput): Promise<GenerateStatementRunResult> {
  const orgId = ctx.tenant.orgId;
  const minimumBalanceCents = input.minimumBalanceCents ?? 500;
  const dueInDays = input.dueInDays ?? 30;
  const today = ctx.now().toISOString().slice(0, 10);
  const dueDate = new Date(ctx.now().getTime() + dueInDays * 86_400_000).toISOString().slice(0, 10);

  const [run] = await ctx.tx
    .insert(schema.statementRuns)
    .values({ orgId, practiceId: input.practiceId, runDate: today, minimumBalanceCents, status: 'generating', createdBy: ctx.actor?.userId ?? null })
    .returning({ id: schema.statementRuns.id });
  const statementRunId = run!.id;

  // One row per patient with a positive patient-side balance today.
  const balances = await ctx.tx.execute<{ patient_id: string; balance_cents: string }>(sql`
    select patient_id, sum(amount_cents)::bigint as balance_cents
    from ledger_entries
    where org_id = ${orgId} and practice_id = ${input.practiceId} and responsibility = 'patient'
    group by patient_id
    having sum(amount_cents) >= ${minimumBalanceCents}
  `);

  let statementCount = 0;
  let totalBalanceCents = 0;

  for (const b of balances) {
    const patientId = b.patient_id;
    const balanceDueCents = Number(b.balance_cents);

    // Cycle number: how many statements this patient has already received, ever + 1.
    const [prior] = await ctx.tx.select({ n: sql<number>`count(*)::int` }).from(schema.patientStatements).where(and(eq(schema.patientStatements.orgId, orgId), eq(schema.patientStatements.patientId, patientId)));
    const cycleNumber = Number(prior?.n ?? 0) + 1;

    const lines = await ctx.tx
      .select({
        encounterId: schema.ledgerEntries.encounterId,
        serviceLineId: schema.ledgerEntries.serviceLineId,
        serviceDate: schema.ledgerEntries.serviceDate,
        entryType: schema.ledgerEntries.entryType,
        amountCents: schema.ledgerEntries.amountCents,
      })
      .from(schema.ledgerEntries)
      .where(and(eq(schema.ledgerEntries.orgId, orgId), eq(schema.ledgerEntries.patientId, patientId), eq(schema.ledgerEntries.responsibility, 'patient')))
      .orderBy(schema.ledgerEntries.serviceDate);

    const [seq] = await ctx.tx.execute<{ n: string }>(sql`select nextval('claim_number_seq')::text as n`);
    const statementNumber = `STMT-${today.replace(/-/g, '')}-${seq!.n}`;

    const [stmt] = await ctx.tx
      .insert(schema.patientStatements)
      .values({
        orgId, practiceId: input.practiceId, patientId, statementRunId,
        statementNumber, cycleNumber, statementDate: today, dueDate,
        newChargesCents: lines.filter((l) => l.amountCents > 0).reduce((s, l) => s + l.amountCents, 0),
        paymentsCents: lines.filter((l) => l.entryType === 'payment_patient').reduce((s, l) => s + l.amountCents, 0),
        adjustmentsCents: lines.filter((l) => l.amountCents < 0 && l.entryType !== 'payment_patient').reduce((s, l) => s + l.amountCents, 0),
        balanceDueCents,
        deliveryMethod: 'portal',
        status: 'draft',
      })
      .returning({ id: schema.patientStatements.id });
    const statementId = stmt!.id;

    let sortOrder = 0;
    for (const l of lines) {
      await ctx.tx.insert(schema.statementLines).values({
        orgId, statementId, encounterId: l.encounterId, serviceLineId: l.serviceLineId, serviceDate: l.serviceDate,
        description: describeLine(l.entryType), chargeCents: l.amountCents > 0 ? l.amountCents : 0,
        patientPaidCents: l.entryType === 'payment_patient' ? -l.amountCents : 0,
        adjustmentCents: l.amountCents < 0 && l.entryType !== 'payment_patient' ? l.amountCents : 0,
        balanceCents: l.amountCents, sortOrder: sortOrder++,
      });
    }

    statementCount++;
    totalBalanceCents += balanceDueCents;
  }

  await ctx.tx.update(schema.statementRuns).set({ status: 'review', statementCount, totalBalanceCents, updatedAt: ctx.now() }).where(eq(schema.statementRuns.id, statementRunId));

  await emit(ctx, 'statement.generated', 'statement_run', statementRunId, { practiceId: input.practiceId, statementCount, totalBalanceCents });
  await recordActivity(ctx.tx, {
    orgId, practiceId: input.practiceId, subjectType: 'statement', subjectId: statementRunId,
    verb: 'statement.generated', summary: `generated ${statementCount} patient statement${statementCount === 1 ? '' : 's'} totaling ${(totalBalanceCents / 100).toFixed(2)}`,
    actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });

  return { statementRunId, statementCount, totalBalanceCents };
}

function describeLine(entryType: string): string {
  switch (entryType) {
    case 'transfer_to_patient': return 'Patient responsibility (deductible/coinsurance/copay)';
    case 'payment_patient': return 'Payment received';
    case 'write_off': return 'Adjustment';
    case 'interest': return 'Late fee';
    default: return entryType.replace(/_/g, ' ');
  }
}

/** Mark a batch of statements sent, minting a pay-link token for each. */
export async function sendStatementsCommand(ctx: CommandContext, statementIds: string[]): Promise<{ sent: number }> {
  if (statementIds.length === 0) throw new DomainError('No statements selected', 'no_statements', 422);
  let sent = 0;
  for (const id of statementIds) {
    const [stmt] = await ctx.tx.select({ id: schema.patientStatements.id, status: schema.patientStatements.status, statementNumber: schema.patientStatements.statementNumber, practiceId: schema.patientStatements.practiceId, patientId: schema.patientStatements.patientId }).from(schema.patientStatements).where(eq(schema.patientStatements.id, id));
    if (!stmt || stmt.status !== 'draft') continue;
    const payLinkToken = randomUUID();
    await ctx.tx
      .update(schema.patientStatements)
      .set({ status: 'sent', sentAt: ctx.now(), payLinkToken, payLinkExpiresAt: new Date(ctx.now().getTime() + 45 * 86_400_000), updatedAt: ctx.now() })
      .where(eq(schema.patientStatements.id, id));
    await emit(ctx, 'statement.sent', 'statement', id, { statementNumber: stmt.statementNumber });
    await recordActivity(ctx.tx, {
      orgId: ctx.tenant.orgId, practiceId: stmt.practiceId, subjectType: 'statement', subjectId: id,
      verb: 'statement.sent', summary: `sent statement ${stmt.statementNumber}`,
      actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
    });
    sent++;
  }
  return { sent };
}
