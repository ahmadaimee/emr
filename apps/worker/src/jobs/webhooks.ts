import { createHmac } from 'node:crypto';
import type { Job, PgBoss } from 'pg-boss';
import { decryptSecret } from '@grove/auth';
import { and, eq, schema, sql } from '@grove/db';
import { forOrg } from '../context';
import { Q } from '../queues';

interface DispatchJob { orgId: string; eventId: string; eventType: string }
interface DeliverJob { orgId: string; deliveryId: string }

/** 12 attempts over ~24 hours. */
const RETRY_SECONDS = [10, 30, 60, 300, 900, 1800, 3600, 7200, 14400, 28800, 43200, 86400];

export async function registerWebhookJobs(boss: PgBoss): Promise<void> {
  await boss.work<DispatchJob>(Q.webhookDispatch, { batchSize: 10 }, async (jobs: Job<DispatchJob>[]) => {
    for (const job of jobs) {
      const { orgId, eventId, eventType } = job.data;
      const deliveries = await forOrg(orgId, 'webhooks.dispatch', async (ctx) => {
        const endpoints = await ctx.tx.select().from(schema.webhookEndpoints).where(and(eq(schema.webhookEndpoints.orgId, orgId), eq(schema.webhookEndpoints.status, 'active'), sql`${eventType} = any(event_types) or '*' = any(event_types)`));
        const [event] = await ctx.tx.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.id, eventId));
        if (!event) return [];
        const ids: string[] = [];
        for (const ep of endpoints) {
          const payloadHash = createHmac('sha256', 'payload').update(JSON.stringify(event.payload)).digest('hex');
          const [d] = await ctx.tx.insert(schema.webhookDeliveries).values({ orgId, endpointId: ep.id, outboxEventId: eventId, eventType, payloadHash, attempt: 1, status: 'pending', nextAttemptAt: ctx.now() }).returning({ id: schema.webhookDeliveries.id });
          ids.push(d!.id);
        }
        return ids;
      });
      for (const deliveryId of deliveries) await boss.send(Q.webhookDeliver, { orgId, deliveryId } satisfies DeliverJob, { singletonKey: `deliver:${deliveryId}` });
    }
  });

  await boss.work<DeliverJob>(Q.webhookDeliver, { batchSize: 5 }, async (jobs: Job<DeliverJob>[]) => {
    for (const job of jobs) {
      const { orgId, deliveryId } = job.data;
      const retry = await forOrg(orgId, 'webhooks.deliver', async (ctx) => {
        const [d] = await ctx.tx.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.id, deliveryId));
        if (!d || d.status === 'delivered') return null;
        const [ep] = await ctx.tx.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, d.endpointId));
        const [event] = await ctx.tx.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.id, d.outboxEventId));
        if (!ep || !event || ep.status !== 'active') return null;

        const body = JSON.stringify({
          id: event.id, type: event.eventType, api_version: ep.apiVersion, created: event.occurredAt.toISOString(), org_id: orgId,
          sequence: event.idempotencyKey,
          data: ep.payloadMode === 'thin' ? { object: { id: event.aggregateId, type: event.aggregateType } } : { object: { id: event.aggregateId, type: event.aggregateType, ...(event.payload as object) } },
        });
        const t = Math.floor(ctx.now().getTime() / 1000);
        const secret = decryptSecret(ep.secretEncrypted, 1);
        const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
        const started = Date.now();
        let httpStatus = 0;
        let snippet = '';
        try {
          const res = await fetch(ep.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Grove-Signature': `t=${t},v1=${sig}`, 'Grove-Event-Id': event.id, 'Grove-Event-Type': event.eventType, 'User-Agent': 'Grove-Webhooks/1.0' },
            body,
            signal: AbortSignal.timeout(15_000),
          });
          httpStatus = res.status;
          snippet = (await res.text()).slice(0, 1024);
        } catch (err) {
          snippet = (err as Error).message.slice(0, 1024);
        }
        const ok = httpStatus >= 200 && httpStatus < 300;
        await ctx.tx.update(schema.webhookDeliveries).set({ status: ok ? 'delivered' : d.attempt >= RETRY_SECONDS.length ? 'exhausted' : 'failed', httpStatus: httpStatus || null, responseSnippet: snippet, durationMs: Date.now() - started, deliveredAt: ok ? ctx.now() : null }).where(eq(schema.webhookDeliveries.id, deliveryId));

        if (ok) {
          await ctx.tx.update(schema.webhookEndpoints).set({ consecutiveFailures: 0 }).where(eq(schema.webhookEndpoints.id, ep.id));
          return null;
        }
        const failures = ep.consecutiveFailures + 1;
        await ctx.tx.update(schema.webhookEndpoints).set({ consecutiveFailures: failures, ...(failures >= 100 ? { status: 'auto_disabled', disabledAt: ctx.now(), disabledReason: '100 consecutive failures' } : {}) }).where(eq(schema.webhookEndpoints.id, ep.id));
        if (d.attempt >= RETRY_SECONDS.length) return null;
        const [next] = await ctx.tx.insert(schema.webhookDeliveries).values({ orgId, endpointId: ep.id, outboxEventId: d.outboxEventId, eventType: d.eventType, payloadHash: d.payloadHash, attempt: d.attempt + 1, status: 'pending', nextAttemptAt: new Date(ctx.now().getTime() + RETRY_SECONDS[d.attempt]! * 1000) }).returning({ id: schema.webhookDeliveries.id });
        return { id: next!.id, after: RETRY_SECONDS[d.attempt]! };
      });
      if (retry) await boss.send(Q.webhookDeliver, { orgId, deliveryId: retry.id } satisfies DeliverJob, { startAfter: retry.after, singletonKey: `deliver:${retry.id}` });
    }
  });
}
