import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { assertCan } from '@grove/auth';
import { and, desc, eq, schema, sql } from '@grove/db';

const uuid = z.string().uuid();

export async function taskRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/v1/tasks', {
    schema: {
      tags: ['Work queues'], summary: 'Open work, by queue',
      querystring: z.object({ queue: z.string().optional(), status: z.enum(['open', 'in_progress', 'waiting', 'snoozed', 'resolved', 'cancelled']).default('open'), assigned_to: uuid.optional(), limit: z.coerce.number().int().min(1).max(200).default(100) }),
      response: { 200: z.object({ data: z.array(z.object({ id: uuid, queue: z.string(), title: z.string(), priority: z.string(), status: z.string(), subject_type: z.string(), subject_id: uuid, patient_id: uuid.nullable(), suggested_action: z.string().nullable(), due_at: z.string().nullable(), created_at: z.string() })) }) },
    },
  }, async (req) => {
    const rows = await req.command(async (ctx) => {
      assertCan(req.actor, 'task:read');
      const list = await ctx.tx
        .select({ t: schema.tasks, queue: schema.workQueues.key })
        .from(schema.tasks)
        .innerJoin(schema.workQueues, eq(schema.workQueues.id, schema.tasks.workQueueId))
        .where(and(eq(schema.tasks.status, req.query.status), req.query.queue ? eq(schema.workQueues.key, req.query.queue) : undefined, req.query.assigned_to ? eq(schema.tasks.assignedTo, req.query.assigned_to) : undefined))
        .orderBy(sql`case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end`, schema.tasks.dueAt, desc(schema.tasks.createdAt))
        .limit(req.query.limit);
      req.phi.touch(list.map((x) => x.t.patientId).filter((p): p is string => Boolean(p)), ['financial'], list.length);
      return list;
    });
    return { data: rows.map(({ t, queue }) => ({ id: t.id, queue, title: t.title, priority: t.priority, status: t.status, subject_type: t.subjectType, subject_id: t.subjectId, patient_id: t.patientId, suggested_action: t.suggestedAction, due_at: t.dueAt?.toISOString() ?? null, created_at: t.createdAt.toISOString() })) };
  });

  r.post('/v1/tasks/:id/resolve', {
    schema: { tags: ['Work queues'], summary: 'Resolve a task', params: z.object({ id: uuid }), body: z.object({ resolution_code: z.string().max(50), note: z.string().max(2000).optional() }), response: { 200: z.object({ id: uuid, status: z.string() }) } },
  }, async (req) => {
    return req.command(async (ctx) => {
      const [t] = await ctx.tx.select().from(schema.tasks).where(eq(schema.tasks.id, req.params.id));
      if (!t) throw Object.assign(new Error('not found'), { statusCode: 404 });
      assertCan(req.actor, 'task:resolve', { practiceId: t.practiceId });
      await ctx.tx.update(schema.tasks).set({ status: 'resolved', resolvedAt: ctx.now(), resolvedBy: req.actor.userId, resolutionCode: req.body.resolution_code, resolutionNote: req.body.note ?? null, updatedAt: ctx.now() }).where(eq(schema.tasks.id, t.id));
      await ctx.tx.insert(schema.taskEvents).values({ orgId: ctx.tenant.orgId, taskId: t.id, eventType: 'resolved', actorUserId: req.actor.userId, detail: { resolutionCode: req.body.resolution_code } });
      return { id: t.id, status: 'resolved' };
    });
  });
}
