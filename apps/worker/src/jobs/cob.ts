import type { Job, PgBoss } from 'pg-boss';
import { and, eq, schema, sql } from '@grove/db';
import { generateSecondaryClaimCommand } from '@grove/domain';
import { automationGate, forOrg } from '../context';
import { Q } from '../queues';

interface SecondaryJob { orgId: string; primaryClaimId: string; remittanceClaimId: string; secondaryCoverageId: string }
interface CrossoverJob { orgId: string; primaryClaimId: string; secondaryCoverageId: string }

export async function registerCobJobs(boss: PgBoss): Promise<void> {
  await boss.work<SecondaryJob>(Q.cobGenerateSecondary, { batchSize: 3 }, async (jobs: Job<SecondaryJob>[]) => {
    for (const job of jobs) {
      const { orgId, primaryClaimId, remittanceClaimId, secondaryCoverageId } = job.data;
      await forOrg(orgId, 'cob.generate-secondary', async (ctx) => {
        const [claim] = await ctx.tx.select({ practiceId: schema.claims.practiceId, claimNumber: schema.claims.claimNumber }).from(schema.claims).where(eq(schema.claims.id, primaryClaimId));
        const gate = await automationGate(ctx, claim?.practiceId ?? null, 'autoSecondaryClaims');
        if (!gate.allowed) return;
        if (gate.dryRun) {
          console.log(`[cob] dry-run: would generate secondary for ${claim?.claimNumber}`);
          return;
        }
        const r = await generateSecondaryClaimCommand(ctx, { primaryClaimId, remittanceClaimId, secondaryCoverageId });
        console.log(`[cob] ${claim?.claimNumber} → ${r.claimNumber || '(none)'}: ${r.action}${r.reason ? ` (${r.reason})` : ''}`);
      });
    }
  });

  // The primary said it crossed the claim over. If no secondary remittance has arrived
  // by now, the crossover did not happen and we file our own secondary.
  await boss.work<CrossoverJob>(Q.cobCrossoverWait, { batchSize: 3 }, async (jobs: Job<CrossoverJob>[]) => {
    for (const job of jobs) {
      const { orgId, primaryClaimId, secondaryCoverageId } = job.data;
      await forOrg(orgId, 'cob.crossover-wait', async (ctx) => {
        const [primary] = await ctx.tx.select().from(schema.claims).where(eq(schema.claims.id, primaryClaimId));
        if (!primary || primary.balanceCents <= 0) return;
        const secondaryRemit = await ctx.tx
          .select({ id: schema.remittanceClaims.id })
          .from(schema.remittanceClaims)
          .innerJoin(schema.remittances, eq(schema.remittances.id, schema.remittanceClaims.remittanceId))
          .innerJoin(schema.coverages, eq(schema.coverages.id, secondaryCoverageId))
          .where(and(eq(schema.remittanceClaims.patientControlNumber, primary.claimNumber), sql`${schema.remittances.payerId} = ${schema.coverages.payerId}`));
        if (secondaryRemit.length) return; // the crossover worked
        const [rc] = await ctx.tx.select({ id: schema.remittanceClaims.id }).from(schema.remittanceClaims).where(eq(schema.remittanceClaims.claimId, primaryClaimId)).orderBy(sql`created_at desc`).limit(1);
        if (!rc) return;
        const r = await generateSecondaryClaimCommand(ctx, { primaryClaimId, remittanceClaimId: rc.id, secondaryCoverageId });
        console.log(`[cob] crossover for ${primary.claimNumber} did not arrive; generated ${r.claimNumber}: ${r.action}`);
      });
    }
  });
}
