import { recordActivity } from '@grove/audit';
import { and, eq, isNull, or, schema, sql } from '@grove/db';
import { DomainError, NotFoundError, type CommandContext } from '../context';
import { emit } from '../outbox';

/**
 * Org-configurable claim status labels — "On Hold", "Credentialing", "Needs Coding
 * Review" — layered on top of the fixed `claimStatus` enum rather than replacing it.
 *
 * `claimStatus` is the state machine real automation reads and writes: it is what
 * decides whether a claim auto-submits, what a ready-claim sweep selects, what an
 * inbound 999/277CA/835 transitions. A custom status carries none of that — it is a
 * label a person puts on a claim and removes, and setting one never touches
 * `claims.status`. That split is deliberate: an admin can invent a new label without a
 * migration, but cannot accidentally wire a label to a real action by naming it well.
 */

export interface CustomStatusInput {
  label: string;
  color?: string;
  practiceId?: string | null;
}

export async function createCustomStatusCommand(ctx: CommandContext, input: CustomStatusInput) {
  const label = input.label.trim();
  if (!label) throw new DomainError('A status label is required', 'label_required', 422);
  if (label.length > 40) throw new DomainError('Status labels are capped at 40 characters', 'label_too_long', 422);

  const [existing] = await ctx.tx
    .select({ id: schema.claimCustomStatuses.id })
    .from(schema.claimCustomStatuses)
    .where(
      and(
        eq(schema.claimCustomStatuses.orgId, ctx.tenant.orgId),
        input.practiceId ? eq(schema.claimCustomStatuses.practiceId, input.practiceId) : isNull(schema.claimCustomStatuses.practiceId),
        sql`lower(${schema.claimCustomStatuses.label}) = lower(${label})`,
      ),
    );
  if (existing) throw new DomainError(`A status called "${label}" already exists`, 'status_exists', 409);

  const [max] = await ctx.tx
    .select({ n: sql<number>`coalesce(max(sort_order), -1)::int` })
    .from(schema.claimCustomStatuses)
    .where(eq(schema.claimCustomStatuses.orgId, ctx.tenant.orgId));

  const [row] = await ctx.tx
    .insert(schema.claimCustomStatuses)
    .values({
      orgId: ctx.tenant.orgId,
      practiceId: input.practiceId ?? null,
      label,
      color: input.color ?? 'slate',
      sortOrder: (max?.n ?? -1) + 1,
      createdBy: ctx.actor?.userId ?? null,
    })
    .returning({ id: schema.claimCustomStatuses.id });

  await recordActivity(ctx.tx, {
    orgId: ctx.tenant.orgId, practiceId: input.practiceId ?? null, subjectType: 'claim_custom_status', subjectId: row!.id,
    verb: 'claim_custom_status.created', summary: `created claim status "${label}"`,
    actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });

  return { id: row!.id, label };
}

export async function retireCustomStatusCommand(ctx: CommandContext, statusId: string) {
  const [row] = await ctx.tx.select().from(schema.claimCustomStatuses).where(and(eq(schema.claimCustomStatuses.id, statusId), eq(schema.claimCustomStatuses.orgId, ctx.tenant.orgId)));
  if (!row) throw new NotFoundError('claim_custom_status', statusId);

  await ctx.tx.update(schema.claimCustomStatuses).set({ active: false, updatedAt: ctx.now() }).where(eq(schema.claimCustomStatuses.id, statusId));
  // A retired status stops appearing as a choice; claims already wearing it keep it
  // until someone changes it — retiring is not the same as un-tagging every claim.
  await recordActivity(ctx.tx, {
    orgId: ctx.tenant.orgId, practiceId: row.practiceId, subjectType: 'claim_custom_status', subjectId: statusId,
    verb: 'claim_custom_status.retired', summary: `retired claim status "${row.label}"`,
    actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });
}

export async function setClaimCustomStatusCommand(ctx: CommandContext, claimId: string, statusId: string | null) {
  const [claim] = await ctx.tx.select({ id: schema.claims.id, practiceId: schema.claims.practiceId, claimNumber: schema.claims.claimNumber }).from(schema.claims).where(and(eq(schema.claims.id, claimId), eq(schema.claims.orgId, ctx.tenant.orgId)));
  if (!claim) throw new NotFoundError('claim', claimId);

  let label: string | null = null;
  if (statusId) {
    const [status] = await ctx.tx
      .select()
      .from(schema.claimCustomStatuses)
      .where(and(eq(schema.claimCustomStatuses.id, statusId), eq(schema.claimCustomStatuses.orgId, ctx.tenant.orgId), eq(schema.claimCustomStatuses.active, true), or(isNull(schema.claimCustomStatuses.practiceId), eq(schema.claimCustomStatuses.practiceId, claim.practiceId))));
    if (!status) throw new NotFoundError('claim_custom_status', statusId);
    label = status.label;
  }

  await ctx.tx.update(schema.claims).set({ customStatusId: statusId, updatedAt: ctx.now() }).where(eq(schema.claims.id, claimId));
  await emit(ctx, 'claim.custom_status_changed', 'claim', claimId, { claimNumber: claim.claimNumber, statusId, label });
  await recordActivity(ctx.tx, {
    orgId: ctx.tenant.orgId, practiceId: claim.practiceId, subjectType: 'claim', subjectId: claimId,
    verb: 'claim.custom_status_changed', summary: label ? `tagged ${claim.claimNumber} "${label}"` : `cleared the status tag on ${claim.claimNumber}`,
    actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });
}
