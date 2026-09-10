import { recordActivity } from '@grove/audit';
import { and, eq, schema, sql } from '@grove/db';
import { transitionClaim } from '../claims/lifecycle';
import { scrubClaimCommand } from '../claims/scrub';
import { submitClaimCommand } from '../claims/submit';
import { DomainError, NotFoundError, type CommandContext } from '../context';
import { emit } from '../outbox';
import { createTask } from '../tasks/create';
import { addDays } from '../claims/create';

export interface GenerateSecondaryInput {
  primaryClaimId: string;
  remittanceClaimId: string;
  secondaryCoverageId: string;
}

export interface GenerateSecondaryResult {
  secondaryClaimId: string;
  claimNumber: string;
  action: 'submitted' | 'queued_for_review' | 'skipped';
  reason?: string;
}

/**
 * Build the secondary claim from the primary's adjudication and either submit it or
 * queue it for review, per the organisation's automation settings.
 *
 * This is the step every incumbent makes a person do by hand from a paper EOB.
 */
export async function generateSecondaryClaimCommand(ctx: CommandContext, input: GenerateSecondaryInput): Promise<GenerateSecondaryResult> {
  const orgId = ctx.tenant.orgId;
  const [primary] = await ctx.tx.select().from(schema.claims).where(eq(schema.claims.id, input.primaryClaimId));
  if (!primary) throw new NotFoundError('claim', input.primaryClaimId);
  const [secondaryCoverage] = await ctx.tx.select().from(schema.coverages).where(eq(schema.coverages.id, input.secondaryCoverageId));
  if (!secondaryCoverage || !secondaryCoverage.active) throw new DomainError('Secondary coverage is not active', 'no_secondary_coverage');
  const [payer] = await ctx.tx.select().from(schema.payers).where(eq(schema.payers.id, secondaryCoverage.payerId));
  if (!payer) throw new NotFoundError('payer', secondaryCoverage.payerId);

  // Idempotent: one secondary per (primary, remittance claim).
  const [already] = await ctx.tx.select({ id: schema.claims.id, claimNumber: schema.claims.claimNumber }).from(schema.claims).where(and(eq(schema.claims.primaryRemittanceClaimId, input.remittanceClaimId), eq(schema.claims.coverageRank, 'secondary')));
  if (already) return { secondaryClaimId: already.id, claimNumber: already.claimNumber, action: 'skipped', reason: 'already generated' };

  const [settings] = await ctx.tx.select().from(schema.automationSettings).where(and(eq(schema.automationSettings.orgId, orgId), sql`practice_id is null or practice_id = ${primary.practiceId}`)).orderBy(sql`practice_id nulls last`).limit(1);
  const remaining = primary.balanceCents;
  if (remaining < (settings?.secondaryMinBalanceCents ?? 500)) {
    return { secondaryClaimId: '', claimNumber: '', action: 'skipped', reason: `remaining balance ${remaining} below threshold` };
  }

  const plan = secondaryCoverage.planId ? (await ctx.tx.select().from(schema.payerPlans).where(eq(schema.payerPlans.id, secondaryCoverage.planId)))[0] : undefined;
  const [seq] = await ctx.tx.execute<{ n: string }>(sql`select nextval('claim_number_seq')::text as n`);
  const claimNumber = `GRV-${seq!.n}`;
  const today = ctx.now().toISOString().slice(0, 10);

  const [secondary] = await ctx.tx
    .insert(schema.claims)
    .values({
      orgId, practiceId: primary.practiceId, patientId: primary.patientId, encounterId: primary.encounterId,
      coverageId: secondaryCoverage.id, payerId: payer.id, claimNumber, type: primary.type, status: 'draft', frequency: 'original',
      coverageRank: 'secondary', originalClaimId: null, primaryRemittanceClaimId: input.remittanceClaimId,
      totalChargeCents: primary.totalChargeCents, balanceCents: remaining,
      serviceDateFrom: primary.serviceDateFrom, serviceDateThrough: primary.serviceDateThrough,
      // Secondary timely filing runs from the primary remittance, not the date of service.
      timelyFilingDeadline: plan?.timelyFilingSecondaryDays ? addDays(today, plan.timelyFilingSecondaryDays) : null,
      createdByAutomation: 'cob.generate_secondary',
    })
    .returning({ id: schema.claims.id });
  const secondaryClaimId = secondary!.id;

  await transitionClaim(ctx, primary.id, 'secondary_submitted', 'system', `secondary ${claimNumber} generated`).catch(() => undefined);
  await recordActivity(ctx.tx, {
    orgId, practiceId: primary.practiceId, subjectType: 'claim', subjectId: primary.id, verb: 'claim.secondary_generated',
    summary: `generated secondary claim ${claimNumber} to ${payer.name} for the remaining ${(remaining / 100).toFixed(2)}`,
    detail: { secondaryClaimId }, actorType: 'system',
  });

  const scrub = await scrubClaimCommand(ctx, secondaryClaimId);

  const paperOnly = !payer.supportsSecondaryElectronic;
  const canAutoSubmit = Boolean(settings?.autoSubmitSecondary) && !settings?.dryRun && !settings?.globalPaused && scrub.errorCount === 0 && !paperOnly;

  if (canAutoSubmit) {
    await submitClaimCommand(ctx, secondaryClaimId, { acknowledgeWarnings: true });
    return { secondaryClaimId, claimNumber, action: 'submitted' };
  }

  await createTask(ctx, {
    queueKey: 'secondary-review', practiceId: primary.practiceId, subjectType: 'claim', subjectId: secondaryClaimId, patientId: primary.patientId,
    title: `Review secondary claim ${claimNumber} to ${payer.name}${paperOnly ? ' (paper only)' : ''}${scrub.errorCount ? ` — ${scrub.errorCount} scrub errors` : ''}`,
    detail: { primaryClaimId: primary.id, remainingCents: remaining, paperOnly, scrub },
    priority: scrub.errorCount ? 'high' : 'normal', suggestedAction: paperOnly ? 'print_cms1500' : 'submit', dedupeKey: `secondary-review:${secondaryClaimId}`,
  });
  await emit(ctx, 'claim.created', 'claim', secondaryClaimId, { claimNumber, coverageRank: 'secondary', primaryClaimId: primary.id });
  return { secondaryClaimId, claimNumber, action: 'queued_for_review', reason: paperOnly ? 'payer does not accept electronic secondary claims' : settings?.dryRun ? 'automation in dry-run' : scrub.errorCount ? 'scrub errors' : 'auto-submit disabled' };
}
