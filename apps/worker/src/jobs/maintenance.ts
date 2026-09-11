import type { PgBoss } from 'pg-boss';
import { verifyChain } from '@grove/audit';
import { eq, listOrganizationIds, schema, sql } from '@grove/db';
import { forOrg } from '../context';
import { Q } from '../queues';

export async function registerMaintenanceJobs(boss: PgBoss): Promise<void> {
  // The audit chain is only tamper-evident if someone checks it.
  await boss.work(Q.auditVerifyChain, { batchSize: 1 }, async () => {
    for (const orgId of await listOrganizationIds()) {
      await forOrg(orgId, 'audit.verify-chain', async (ctx) => {
        const result = await verifyChain(ctx.tx, orgId, { limit: 500_000 });
        await ctx.tx.insert(schema.auditChainVerifications).values({ orgId, fromSequence: result.fromSequence ?? '0', toSequence: result.toSequence ?? '0', result: result.ok ? 'passed' : 'failed', brokenAtSequence: result.brokenAtSequence ?? null });
        if (!result.ok) {
          await ctx.tx.insert(schema.complianceAlerts).values({ orgId, alertType: 'chain_break', severity: 'critical', summary: `Audit chain verification FAILED at sequence ${result.brokenAtSequence}: ${result.reason}`, evidence: result });
          console.error(`[audit] CHAIN BREAK for ${orgId} at ${result.brokenAtSequence}`);
        } else {
          console.log(`[audit] ${orgId}: chain verified, ${result.checked} events`);
        }
      });
    }
  });

  // Derived balances must equal the ledger. A variance is a bug, and a loud one.
  await boss.work(Q.balancesReconcile, { batchSize: 1 }, async () => {
    for (const orgId of await listOrganizationIds()) {
      await forOrg(orgId, 'balances.reconcile', async (ctx) => {
        const variances = await ctx.tx.execute<{ subject_type: string; subject_id: string; snapshot: string; ledger: string }>(sql`
          with ledger as (
            select 'claim' as subject_type, claim_id as subject_id, sum(amount_cents) as total
              from ledger_entries where org_id = ${orgId} and claim_id is not null group by claim_id
            union all
            select 'patient', patient_id, sum(amount_cents)
              from ledger_entries where org_id = ${orgId} group by patient_id
          )
          select b.subject_type, b.subject_id,
                 (b.insurance_balance_cents + b.patient_balance_cents)::text as snapshot,
                 coalesce(l.total, 0)::text as ledger
            from balance_snapshots b
            left join ledger l on l.subject_type = b.subject_type and l.subject_id = b.subject_id
           where b.org_id = ${orgId}
             and (b.insurance_balance_cents + b.patient_balance_cents) <> coalesce(l.total, 0)
        `);
        for (const v of variances) {
          const diff = Number(v.snapshot) - Number(v.ledger);
          await ctx.tx.update(schema.balanceSnapshots).set({ reconciliationVarianceCents: diff, lastReconciledAt: ctx.now() }).where(sql`subject_type = ${v.subject_type} and subject_id = ${v.subject_id}`);
          await ctx.tx.insert(schema.complianceAlerts).values({ orgId, alertType: 'balance_variance', severity: 'high', summary: `${v.subject_type} ${v.subject_id} balance snapshot differs from ledger by ${(diff / 100).toFixed(2)}`, evidence: v });
        }
        await ctx.tx.update(schema.balanceSnapshots).set({ lastReconciledAt: ctx.now(), reconciliationVarianceCents: 0 }).where(sql`org_id = ${orgId} and reconciliation_variance_cents = 0`);
        console.log(`[reconcile] ${orgId}: ${variances.length} variances`);

        // Refresh learned payer behaviour while we are here.
        await ctx.tx.execute(sql`
          insert into payer_behavior_stats (org_id, payer_id, practice_id, median_days_to_remit, p90_days_to_remit, denial_rate_bps, sample_size, computed_at)
          select c.org_id, c.payer_id, null,
                 percentile_cont(0.5) within group (order by extract(day from c.first_remittance_at - c.submitted_at))::int,
                 percentile_cont(0.9) within group (order by extract(day from c.first_remittance_at - c.submitted_at))::int,
                 (10000.0 * count(*) filter (where c.status = 'denied') / greatest(count(*), 1))::int,
                 count(*)::int, current_date
            from claims c
           where c.org_id = ${orgId} and c.submitted_at is not null and c.first_remittance_at is not null
             and c.submitted_at > now() - interval '180 days'
           group by c.org_id, c.payer_id
          on conflict (org_id, payer_id, practice_id) do update
            set median_days_to_remit = excluded.median_days_to_remit, p90_days_to_remit = excluded.p90_days_to_remit,
                denial_rate_bps = excluded.denial_rate_bps, sample_size = excluded.sample_size, computed_at = excluded.computed_at, updated_at = now()
        `);
      });
    }
  });
  void eq;
}
