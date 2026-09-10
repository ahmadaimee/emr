import { recordActivity } from '@grove/audit';
import { assertCan } from '@grove/auth';
import { and, eq, schema, sql } from '@grove/db';
import { DomainError, NotFoundError, type CommandContext } from '../context';
import { emit } from '../outbox';
import { postLedger } from '../ledger/post';

export interface CreateClaimInput {
  encounterId: string;
  /** Defaults to the patient's active primary coverage. */
  coverageId?: string;
}

/**
 * Create a claim from an encounter. Charges post to the ledger here — a charge is a
 * financial event the moment it is billed, whether or not the claim ever goes out.
 */
export async function createClaimCommand(ctx: CommandContext, input: CreateClaimInput): Promise<{ claimId: string; claimNumber: string }> {
  const [encounter] = await ctx.tx.select().from(schema.encounters).where(eq(schema.encounters.id, input.encounterId));
  if (!encounter) throw new NotFoundError('encounter', input.encounterId);
  if (ctx.actor) assertCan(ctx.actor, 'claim:create', { practiceId: encounter.practiceId });

  const lines = await ctx.tx.select().from(schema.serviceLines).where(and(eq(schema.serviceLines.encounterId, encounter.id), sql`voided_at is null`));
  if (lines.length === 0) throw new DomainError('Encounter has no service lines', 'no_service_lines');

  const coverage = input.coverageId
    ? (await ctx.tx.select().from(schema.coverages).where(eq(schema.coverages.id, input.coverageId)))[0]
    : (await ctx.tx.select().from(schema.coverages).where(and(eq(schema.coverages.patientId, encounter.patientId), eq(schema.coverages.rank, 'primary'), eq(schema.coverages.active, true))))[0];
  if (!coverage) throw new DomainError('Patient has no active primary coverage', 'no_coverage');

  const plan = coverage.planId ? (await ctx.tx.select().from(schema.payerPlans).where(eq(schema.payerPlans.id, coverage.planId)))[0] : undefined;

  const [seq] = await ctx.tx.execute<{ n: string }>(sql`select nextval('claim_number_seq')::text as n`);
  const claimNumber = `GRV-${seq!.n}`;
  const totalChargeCents = lines.reduce((s, l) => s + l.chargeCents, 0);

  const deadline = plan?.timelyFilingDays ? addDays(encounter.serviceDate, plan.timelyFilingDays) : null;

  const [claim] = await ctx.tx
    .insert(schema.claims)
    .values({
      orgId: ctx.tenant.orgId,
      practiceId: encounter.practiceId,
      patientId: encounter.patientId,
      encounterId: encounter.id,
      coverageId: coverage.id,
      payerId: coverage.payerId,
      claimNumber,
      type: 'professional',
      status: 'draft',
      frequency: 'original',
      coverageRank: coverage.rank,
      totalChargeCents,
      balanceCents: totalChargeCents,
      serviceDateFrom: encounter.serviceDate,
      serviceDateThrough: encounter.serviceDateThrough ?? null,
      timelyFilingDeadline: deadline,
      createdByAutomation: ctx.actor ? null : 'claim.create',
    })
    .returning({ id: schema.claims.id });
  const claimId = claim!.id;

  // Charges hit the ledger once per service line, on the FIRST claim for the encounter.
  const alreadyCharged = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.ledgerEntries)
    .where(and(eq(schema.ledgerEntries.encounterId, encounter.id), eq(schema.ledgerEntries.entryType, 'charge')));
  if (Number(alreadyCharged[0]?.n ?? 0) === 0) {
    await postLedger(
      ctx,
      lines.map((l) => ({
        practiceId: encounter.practiceId,
        patientId: encounter.patientId,
        encounterId: encounter.id,
        claimId,
        serviceLineId: l.id,
        entryType: 'charge' as const,
        amountCents: l.chargeCents,
        responsibility: 'insurance' as const,
        payerId: coverage.payerId,
        postingDate: ctx.now().toISOString().slice(0, 10),
        serviceDate: l.serviceDate,
        sourceType: 'service_line',
        sourceId: l.id,
      })),
    );
  }

  await ctx.tx.update(schema.encounters).set({ status: 'billed', updatedAt: ctx.now() }).where(eq(schema.encounters.id, encounter.id));
  await emit(ctx, 'claim.created', 'claim', claimId, { claimNumber, encounterId: encounter.id, totalChargeCents });
  await recordActivity(ctx.tx, {
    orgId: ctx.tenant.orgId, practiceId: encounter.practiceId, subjectType: 'claim', subjectId: claimId,
    verb: 'claim.created', summary: `created claim ${claimNumber} for ${lines.length} service line${lines.length === 1 ? '' : 's'}`,
    detail: { totalChargeCents }, actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });
  return { claimId, claimNumber };
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
