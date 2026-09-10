import { and, eq, schema } from '@grove/db';
import type { CommandContext } from '../context';
import { emit } from '../outbox';

export interface CreateTaskInput {
  queueKey: string;
  practiceId?: string | null;
  subjectType: string;
  subjectId: string;
  patientId?: string | null;
  title: string;
  detail?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  suggestedAction?: string;
  suggestedActionPayload?: Record<string, unknown>;
  dueAt?: Date | null;
  /** Stable key so the automation never files the same task twice. */
  dedupeKey: string;
}

/**
 * File work for a human. Idempotent on `dedupeKey`: re-running a job that already
 * created its task is a no-op, which is what lets every automation be retried freely.
 */
export async function createTask(ctx: CommandContext, t: CreateTaskInput): Promise<{ id: string; created: boolean }> {
  const [existing] = await ctx.tx.select({ id: schema.tasks.id }).from(schema.tasks).where(and(eq(schema.tasks.orgId, ctx.tenant.orgId), eq(schema.tasks.dedupeKey, t.dedupeKey)));
  if (existing) return { id: existing.id, created: false };

  const [queue] = await ctx.tx.select({ id: schema.workQueues.id, sla: schema.workQueues.slaHours }).from(schema.workQueues).where(and(eq(schema.workQueues.orgId, ctx.tenant.orgId), eq(schema.workQueues.key, t.queueKey)));
  if (!queue) throw new Error(`Work queue "${t.queueKey}" does not exist for this organisation`);

  const dueAt = t.dueAt ?? (queue.sla ? new Date(ctx.now().getTime() + queue.sla * 3_600_000) : null);
  const [task] = await ctx.tx
    .insert(schema.tasks)
    .values({
      orgId: ctx.tenant.orgId,
      practiceId: t.practiceId ?? null,
      workQueueId: queue.id,
      subjectType: t.subjectType,
      subjectId: t.subjectId,
      patientId: t.patientId ?? null,
      title: t.title,
      detail: t.detail ?? null,
      priority: t.priority ?? 'normal',
      suggestedAction: t.suggestedAction ?? null,
      suggestedActionPayload: t.suggestedActionPayload ?? null,
      dueAt,
      dedupeKey: t.dedupeKey,
      createdByAutomation: ctx.actor ? null : ctx.tenant.requestId,
    })
    .returning({ id: schema.tasks.id });

  await ctx.tx.insert(schema.taskEvents).values({ orgId: ctx.tenant.orgId, taskId: task!.id, eventType: 'created', actorUserId: ctx.actor?.userId ?? null, detail: { queue: t.queueKey } });
  await emit(ctx, 'task.created', 'task', task!.id, { queue: t.queueKey, subjectType: t.subjectType, subjectId: t.subjectId, title: t.title });
  return { id: task!.id, created: true };
}
