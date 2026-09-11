import { PgBoss } from 'pg-boss';
import { closeDatabase } from '@grove/db';
import { Q } from './queues';
import { registerOutboxRelay } from './jobs/outbox-relay';
import { registerEligibilityJobs } from './jobs/eligibility';
import { registerClaimJobs } from './jobs/claims';
import { registerRemittanceJobs } from './jobs/remittance';
import { registerCobJobs } from './jobs/cob';
import { registerMaintenanceJobs } from './jobs/maintenance';
import { registerWebhookJobs } from './jobs/webhooks';
import { registerAuthorizationJobs } from './jobs/authorizations';

/**
 * The automation runtime. pg-boss on Postgres: transactional enqueue via the outbox,
 * durable retries, cron schedules, and no second PHI datastore.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const boss = new PgBoss({
    connectionString,
    schema: 'pgboss',
    monitorIntervalSeconds: 30,
  });
  boss.on('error', (err: Error) => console.error('[pg-boss]', err));
  await boss.start();

  for (const name of Object.values(Q)) {
    // Keep job history short; the audit trail lives elsewhere and job payloads are IDs.
    await boss.createQueue(name, { retryLimit: 5, retryBackoff: true, retryDelay: 30, expireInSeconds: 15 * 60, deleteAfterSeconds: 2 * 86_400 });
  }

  await registerOutboxRelay(boss);
  await registerEligibilityJobs(boss);
  await registerClaimJobs(boss);
  await registerRemittanceJobs(boss);
  await registerCobJobs(boss);
  await registerWebhookJobs(boss);
  await registerMaintenanceJobs(boss);
  await registerAuthorizationJobs(boss);

  // Schedules. All times UTC; per-org local scheduling reads the practice timezone.
  await boss.schedule(Q.outboxRelay, '* * * * *', {}, { tz: 'UTC' });
  await boss.schedule(Q.eraFetch, '*/30 * * * *', {}, { tz: 'UTC' });
  await boss.schedule(Q.eligibilityPreVisit, '0 23 * * *', {}, { tz: 'UTC' }); // 18:00 US/Eastern
  await boss.schedule(Q.eligibilityMonthly, '0 8 1 * *', {}, { tz: 'UTC' });
  await boss.schedule(Q.claimTimelyFilingSweep, '0 11 * * *', {}, { tz: 'UTC' });
  await boss.schedule(Q.claimAutoSubmitSweep, '0 * * * *', {}, { tz: 'UTC' }); // hourly; matches against each org's configured autoSubmitHourUtc
  await boss.schedule(Q.authorizationOverdueSweep, '*/30 * * * *', {}, { tz: 'UTC' });
  await boss.schedule(Q.balancesReconcile, '30 7 * * *', {}, { tz: 'UTC' });
  await boss.schedule(Q.auditVerifyChain, '0 9 * * 0', {}, { tz: 'UTC' });

  console.log(`[worker] up — ${Object.keys(Q).length} queues registered, clearinghouse=${process.env.CLEARINGHOUSE_PROVIDER ?? 'mock'}`);

  const shutdown = async () => {
    console.log('[worker] shutting down');
    await boss.stop({ graceful: true, timeout: 20_000 });
    await closeDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
