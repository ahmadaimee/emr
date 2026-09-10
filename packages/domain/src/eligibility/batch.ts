import { recordActivity } from '@grove/audit';
import { assertCan } from '@grove/auth';
import { and, eq, inArray, schema, sql } from '@grove/db';
import { DomainError, NotFoundError, type CommandContext } from '../context';
import { emit } from '../outbox';

export type BatchSource =
  | { type: 'schedule_day'; practiceId: string; date: string }
  | { type: 'patient_list'; practiceId: string; patientIds: string[] }
  | { type: 'panel'; practiceId: string; verifiedBefore?: string }
  | { type: 'saved_view'; practiceId: string; savedViewId: string };

export interface CreateBatchInput {
  name: string;
  source: BatchSource;
  serviceDate?: string;
  serviceTypeCodes?: string[];
}

export interface CreateBatchResult {
  batchId: string;
  coverageIds: string[];
  totalCount: number;
}

/**
 * Resolve a member list and create the batch. The caller enqueues one job per
 * coverage; results roll up through `recordBatchOutcome`. Progress streams to the UI
 * from the counters on the batch row.
 */
export async function createEligibilityBatchCommand(ctx: CommandContext, input: CreateBatchInput): Promise<CreateBatchResult> {
  const orgId = ctx.tenant.orgId;
  if (ctx.actor) assertCan(ctx.actor, 'eligibility:run_batch', { practiceId: input.source.practiceId });

  const coverageIds = await resolveCoverages(ctx, input.source);
  if (coverageIds.length === 0) throw new DomainError('No active coverages match the batch source', 'empty_batch');
  if (coverageIds.length > 5000) throw new DomainError('Batches are limited to 5,000 members; narrow the source', 'batch_too_large');

  const [batch] = await ctx.tx
    .insert(schema.eligibilityBatches)
    .values({
      orgId, practiceId: input.source.practiceId, name: input.name, status: 'queued',
      sourceType: input.source.type, sourceParams: input.source,
      serviceDate: input.serviceDate ?? ctx.now().toISOString().slice(0, 10), serviceTypeCodes: input.serviceTypeCodes ?? ['30', '98'],
      totalCount: coverageIds.length, createdBy: ctx.actor?.userId ?? null,
    })
    .returning({ id: schema.eligibilityBatches.id });

  await recordActivity(ctx.tx, {
    orgId, practiceId: input.source.practiceId, subjectType: 'eligibility_batch', subjectId: batch!.id, verb: 'eligibility.batch_completed',
    summary: `started eligibility batch "${input.name}" for ${coverageIds.length} members`, actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });
  return { batchId: batch!.id, coverageIds, totalCount: coverageIds.length };
}

async function resolveCoverages(ctx: CommandContext, source: BatchSource): Promise<string[]> {
  const active = and(eq(schema.coverages.orgId, ctx.tenant.orgId), eq(schema.coverages.active, true));
  switch (source.type) {
    case 'patient_list': {
      if (source.patientIds.length === 0) return [];
      const rows = await ctx.tx.select({ id: schema.coverages.id }).from(schema.coverages).where(and(active, inArray(schema.coverages.patientId, source.patientIds)));
      return rows.map((r) => r.id);
    }
    case 'panel': {
      const rows = await ctx.tx
        .select({ id: schema.coverages.id })
        .from(schema.coverages)
        .innerJoin(schema.patients, eq(schema.patients.id, schema.coverages.patientId))
        .where(and(active, eq(schema.patients.practiceId, source.practiceId), sql`${schema.patients.mergedIntoPatientId} is null`, source.verifiedBefore ? sql`(${schema.coverages.lastVerifiedAt} is null or ${schema.coverages.lastVerifiedAt} < ${source.verifiedBefore})` : sql`true`));
      return rows.map((r) => r.id);
    }
    case 'schedule_day': {
      // Scheduling lands in a later phase; until then a day's schedule is the set of
      // encounters dated that day, which is what pre-visit verification needs anyway.
      const rows = await ctx.tx
        .select({ id: schema.coverages.id })
        .from(schema.encounters)
        .innerJoin(schema.coverages, and(eq(schema.coverages.patientId, schema.encounters.patientId), eq(schema.coverages.active, true)))
        .where(and(eq(schema.encounters.practiceId, source.practiceId), eq(schema.encounters.serviceDate, source.date)));
      return [...new Set(rows.map((r) => r.id))];
    }
    case 'saved_view':
      throw new DomainError('Saved-view batches are resolved by the reporting layer', 'not_implemented', 501);
  }
}

/** Roll a single check's outcome into the batch counters; completes the batch on the last one. */
export async function recordBatchOutcome(ctx: CommandContext, batchId: string, outcome: { status: string; changed: boolean }): Promise<{ completed: boolean }> {
  const [b] = await ctx.tx.select().from(schema.eligibilityBatches).where(eq(schema.eligibilityBatches.id, batchId));
  if (!b) throw new NotFoundError('eligibility batch', batchId);

  const isActive = outcome.status === 'active';
  const isInactive = outcome.status === 'inactive' || outcome.status === 'not_found';
  const isError = !isActive && !isInactive;

  const [updated] = await ctx.tx
    .update(schema.eligibilityBatches)
    .set({
      status: 'running',
      completedCount: sql`${schema.eligibilityBatches.completedCount} + 1`,
      activeCount: sql`${schema.eligibilityBatches.activeCount} + ${isActive ? 1 : 0}`,
      inactiveCount: sql`${schema.eligibilityBatches.inactiveCount} + ${isInactive ? 1 : 0}`,
      errorCount: sql`${schema.eligibilityBatches.errorCount} + ${isError ? 1 : 0}`,
      changedCount: sql`${schema.eligibilityBatches.changedCount} + ${outcome.changed ? 1 : 0}`,
      startedAt: b.startedAt ?? ctx.now(),
      updatedAt: ctx.now(),
    })
    .where(eq(schema.eligibilityBatches.id, batchId))
    .returning({ completedCount: schema.eligibilityBatches.completedCount, totalCount: schema.eligibilityBatches.totalCount, errorCount: schema.eligibilityBatches.errorCount, inactiveCount: schema.eligibilityBatches.inactiveCount, changedCount: schema.eligibilityBatches.changedCount });

  const done = (updated?.completedCount ?? 0) >= (updated?.totalCount ?? Infinity);
  if (done) {
    await ctx.tx.update(schema.eligibilityBatches).set({ status: (updated?.errorCount ?? 0) > 0 ? 'completed_with_errors' : 'completed', completedAt: ctx.now() }).where(eq(schema.eligibilityBatches.id, batchId));
    await emit(ctx, 'eligibility.batch.completed', 'eligibility_batch', batchId, { name: b.name, total: updated?.totalCount, inactive: updated?.inactiveCount, errors: updated?.errorCount, changed: updated?.changedCount });
    await recordActivity(ctx.tx, {
      orgId: ctx.tenant.orgId, practiceId: b.practiceId, subjectType: 'eligibility_batch', subjectId: batchId, verb: 'eligibility.batch_completed',
      summary: `completed "${b.name}": ${updated?.totalCount} checked, ${updated?.inactiveCount} inactive, ${updated?.changedCount} changed, ${updated?.errorCount} errors`, actorType: 'system',
    });
  }
  return { completed: done };
}
