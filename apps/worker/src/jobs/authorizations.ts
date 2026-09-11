import type { PgBoss } from 'pg-boss';
import { and, eq, listOrganizationIds, lt, schema, sql } from '@grove/db';
import { createTask, emit } from '@grove/domain';
import { forOrg } from '../context';
import { Q } from '../queues';

/**
 * Prior auth has no inbound acknowledgment to poll — most payers still answer by
 * phone, fax, or portal — so the only thing automation can do is watch the clock the
 * CMS Interoperability and Prior Authorization Final Rule sets (7 days standard, 72
 * hours urgent) and put a human on it once that clock runs out unanswered.
 */
export async function registerAuthorizationJobs(boss: PgBoss): Promise<void> {
  await boss.work(Q.authorizationOverdueSweep, { batchSize: 1 }, async () => {
    for (const orgId of await listOrganizationIds()) {
      await forOrg(orgId, 'authorization.overdue.sweep', async (ctx) => {
        const overdue = await ctx.tx
          .select({
            id: schema.authorizations.id,
            practiceId: schema.authorizations.practiceId,
            patientId: schema.authorizations.patientId,
            dueAt: schema.authorizations.dueAt,
            procedureCodes: schema.authorizations.procedureCodes,
            urgency: schema.authorizations.urgency,
          })
          .from(schema.authorizations)
          .where(and(eq(schema.authorizations.orgId, orgId), eq(schema.authorizations.status, 'submitted'), lt(schema.authorizations.dueAt, sql`now()`)));

        for (const a of overdue) {
          await ctx.tx.update(schema.authorizations).set({ status: 'pending', reviewRequired: true, updatedAt: ctx.now() }).where(eq(schema.authorizations.id, a.id));
          await createTask(ctx, {
            queueKey: 'authorizations', practiceId: a.practiceId, subjectType: 'patient', subjectId: a.patientId, patientId: a.patientId,
            title: `${a.urgency === 'urgent' ? '72-hour' : '7-day'} prior-auth response window passed for ${a.procedureCodes.join(', ')}`,
            detail: { authorizationId: a.id, dueAt: a.dueAt }, priority: a.urgency === 'urgent' ? 'urgent' : 'high',
            suggestedAction: 'review', dedupeKey: `auth-overdue:${a.id}`,
          });
          await emit(ctx, 'authorization.requested', 'authorization', a.id, { overdue: true, dueAt: a.dueAt?.toISOString?.() ?? a.dueAt }, `auth-overdue:${a.id}`);
        }
        if (overdue.length) console.log(`[authorizations] ${overdue.length} overdue for org ${orgId}`);
      });
    }
  });
}
