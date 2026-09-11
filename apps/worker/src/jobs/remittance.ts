import type { Job, PgBoss } from 'pg-boss';
import { and, eq, listOrganizationIds, schema, sql } from '@grove/db';
import { DomainError, postRemittanceCommand } from '@grove/domain';
import { parse835, splitTransactionSets, tokenize } from '@grove/x12';
import { forOrg } from '../context';
import { Q } from '../queues';

interface PostJob { orgId: string; fileId: string; raw835: string; fileName?: string }

export async function registerRemittanceJobs(boss: PgBoss): Promise<void> {
  // Pull new 835s from the clearinghouse and hand each file to the poster.
  await boss.work(Q.eraFetch, { batchSize: 1 }, async () => {
    for (const orgId of await listOrganizationIds()) {
      await forOrg(orgId, 'era.fetch', async (ctx) => {
        const [last] = await ctx.tx.select({ at: sql<Date | null>`max(received_at)` }).from(schema.remittances).where(eq(schema.remittances.orgId, orgId));
        const since = last?.at ? new Date(new Date(last.at).getTime() - 86_400_000) : new Date(Date.now() - 30 * 86_400_000);
        const result = await ctx.clearinghouse.fetchRemittances(since);
        await ctx.tx.insert(schema.externalCalls).values({ orgId, connector: ctx.clearinghouse.name, operation: 'era_fetch', durationMs: result.meta.durationMs, outcome: 'ok', costCents: result.meta.costCents, triggeredBy: 'system' });
        for (const f of result.files) {
          const seen = await ctx.tx.select({ id: schema.remittances.id }).from(schema.remittances).where(and(eq(schema.remittances.connector, ctx.clearinghouse.name), eq(schema.remittances.connectorFileId, f.fileId)));
          if (seen.length) continue;
          await boss.send(Q.eraPost, { orgId, fileId: f.fileId, raw835: f.raw835, fileName: f.fileName } satisfies PostJob, { singletonKey: `era:${orgId}:${f.fileId}`, retryLimit: 3 });
        }
      });
    }
  });

  await boss.work<PostJob>(Q.eraPost, { batchSize: 1 }, async ([job]: Job<PostJob>[]) => {
    if (!job) return;
    const { orgId, fileId, raw835, fileName } = job.data;
    const sets = splitTransactionSets(tokenize(raw835));
    for (const ts of sets) {
      const remit = parse835(ts);
      try {
        const r = await forOrg(orgId, 'era.post', (ctx) => postRemittanceCommand(ctx, remit, { connector: process.env.CLEARINGHOUSE_PROVIDER ?? 'mock', fileId, fileName }));
        console.log(`[era] ${remit.traceNumber}: ${r.status} — ${r.claimsMatched} matched, ${r.denials} denials, ${r.underpayments} underpayments, ${r.secondaryReady} secondaries ready`);
      } catch (err) {
        if (err instanceof DomainError && err.code === 'remittance_duplicate') continue;
        throw err;
      }
    }
    await forOrg(orgId, 'era.post', async (ctx) => {
      await ctx.clearinghouse.acknowledgeRemittance?.(fileId);
    });
  });
}
