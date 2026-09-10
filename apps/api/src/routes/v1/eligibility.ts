import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { assertCan } from '@grove/auth';
import { desc, eq, schema } from '@grove/db';
import { createEligibilityBatchCommand, runEligibilityCheckCommand } from '@grove/domain';

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const BenefitSummary = z.object({
  active: z.boolean(),
  plan_description: z.string().optional(),
  copay_cents: z.number().int().optional(),
  coinsurance_bps: z.number().int().optional(),
  deductible_total_cents: z.number().int().optional(),
  deductible_remaining_cents: z.number().int().optional(),
  out_of_pocket_max_cents: z.number().int().optional(),
  out_of_pocket_remaining_cents: z.number().int().optional(),
  authorization_required: z.boolean().optional(),
  plan_begin: z.string().optional(),
  plan_end: z.string().optional(),
});

export async function eligibilityRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/v1/eligibility/checks', {
    schema: {
      tags: ['Eligibility'],
      summary: 'Run a real-time eligibility check (270/271) for a coverage',
      body: z.object({ coverage_id: uuid, service_date: isoDate.optional(), service_type_codes: z.array(z.string().max(3)).max(10).optional() }),
      response: {
        200: z.object({
          id: uuid, status: z.string(), summary: BenefitSummary.nullable(),
          changes: z.array(z.object({ field: z.string(), materiality: z.string(), label: z.string() })),
          rejection: z.object({ reason_code: z.string(), follow_up_action_code: z.string() }).optional(),
        }),
      },
    },
  }, async (req) => {
    const result = await req.command(async (ctx) => {
      const [cov] = await ctx.tx.select({ patientId: schema.coverages.patientId }).from(schema.coverages).where(eq(schema.coverages.id, req.body.coverage_id));
      const [pt] = cov ? await ctx.tx.select({ practiceId: schema.patients.practiceId }).from(schema.patients).where(eq(schema.patients.id, cov.patientId)) : [];
      assertCan(req.actor, 'eligibility:run', { practiceId: pt?.practiceId });
      if (cov) req.phi.touch([cov.patientId], ['demographics', 'financial']);
      return runEligibilityCheckCommand(ctx, { coverageId: req.body.coverage_id, trigger: 'api', serviceDate: req.body.service_date, serviceTypeCodes: req.body.service_type_codes });
    });
    return {
      id: result.checkId, status: result.status,
      summary: result.summary ? snakeSummary(result.summary) : null,
      changes: result.changes.map((c) => ({ field: c.field, materiality: c.materiality, label: c.label })),
      rejection: result.rejection ? { reason_code: result.rejection.reasonCode, follow_up_action_code: result.rejection.followUpActionCode } : undefined,
    };
  });

  r.post('/v1/eligibility/batches', {
    schema: {
      tags: ['Eligibility'],
      summary: 'Start a batch eligibility run over a schedule day, patient list, or the whole panel',
      body: z.object({
        name: z.string().min(1).max(200),
        practice_id: uuid,
        source: z.discriminatedUnion('type', [
          z.object({ type: z.literal('schedule_day'), date: isoDate }),
          z.object({ type: z.literal('patient_list'), patient_ids: z.array(uuid).min(1).max(5000) }),
          z.object({ type: z.literal('panel'), verified_before: isoDate.optional() }),
        ]),
        service_date: isoDate.optional(),
      }),
      response: { 202: z.object({ id: uuid, status: z.literal('queued'), total_count: z.number().int() }) },
    },
  }, async (req, reply) => {
    const s = req.body.source;
    const source = s.type === 'schedule_day' ? { type: 'schedule_day' as const, practiceId: req.body.practice_id, date: s.date }
      : s.type === 'patient_list' ? { type: 'patient_list' as const, practiceId: req.body.practice_id, patientIds: s.patient_ids }
      : { type: 'panel' as const, practiceId: req.body.practice_id, verifiedBefore: s.verified_before };
    const result = await req.command((ctx) => createEligibilityBatchCommand(ctx, { name: req.body.name, source, serviceDate: req.body.service_date }));
    // Fan-out is picked up by the worker via the outbox on the batch row's creation
    // event; here we enqueue directly through the outbox for the fanout queue.
    await req.command(async (ctx) => {
      await ctx.tx.insert(schema.outboxEvents).values({ orgId: ctx.tenant.orgId, eventType: 'eligibility.batch.created', aggregateType: 'eligibility_batch', aggregateId: result.batchId, payload: { batchId: result.batchId, coverageIds: result.coverageIds, serviceDate: req.body.service_date ?? null }, idempotencyKey: `batch:${result.batchId}` });
    });
    return reply.status(202).send({ id: result.batchId, status: 'queued', total_count: result.totalCount });
  });

  r.get('/v1/eligibility/batches/:id', {
    schema: {
      tags: ['Eligibility'],
      summary: 'Batch progress and result counts',
      params: z.object({ id: uuid }),
      response: { 200: z.object({ id: uuid, name: z.string(), status: z.string(), total_count: z.number(), completed_count: z.number(), active_count: z.number(), inactive_count: z.number(), error_count: z.number(), changed_count: z.number(), started_at: z.string().nullable(), completed_at: z.string().nullable() }) },
    },
  }, async (req) => {
    const b = await req.command(async (ctx) => {
      const [row] = await ctx.tx.select().from(schema.eligibilityBatches).where(eq(schema.eligibilityBatches.id, req.params.id));
      if (row) assertCan(req.actor, 'eligibility:read', { practiceId: row.practiceId });
      return row;
    });
    if (!b) throw Object.assign(new Error('not found'), { statusCode: 404 });
    return { id: b.id, name: b.name, status: b.status, total_count: b.totalCount, completed_count: b.completedCount, active_count: b.activeCount, inactive_count: b.inactiveCount, error_count: b.errorCount, changed_count: b.changedCount, started_at: b.startedAt?.toISOString() ?? null, completed_at: b.completedAt?.toISOString() ?? null };
  });

  r.get('/v1/eligibility/batches/:id/results', {
    schema: {
      tags: ['Eligibility'],
      summary: 'Per-member results for a batch, exceptions first',
      params: z.object({ id: uuid }),
      querystring: z.object({ limit: z.coerce.number().int().min(1).max(500).default(100), cursor: z.string().optional(), only: z.enum(['exceptions', 'all']).default('exceptions') }),
      response: { 200: z.object({ data: z.array(z.object({ check_id: uuid, patient_id: uuid, coverage_id: uuid.nullable(), status: z.string(), has_changes: z.boolean(), change_summary: z.array(z.object({ label: z.string(), materiality: z.string() })).nullable(), reject_reason_code: z.string().nullable(), summary: BenefitSummary.nullable() })), has_more: z.boolean(), next_cursor: z.string().nullable() }) },
    },
  }, async (req) => {
    const rows = await req.command(async (ctx) => {
      const [batch] = await ctx.tx.select({ practiceId: schema.eligibilityBatches.practiceId }).from(schema.eligibilityBatches).where(eq(schema.eligibilityBatches.id, req.params.id));
      assertCan(req.actor, 'eligibility:read', { practiceId: batch?.practiceId });
      const all = await ctx.tx.select().from(schema.eligibilityChecks).where(eq(schema.eligibilityChecks.batchId, req.params.id)).orderBy(desc(schema.eligibilityChecks.hasChanges), schema.eligibilityChecks.status, desc(schema.eligibilityChecks.createdAt));
      req.phi.touch(all.map((c) => c.patientId), ['demographics', 'financial'], all.length);
      return all;
    });
    const filtered = req.query.only === 'exceptions' ? rows.filter((c) => c.status !== 'active' || c.hasChanges) : rows;
    const start = req.query.cursor ? Number(Buffer.from(req.query.cursor, 'base64url').toString()) : 0;
    const page = filtered.slice(start, start + req.query.limit);
    const hasMore = start + req.query.limit < filtered.length;
    return {
      data: page.map((c) => ({ check_id: c.id, patient_id: c.patientId, coverage_id: c.coverageId, status: c.status, has_changes: c.hasChanges, change_summary: (c.changeSummary as Array<{ label: string; materiality: string }> | null)?.map((x) => ({ label: x.label, materiality: x.materiality })) ?? null, reject_reason_code: c.rejectReasonCode, summary: (c.parsed as { summary?: Parameters<typeof snakeSummary>[0] } | null)?.summary ? snakeSummary((c.parsed as { summary: Parameters<typeof snakeSummary>[0] }).summary) : null })),
      has_more: hasMore,
      next_cursor: hasMore ? Buffer.from(String(start + req.query.limit)).toString('base64url') : null,
    };
  });
}

function snakeSummary(s: { active: boolean; planDescription?: string; copayCents?: number; coinsuranceBps?: number; deductibleTotalCents?: number; deductibleRemainingCents?: number; outOfPocketMaxCents?: number; outOfPocketRemainingCents?: number; authorizationRequired?: boolean; planBegin?: string; planEnd?: string }) {
  return { active: s.active, plan_description: s.planDescription, copay_cents: s.copayCents, coinsurance_bps: s.coinsuranceBps, deductible_total_cents: s.deductibleTotalCents, deductible_remaining_cents: s.deductibleRemainingCents, out_of_pocket_max_cents: s.outOfPocketMaxCents, out_of_pocket_remaining_cents: s.outOfPocketRemainingCents, authorization_required: s.authorizationRequired, plan_begin: s.planBegin, plan_end: s.planEnd };
}
