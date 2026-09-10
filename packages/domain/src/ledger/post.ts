import { and, eq, schema, sql } from '@grove/db';
import type { CommandContext } from '../context';

type LedgerEntryType = (typeof schema.ledgerEntryType.enumValues)[number];
type Responsibility = (typeof schema.responsibilityParty.enumValues)[number];

export interface LedgerPost {
  practiceId: string;
  patientId: string;
  encounterId?: string | null;
  claimId?: string | null;
  serviceLineId?: string | null;
  entryType: LedgerEntryType;
  /** Signed cents: debits positive, credits negative. */
  amountCents: number;
  responsibility: Responsibility;
  payerId?: string | null;
  postingDate: string;
  serviceDate: string;
  sourceType: string;
  sourceId: string;
  paymentBatchId?: string | null;
  note?: string;
}

/**
 * Append ledger entries and refresh the derived balances they touch. The ledger is the
 * source of truth; the balance columns on service lines, claims and the snapshot table
 * are caches recomputed here from `sum(amount_cents)`, never adjusted incrementally.
 */
export async function postLedger(ctx: CommandContext, entries: LedgerPost[]): Promise<string[]> {
  if (entries.length === 0) return [];
  const inserted = await ctx.tx
    .insert(schema.ledgerEntries)
    .values(
      entries.map((e) => ({
        orgId: ctx.tenant.orgId,
        practiceId: e.practiceId,
        patientId: e.patientId,
        encounterId: e.encounterId ?? null,
        claimId: e.claimId ?? null,
        serviceLineId: e.serviceLineId ?? null,
        entryType: e.entryType,
        amountCents: e.amountCents,
        responsibility: e.responsibility,
        payerId: e.payerId ?? null,
        postingDate: e.postingDate,
        serviceDate: e.serviceDate,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        paymentBatchId: e.paymentBatchId ?? null,
        note: e.note ?? null,
        createdBy: ctx.actor?.userId ?? null,
      })),
    )
    .returning({ id: schema.ledgerEntries.id });

  const lineIds = new Set(entries.map((e) => e.serviceLineId).filter((v): v is string => Boolean(v)));
  const claimIds = new Set(entries.map((e) => e.claimId).filter((v): v is string => Boolean(v)));
  const patientIds = new Set(entries.map((e) => e.patientId));

  for (const id of lineIds) await refreshServiceLineBalance(ctx, id);
  for (const id of claimIds) await refreshClaimBalance(ctx, id);
  for (const id of patientIds) await refreshSnapshot(ctx, 'patient', id);

  return inserted.map((r) => r.id);
}

async function sums(ctx: CommandContext, where: ReturnType<typeof and>) {
  const rows = await ctx.tx
    .select({
      charged: sql<number>`coalesce(sum(case when entry_type = 'charge' then amount_cents else 0 end), 0)::bigint`,
      paid: sql<number>`coalesce(-sum(case when entry_type in ('payment_insurance','payment_patient') then amount_cents else 0 end), 0)::bigint`,
      adjusted: sql<number>`coalesce(-sum(case when entry_type in ('contractual_adjustment','write_off','bad_debt') then amount_cents else 0 end), 0)::bigint`,
      insurance: sql<number>`coalesce(sum(case when responsibility = 'insurance' then amount_cents else 0 end), 0)::bigint`,
      patient: sql<number>`coalesce(sum(case when responsibility = 'patient' then amount_cents else 0 end), 0)::bigint`,
    })
    .from(schema.ledgerEntries)
    .where(where);
  const r = rows[0]!;
  return { charged: Number(r.charged), paid: Number(r.paid), adjusted: Number(r.adjusted), insurance: Number(r.insurance), patient: Number(r.patient) };
}

async function refreshServiceLineBalance(ctx: CommandContext, serviceLineId: string) {
  const s = await sums(ctx, and(eq(schema.ledgerEntries.orgId, ctx.tenant.orgId), eq(schema.ledgerEntries.serviceLineId, serviceLineId)));
  await ctx.tx
    .update(schema.serviceLines)
    .set({
      paidCents: s.paid,
      adjustmentCents: s.adjusted,
      patientResponsibilityCents: s.patient,
      balanceCents: s.insurance + s.patient,
      updatedAt: ctx.now(),
    })
    .where(eq(schema.serviceLines.id, serviceLineId));
}

async function refreshClaimBalance(ctx: CommandContext, claimId: string) {
  const s = await sums(ctx, and(eq(schema.ledgerEntries.orgId, ctx.tenant.orgId), eq(schema.ledgerEntries.claimId, claimId)));
  await ctx.tx
    .update(schema.claims)
    .set({
      totalPaidCents: s.paid,
      totalAdjustmentCents: s.adjusted,
      patientResponsibilityCents: s.patient,
      balanceCents: s.insurance + s.patient,
      updatedAt: ctx.now(),
    })
    .where(eq(schema.claims.id, claimId));
  await refreshSnapshot(ctx, 'claim', claimId);
}

async function refreshSnapshot(ctx: CommandContext, subjectType: 'claim' | 'patient', subjectId: string) {
  const column = subjectType === 'claim' ? schema.ledgerEntries.claimId : schema.ledgerEntries.patientId;
  const s = await sums(ctx, and(eq(schema.ledgerEntries.orgId, ctx.tenant.orgId), eq(column, subjectId)));
  await ctx.tx
    .insert(schema.balanceSnapshots)
    .values({
      orgId: ctx.tenant.orgId,
      subjectType,
      subjectId,
      insuranceBalanceCents: s.insurance,
      patientBalanceCents: s.patient,
      totalChargedCents: s.charged,
      totalPaidCents: s.paid,
      totalAdjustedCents: s.adjusted,
      lastEntryAt: ctx.now(),
    })
    .onConflictDoUpdate({
      target: [schema.balanceSnapshots.subjectType, schema.balanceSnapshots.subjectId],
      set: {
        insuranceBalanceCents: s.insurance,
        patientBalanceCents: s.patient,
        totalChargedCents: s.charged,
        totalPaidCents: s.paid,
        totalAdjustedCents: s.adjusted,
        lastEntryAt: ctx.now(),
      },
    });
}
