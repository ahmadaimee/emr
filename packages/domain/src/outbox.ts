import { schema } from '@grove/db';
import type { CommandContext } from './context';

/**
 * Domain event names. Each is also a webhook event type customers can subscribe to,
 * so this list is API surface — additive changes only.
 */
export type DomainEventType =
  | 'patient.created' | 'patient.updated' | 'patient.merged'
  | 'coverage.created' | 'coverage.updated'
  | 'eligibility.completed' | 'eligibility.changed' | 'eligibility.batch.completed'
  | 'claim.created' | 'claim.scrubbed' | 'claim.ready' | 'claim.submitted' | 'claim.acknowledged'
  | 'claim.rejected' | 'claim.status_updated' | 'claim.paid' | 'claim.denied'
  | 'claim.secondary_ready' | 'claim.crossover_expected' | 'claim.timely_filing_at_risk' | 'claim.custom_status_changed'
  | 'remittance.received' | 'remittance.posted' | 'remittance.out_of_balance'
  | 'denial.created' | 'denial.resolved'
  | 'underpayment.detected'
  | 'authorization.requested' | 'authorization.decided'
  | 'payment.received' | 'statement.generated' | 'statement.sent'
  | 'task.created';

/**
 * Write a domain event in the SAME transaction as the change that caused it. The relay
 * hands it to pg-boss after commit. If the transaction rolls back, so does the event —
 * there is no window in which a job exists for a change that did not happen.
 */
export async function emit(
  ctx: CommandContext,
  type: DomainEventType,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<void> {
  await ctx.tx.insert(schema.outboxEvents).values({
    orgId: ctx.tenant.orgId,
    eventType: type,
    aggregateType,
    aggregateId,
    payload: { ...payload, orgId: ctx.tenant.orgId, requestId: ctx.tenant.requestId },
    idempotencyKey: idempotencyKey ?? `${type}:${aggregateId}:${ctx.tenant.requestId}:${crypto.randomUUID()}`,
  });
}
