import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { PhiAccessCollector } from '@grove/audit';
import { createClearinghouse } from '@grove/clearinghouse';
import { withTenant } from '@grove/db';
import type { CommandContext } from '@grove/domain';
import { and, eq, schema, sql } from '@grove/db';
import { problem } from './problem';

declare module 'fastify' {
  interface FastifyRequest {
    phi: PhiAccessCollector;
    /** Run a domain command inside this request's tenant transaction. */
    command<T>(fn: (ctx: CommandContext) => Promise<T>): Promise<T>;
  }
}

const clearinghouse = createClearinghouse();

/**
 * Wires each authenticated request to a tenant-scoped transaction, a PHI access
 * collector, and (for writes) an idempotency record.
 */
async function tenantPlugin(app: FastifyInstance) {
  app.decorateRequest('phi', null, []);
  app.decorateRequest('command', null, []);

  app.addHook('preHandler', async (req, reply) => {
    if (!req.tenant) return;
    req.phi = new PhiAccessCollector({ orgId: req.tenant.orgId, actorUserId: req.tenant.actorType === 'user' ? req.tenant.actorId : null, actorType: req.tenant.actorType, sessionId: req.tenant.sessionId, requestId: req.id, route: `${req.method} ${req.routeOptions.url ?? req.url}`, purpose: 'payment', ipAddress: req.ip });

    req.command = (fn) => withTenant(req.tenant, (tx) => fn({ tx, tenant: req.tenant, actor: req.actor, clearinghouse, now: () => new Date() }));

    // Idempotency-Key is REQUIRED on writes. Optional idempotency is idempotency
    // nobody uses.
    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || key.length < 8 || key.length > 200) return problem(reply, 400, 'idempotency_key_required', 'Provide an Idempotency-Key header (8–200 characters) on every write');
      const requestHash = hashBody(req);
      const replay = await withTenant(req.tenant, async (tx) => {
        const [rec] = await tx.select().from(schema.idempotencyRecords).where(and(eq(schema.idempotencyRecords.orgId, req.tenant.orgId), eq(schema.idempotencyRecords.key, key)));
        if (!rec) {
          await tx.insert(schema.idempotencyRecords).values({ orgId: req.tenant.orgId, key, clientId: req.tenant.actorId ?? '00000000-0000-4000-8000-000000000000', endpoint: req.url, requestHash, state: 'in_progress', expiresAt: new Date(Date.now() + 86_400_000) });
          return null;
        }
        if (rec.requestHash !== requestHash) return { conflict: 'reuse' as const };
        if (rec.state === 'in_progress') {
          if (rec.lockedAt.getTime() < Date.now() - 90_000) return null; // stale; original crashed
          return { conflict: 'concurrent' as const };
        }
        return { replay: rec };
      });
      if (replay && 'conflict' in replay) {
        return replay.conflict === 'reuse'
          ? problem(reply, 422, 'idempotency_key_reuse', 'This Idempotency-Key was used with a different request body')
          : problem(reply, 409, 'idempotency_in_progress', 'A request with this Idempotency-Key is still processing', { retry_after: 1 });
      }
      if (replay && 'replay' in replay) {
        return reply.status(replay.replay.responseStatus ?? 200).header('Idempotency-Replayed', 'true').send(replay.replay.responseBody);
      }
      reply.header('Idempotency-Key', key);
    }
  });

  app.addHook('onSend', async (req, reply, payload) => {
    if (!req.tenant) return payload;
    const key = req.headers['idempotency-key'];
    const isWrite = req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT';
    await withTenant(req.tenant, async (tx) => {
      if (!req.phi.isEmpty) await req.phi.flush(tx, (req.routeOptions.url ?? req.url).split('/')[2] ?? 'unknown');
      if (isWrite && typeof key === 'string' && reply.statusCode < 500) {
        await tx.update(schema.idempotencyRecords).set({ state: 'completed', responseStatus: reply.statusCode, responseBody: safeJson(payload), completedAt: new Date() }).where(and(eq(schema.idempotencyRecords.orgId, req.tenant.orgId), eq(schema.idempotencyRecords.key, key)));
      }
    });
    return payload;
  });
  void sql;
}

function hashBody(req: FastifyRequest): string {
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  return createHash('sha256').update(`${req.method} ${req.url} ${JSON.stringify(req.body ?? null)}`).digest('hex');
}

function safeJson(payload: unknown): unknown {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return { raw: payload.slice(0, 10_000) };
    }
  }
  return payload ?? null;
}

export default fp(tenantPlugin, { name: 'grove-tenant', dependencies: ['grove-auth', 'grove-problem'] });
