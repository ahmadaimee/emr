import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { assertCan } from '@grove/auth';
import { and, desc, eq, schema, sql } from '@grove/db';
import { createClaimCommand, scrubClaimCommand, submitClaimCommand } from '@grove/domain';

const uuid = z.string().uuid();

const ClaimOut = z.object({
  id: uuid, claim_number: z.string(), status: z.string(), type: z.string(), frequency: z.string(), coverage_rank: z.string(),
  patient_id: uuid, encounter_id: uuid, payer_id: uuid, practice_id: uuid,
  total_charge_cents: z.number().int(), total_paid_cents: z.number().int(), total_adjustment_cents: z.number().int(), patient_responsibility_cents: z.number().int(), balance_cents: z.number().int(),
  service_date_from: z.string(), service_date_through: z.string().nullable(), timely_filing_deadline: z.string().nullable(),
  payer_claim_control_number: z.string().nullable(), submitted_at: z.string().nullable(), created_at: z.string(),
});

const Finding = z.object({ rule_key: z.string(), severity: z.string(), message: z.string(), path: z.string().optional(), line_number: z.number().optional() });

function toOut(c: typeof schema.claims.$inferSelect) {
  return {
    id: c.id, claim_number: c.claimNumber, status: c.status, type: c.type, frequency: c.frequency, coverage_rank: c.coverageRank,
    patient_id: c.patientId, encounter_id: c.encounterId, payer_id: c.payerId, practice_id: c.practiceId,
    total_charge_cents: c.totalChargeCents, total_paid_cents: c.totalPaidCents, total_adjustment_cents: c.totalAdjustmentCents, patient_responsibility_cents: c.patientResponsibilityCents, balance_cents: c.balanceCents,
    service_date_from: c.serviceDateFrom, service_date_through: c.serviceDateThrough, timely_filing_deadline: c.timelyFilingDeadline,
    payer_claim_control_number: c.payerClaimControlNumber, submitted_at: c.submittedAt?.toISOString() ?? null, created_at: c.createdAt.toISOString(),
  };
}

export async function claimRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/v1/claims', {
    schema: {
      tags: ['Claims'], summary: 'List claims (cursor-paginated, keyset on created_at)',
      querystring: z.object({ practice_id: uuid.optional(), status: z.string().optional(), patient_id: uuid.optional(), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().optional() }),
      response: { 200: z.object({ data: z.array(ClaimOut), has_more: z.boolean(), next_cursor: z.string().nullable() }) },
    },
  }, async (req) => {
    const q = req.query;
    const rows = await req.command(async (ctx) => {
      if (q.practice_id) assertCan(req.actor, 'claim:read', { practiceId: q.practice_id });
      const cursor = q.cursor ? decodeCursor(q.cursor) : null;
      const conds = [
        q.practice_id ? eq(schema.claims.practiceId, q.practice_id) : undefined,
        q.status ? eq(schema.claims.status, q.status as typeof schema.claims.$inferSelect.status) : undefined,
        q.patient_id ? eq(schema.claims.patientId, q.patient_id) : undefined,
        cursor ? sql`(created_at, id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : undefined,
        // Minimum necessary: only practices the actor can reach.
        req.actor.elevation?.practiceIds === '*' ? undefined : sql`practice_id = any(${[...req.actor.practiceIds, ...(Array.isArray(req.actor.elevation?.practiceIds) ? req.actor.elevation.practiceIds : [])]}::uuid[])`,
      ].filter(Boolean);
      const list = await ctx.tx.select().from(schema.claims).where(and(...(conds as Parameters<typeof and>))).orderBy(desc(schema.claims.createdAt), desc(schema.claims.id)).limit(q.limit + 1);
      req.phi.touch(list.map((c) => c.patientId), ['financial'], list.length);
      return list;
    });
    const hasMore = rows.length > q.limit;
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return { data: page.map(toOut), has_more: hasMore, next_cursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null };
  });

  r.get('/v1/claims/:id', {
    schema: { tags: ['Claims'], summary: 'Get a claim with its open scrub findings', params: z.object({ id: uuid }), response: { 200: ClaimOut.extend({ findings: z.array(Finding) }) } },
  }, async (req) => {
    return req.command(async (ctx) => {
      const [c] = await ctx.tx.select().from(schema.claims).where(eq(schema.claims.id, req.params.id));
      if (!c) throw Object.assign(new Error('not found'), { statusCode: 404 });
      assertCan(req.actor, 'claim:read', { practiceId: c.practiceId });
      req.phi.touch([c.patientId], ['financial']);
      const findings = await ctx.tx.select().from(schema.ruleFindings).where(and(eq(schema.ruleFindings.claimId, c.id), eq(schema.ruleFindings.status, 'open')));
      const lines = await ctx.tx.select({ id: schema.serviceLines.id, n: schema.serviceLines.lineNumber }).from(schema.serviceLines).where(eq(schema.serviceLines.encounterId, c.encounterId));
      return { ...toOut(c), findings: findings.map((f) => ({ rule_key: String((f.evidence as { ruleKey?: string } | null)?.ruleKey ?? ''), severity: f.severity, message: f.message, path: f.path ?? undefined, line_number: lines.find((l) => l.id === f.serviceLineId)?.n })) };
    });
  });

  r.post('/v1/claims', {
    schema: { tags: ['Claims'], summary: 'Create a claim from an encounter', body: z.object({ encounter_id: uuid, coverage_id: uuid.optional() }), response: { 201: z.object({ id: uuid, claim_number: z.string() }) } },
  }, async (req, reply) => {
    const r0 = await req.command((ctx) => createClaimCommand(ctx, { encounterId: req.body.encounter_id, coverageId: req.body.coverage_id }));
    return reply.status(201).send({ id: r0.claimId, claim_number: r0.claimNumber });
  });

  r.post('/v1/claims/:id/scrub', {
    schema: { tags: ['Claims'], summary: 'Run the rules engine and return explainable findings', params: z.object({ id: uuid }), response: { 200: z.object({ status: z.string(), error_count: z.number(), warning_count: z.number(), findings: z.array(Finding) }) } },
  }, async (req) => {
    const s = await req.command(async (ctx) => {
      const [c] = await ctx.tx.select({ practiceId: schema.claims.practiceId }).from(schema.claims).where(eq(schema.claims.id, req.params.id));
      assertCan(req.actor, 'claim:update', { practiceId: c?.practiceId });
      return scrubClaimCommand(ctx, req.params.id);
    });
    return { status: s.status, error_count: s.errorCount, warning_count: s.warningCount, findings: s.findings.map((f) => ({ rule_key: f.ruleKey, severity: f.severity, message: f.message, path: f.path, line_number: f.lineNumber })) };
  });

  r.post('/v1/claims/:id/submit', {
    schema: { tags: ['Claims'], summary: 'Scrub, snapshot, generate the 837P and transmit', params: z.object({ id: uuid }), body: z.object({ acknowledge_warnings: z.boolean().default(false) }).default({ acknowledge_warnings: false }), response: { 200: z.object({ claim_id: uuid, claim_number: z.string(), submission_id: uuid, connector_submission_id: z.string(), status: z.string() }) } },
  }, async (req) => {
    const s = await req.command((ctx) => submitClaimCommand(ctx, req.params.id, { acknowledgeWarnings: req.body.acknowledge_warnings }));
    return { claim_id: s.claimId, claim_number: s.claimNumber, submission_id: s.submissionId, connector_submission_id: s.connectorSubmissionId, status: s.status };
  });

  r.post('/v1/claims/batch/submit', {
    schema: {
      tags: ['Claims'], summary: 'Submit up to 100 claims; per-item results, never all-or-nothing',
      body: z.object({ claim_ids: z.array(uuid).min(1).max(100), acknowledge_warnings: z.boolean().default(false) }),
      response: { 200: z.object({ results: z.array(z.object({ claim_id: uuid, status: z.number(), claim_number: z.string().optional(), error: z.object({ type: z.string(), detail: z.string() }).optional() })), summary: z.object({ succeeded: z.number(), failed: z.number() }) }) },
    },
  }, async (req) => {
    const results: Array<{ claim_id: string; status: number; claim_number?: string; error?: { type: string; detail: string } }> = [];
    for (const id of req.body.claim_ids) {
      try {
        const s = await req.command((ctx) => submitClaimCommand(ctx, id, { acknowledgeWarnings: req.body.acknowledge_warnings }));
        results.push({ claim_id: id, status: 200, claim_number: s.claimNumber });
      } catch (err) {
        const e = err as { code?: string; status?: number; message: string };
        results.push({ claim_id: id, status: e.status ?? 500, error: { type: e.code ?? 'error', detail: e.message } });
      }
    }
    return { results, summary: { succeeded: results.filter((x) => x.status === 200).length, failed: results.filter((x) => x.status !== 200).length } };
  });

  r.get('/v1/claims/:id/x12', {
    schema: { tags: ['Claims'], summary: 'The exact 837 transmitted for the latest version', params: z.object({ id: uuid }), response: { 200: z.object({ version_number: z.number(), content_hash: z.string(), x12: z.string().nullable() }) } },
  }, async (req) => {
    return req.command(async (ctx) => {
      const [c] = await ctx.tx.select({ practiceId: schema.claims.practiceId, patientId: schema.claims.patientId }).from(schema.claims).where(eq(schema.claims.id, req.params.id));
      if (!c) throw Object.assign(new Error('not found'), { statusCode: 404 });
      assertCan(req.actor, 'claim:export', { practiceId: c.practiceId });
      req.phi.touch([c.patientId], ['demographics', 'financial']);
      req.phi.markExport();
      const [v] = await ctx.tx.select().from(schema.claimVersions).where(eq(schema.claimVersions.claimId, req.params.id)).orderBy(desc(schema.claimVersions.versionNumber)).limit(1);
      if (!v) throw Object.assign(new Error('not found'), { statusCode: 404 });
      return { version_number: v.versionNumber, content_hash: v.contentHash, x12: v.x12 };
    });
  });
}

function encodeCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify({ at: at.toISOString(), id })).toString('base64url');
}
function decodeCursor(c: string): { at: string; id: string } {
  const v = JSON.parse(Buffer.from(c, 'base64url').toString()) as { at?: string; id?: string };
  if (typeof v.at !== 'string' || typeof v.id !== 'string') throw Object.assign(new Error('bad cursor'), { statusCode: 400 });
  return { at: v.at, id: v.id };
}
