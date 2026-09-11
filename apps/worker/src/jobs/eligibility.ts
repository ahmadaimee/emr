import type { Job, PgBoss } from 'pg-boss';
import { and, eq, listOrganizationIds, schema, sql } from '@grove/db';
import { addDays, createEligibilityBatchCommand, recordBatchOutcome, runEligibilityCheckCommand, type EligibilityTrigger } from '@grove/domain';
import { automationGate, forOrg } from '../context';
import { Q } from '../queues';

interface CheckJob {
  orgId: string;
  coverageId: string;
  trigger: EligibilityTrigger;
  serviceDate?: string;
  batchId?: string;
  encounterId?: string;
}

interface FanoutJob {
  orgId: string;
  batchId: string;
  coverageIds: string[];
  serviceDate?: string;
}

export async function registerEligibilityJobs(boss: PgBoss): Promise<void> {
  // One 270/271 per job. Concurrency is bounded here and by the per-minute cap so a
  // 5,000-member batch is a steady stream, not a payer-rate-limit incident.
  const perMinute = Number(process.env.AUTOMATION_ELIGIBILITY_MAX_PER_MINUTE ?? 120);
  await boss.work<CheckJob>(Q.eligibilityCheck, { batchSize: Math.max(1, Math.min(10, Math.floor(perMinute / 12))), pollingIntervalSeconds: 5 }, async (jobs: Job<CheckJob>[]) => {
    for (const job of jobs) {
      const { orgId, coverageId, trigger, serviceDate, batchId, encounterId } = job.data;
      await forOrg(orgId, `eligibility.check:${trigger}`, async (ctx) => {
        if (trigger !== 'manual' && trigger !== 'batch' && trigger !== 'api') {
          const gate = await automationGate(ctx, null, trigger === 'check_in' ? 'autoEligibilityCheckIn' : trigger === 'periodic_reverification' ? 'autoEligibilityMonthly' : 'autoEligibilityPreVisit');
          if (!gate.allowed) return;
          if (gate.dryRun) {
            console.log(`[eligibility] dry-run: would check coverage ${coverageId} (${trigger})`);
            return;
          }
        }
        let outcome: { status: string; changed: boolean } = { status: 'transport_error', changed: false };
        try {
          const r = await runEligibilityCheckCommand(ctx, { coverageId, trigger, serviceDate, batchId, encounterId });
          outcome = { status: r.status, changed: r.changes.length > 0 };
        } finally {
          if (batchId) await recordBatchOutcome(ctx, batchId, outcome);
        }
      });
    }
  });

  await boss.work<FanoutJob>(Q.eligibilityBatchFanout, { batchSize: 1 }, async ([job]: Job<FanoutJob>[]) => {
    if (!job) return;
    const { orgId, batchId, coverageIds, serviceDate } = job.data;
    for (const coverageId of coverageIds) {
      await boss.send(Q.eligibilityCheck, { orgId, coverageId, trigger: 'batch', serviceDate, batchId } satisfies CheckJob, { singletonKey: `elig:${batchId}:${coverageId}` });
    }
  });

  // Pre-visit: verify everyone with an encounter N days out, per practice.
  await boss.work(Q.eligibilityPreVisit, { batchSize: 1 }, async () => {
    for (const orgId of await listOrganizationIds()) {
      await forOrg(orgId, 'eligibility.pre-visit', async (ctx) => {
        const gate = await automationGate(ctx, null, 'autoEligibilityPreVisit');
        if (!gate.allowed) return;
        const [settings] = await ctx.tx.select({ days: schema.automationSettings.autoEligibilityPreVisitDays }).from(schema.automationSettings).where(and(eq(schema.automationSettings.orgId, orgId), sql`practice_id is null`));
        const target = addDays(ctx.now().toISOString().slice(0, 10), settings?.days ?? 3);
        const practices = await ctx.tx.select({ id: schema.practices.id, name: schema.practices.name }).from(schema.practices).where(eq(schema.practices.active, true));
        for (const p of practices) {
          try {
            const batch = await createEligibilityBatchCommand(ctx, { name: `Pre-visit ${target} — ${p.name}`, source: { type: 'schedule_day', practiceId: p.id, date: target }, serviceDate: target });
            if (gate.dryRun) {
              console.log(`[eligibility] dry-run: would verify ${batch.totalCount} members for ${p.name} on ${target}`);
              continue;
            }
            await boss.send(Q.eligibilityBatchFanout, { orgId, batchId: batch.batchId, coverageIds: batch.coverageIds, serviceDate: target } satisfies FanoutJob);
          } catch (err) {
            if ((err as { code?: string }).code !== 'empty_batch') throw err;
          }
        }
      });
    }
  });

  // Monthly: everyone not verified in the last 30 days.
  await boss.work(Q.eligibilityMonthly, { batchSize: 1 }, async () => {
    for (const orgId of await listOrganizationIds()) {
      await forOrg(orgId, 'eligibility.monthly', async (ctx) => {
        const gate = await automationGate(ctx, null, 'autoEligibilityMonthly');
        if (!gate.allowed || gate.dryRun) return;
        const cutoff = addDays(ctx.now().toISOString().slice(0, 10), -30);
        const practices = await ctx.tx.select({ id: schema.practices.id, name: schema.practices.name }).from(schema.practices).where(eq(schema.practices.active, true));
        for (const p of practices) {
          try {
            const batch = await createEligibilityBatchCommand(ctx, { name: `Monthly re-verification — ${p.name}`, source: { type: 'panel', practiceId: p.id, verifiedBefore: cutoff } });
            await boss.send(Q.eligibilityBatchFanout, { orgId, batchId: batch.batchId, coverageIds: batch.coverageIds } satisfies FanoutJob);
          } catch (err) {
            if ((err as { code?: string }).code !== 'empty_batch') throw err;
          }
        }
      });
    }
  });
}
