'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { eq, schema } from '@grove/db';
import { pageContext } from '@/lib/session';

export async function resolveTask(taskId: string, resolutionCode: string = 'manual_fix', resolutionNote?: string) {
  const { run, session } = await pageContext();
  await run('/queues', async (ctx) => {
    await ctx.tx
      .update(schema.tasks)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: session.actor.userId,
        resolutionCode,
        resolutionNote: resolutionNote ?? 'Resolved from work queue',
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, taskId));

    await ctx.tx.insert(schema.taskEvents).values({
      orgId: ctx.tenant.orgId,
      taskId,
      eventType: 'resolved',
      actorUserId: session.actor.userId,
      detail: { resolutionCode, resolutionNote },
    });

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'update',
      resourceType: 'task',
      resourceId: taskId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { action: 'resolve', resolutionCode },
    });
  });

  revalidatePath('/queues');
  revalidatePath('/dashboard');
}

export async function snoozeTask(taskId: string, days: number = 3) {
  const { run, session } = await pageContext();
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await run('/queues', async (ctx) => {
    await ctx.tx
      .update(schema.tasks)
      .set({
        status: 'snoozed',
        snoozedUntil: until,
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, taskId));

    await ctx.tx.insert(schema.taskEvents).values({
      orgId: ctx.tenant.orgId,
      taskId,
      eventType: 'snoozed',
      actorUserId: session.actor.userId,
      detail: { snoozedUntil: until.toISOString(), days },
    });
  });

  revalidatePath('/queues');
  revalidatePath('/dashboard');
}

