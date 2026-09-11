import { PgBoss } from 'pg-boss';

/**
 * Producer-only pg-boss client. The API never runs `.work()` — it only enqueues jobs
 * the worker (apps/worker) already owns and polls, most often to accelerate something
 * that would otherwise wait out a scheduled cron or retry backoff (see the Stedi
 * webhook route). Lazily connected so a request that never touches this pays nothing.
 */
let boss: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  if (!starting) {
    starting = (async () => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error('DATABASE_URL is not set');
      const client = new PgBoss({ connectionString, schema: 'pgboss' });
      client.on('error', (err: Error) => console.error('[api][pg-boss]', err));
      await client.start();
      boss = client;
      return client;
    })();
  }
  return starting;
}

/** Enqueue an immediate run of a bare (no-payload) worker sweep queue. */
export async function triggerSweep(queue: string): Promise<void> {
  const client = await getBoss();
  await client.send(queue, {});
}
