import type PgBoss from 'pg-boss';
import { and, eq, listOrganizationIds, schema, sql } from '@grove/db';
import { forOrg } from '../context';
import { Q, ROUTES } from '../queues';

/**
 * Move committed domain events from the outbox to pg-boss.
 *
 * Runs every minute by schedule and can also be poked. Publishes each event to its
 * follow-up queues and to the webhook dispatcher, then marks it published. A crash
 * between send and mark produces a redelivery, which every consumer tolerates: tasks
 * dedupe on a key, remittances refuse duplicates, secondaries are one-per-remittance.
 */
export async function registerOutboxRelay(boss: PgBoss): Promise<void> {
  await boss.work(Q.outboxRelay, { batchSize: 1, pollingIntervalSeconds: 5 }, async () => {
    const orgIds = await listOrganizationIds();
    let published = 0;
    for (const orgId of orgIds) {
      published += await relayOrg(boss, orgId);
    }
    if (published) console.log(`[outbox] published ${published} events`);
  });
}

async function relayOrg(boss: PgBoss, orgId: string): Promise<number> {
  return forOrg(orgId, 'outbox.relay', async (ctx) => {
    const events = await ctx.tx
      .select()
      .from(schema.outboxEvents)
      .where(and(eq(schema.outboxEvents.orgId, orgId), sql`published_at is null`, sql`attempts < 10`))
      .orderBy(schema.outboxEvents.occurredAt)
      .limit(200);

    let n = 0;
    for (const e of events) {
      const payload = { ...(e.payload as Record<string, unknown>), aggregateId: e.aggregateId, aggregateType: e.aggregateType, eventId: e.id, orgId };
      try {
        for (const route of ROUTES[e.eventType] ?? []) {
          await boss.send(route.queue, route.map(payload), {
            startAfter: route.startAfterSeconds,
            singletonKey: route.singletonKey?.(payload),
            retryLimit: 5,
            retryBackoff: true,
          });
        }
        await boss.send(Q.webhookDispatch, { orgId, eventId: e.id, eventType: e.eventType }, { singletonKey: `wh:${e.id}` });
        await ctx.tx.update(schema.outboxEvents).set({ publishedAt: ctx.now(), attempts: e.attempts + 1 }).where(eq(schema.outboxEvents.id, e.id));
        n++;
      } catch (err) {
        await ctx.tx.update(schema.outboxEvents).set({ attempts: e.attempts + 1, lastError: (err as Error).message.slice(0, 500) }).where(eq(schema.outboxEvents.id, e.id));
      }
    }
    return n;
  });
}
