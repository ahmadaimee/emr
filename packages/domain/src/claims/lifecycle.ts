import { eq, schema } from '@grove/db';
import { DomainError, type CommandContext } from '../context';

export type ClaimStatus = (typeof schema.claimStatus.enumValues)[number];

/**
 * Allowed transitions. Anything not listed is a bug or an attack, and throws.
 * `voided` is reachable from almost anywhere because a void is a correction of
 * record, not a workflow step.
 */
const TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  draft: ['scrubbing', 'voided'],
  scrubbing: ['needs_review', 'ready', 'voided'],
  needs_review: ['scrubbing', 'ready', 'voided'],
  ready: ['queued', 'scrubbing', 'needs_review', 'voided'],
  queued: ['submitted', 'ready', 'voided'],
  submitted: ['acknowledged', 'rejected', 'in_process', 'paid', 'partially_paid', 'denied', 'voided'],
  acknowledged: ['in_process', 'rejected', 'paid', 'partially_paid', 'denied', 'voided'],
  rejected: ['scrubbing', 'needs_review', 'ready', 'voided', 'closed'],
  in_process: ['paid', 'partially_paid', 'denied', 'rejected', 'voided'],
  paid: ['secondary_ready', 'patient_responsibility', 'closed', 'appealed', 'voided'],
  partially_paid: ['secondary_ready', 'patient_responsibility', 'appealed', 'closed', 'paid', 'voided'],
  denied: ['appealed', 'needs_review', 'closed', 'voided', 'patient_responsibility'],
  appealed: ['paid', 'partially_paid', 'denied', 'closed', 'voided'],
  secondary_ready: ['secondary_submitted', 'patient_responsibility', 'closed', 'voided'],
  secondary_submitted: ['patient_responsibility', 'closed', 'paid', 'voided'],
  patient_responsibility: ['closed', 'voided'],
  closed: ['voided'],
  voided: [],
};

export async function transitionClaim(
  ctx: CommandContext,
  claimId: string,
  to: ClaimStatus,
  trigger: 'user' | 'system' | 'era' | 'ack' | 'status_check',
  reason?: string,
): Promise<{ from: ClaimStatus; to: ClaimStatus }> {
  const [claim] = await ctx.tx.select({ status: schema.claims.status }).from(schema.claims).where(eq(schema.claims.id, claimId));
  if (!claim) throw new DomainError('claim not found', 'not_found', 404);
  const from = claim.status;
  if (from === to) return { from, to };
  if (!TRANSITIONS[from].includes(to)) {
    throw new DomainError(`Claim cannot move from ${from} to ${to}`, 'invalid_transition', 409, { from, to });
  }

  const now = ctx.now();
  const stamps: Partial<typeof schema.claims.$inferInsert> = { status: to, updatedAt: now };
  if (to === 'submitted') stamps.submittedAt = now;
  if (to === 'acknowledged') stamps.acknowledgedAt = now;
  if (to === 'closed' || to === 'voided') stamps.closedAt = now;

  await ctx.tx.update(schema.claims).set(stamps).where(eq(schema.claims.id, claimId));
  await ctx.tx.insert(schema.claimStateTransitions).values({
    orgId: ctx.tenant.orgId,
    claimId,
    fromStatus: from,
    toStatus: to,
    trigger,
    reason: reason ?? null,
    actorUserId: ctx.actor?.userId ?? null,
  });
  return { from, to };
}
