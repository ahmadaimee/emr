import type { Job, PgBoss } from 'pg-boss';
import { recordActivity } from '@grove/audit';
import { and, eq, listOrganizationIds, schema, sql } from '@grove/db';
import { createTask, emit, submitClaimCommand, transitionClaim } from '@grove/domain';
import { automationGate, forOrg } from '../context';
import { Q } from '../queues';

interface SubmitJob { orgId: string; claimId: string }
interface AckJob { orgId: string; claimId: string; submissionId: string; connectorSubmissionId: string; attempt: number }
interface StatusJob { orgId: string; claimId: string; attempt: number }

export async function registerClaimJobs(boss: PgBoss): Promise<void> {
  await boss.work<SubmitJob>(Q.claimSubmit, { batchSize: 3 }, async (jobs: Job<SubmitJob>[]) => {
    for (const job of jobs) {
      await forOrg(job.data.orgId, 'claim.submit', (ctx) => submitClaimCommand(ctx, job.data.claimId, { acknowledgeWarnings: true }));
    }
  });

  // 999 / 277CA. Retries with growing delay until an ack arrives or we give up.
  await boss.work<AckJob>(Q.claimAckFetch, { batchSize: 5 }, async (jobs: Job<AckJob>[]) => {
    for (const job of jobs) {
      const { orgId, claimId, submissionId, connectorSubmissionId, attempt } = job.data;
      const done = await forOrg(orgId, 'claim.ack.fetch', async (ctx) => {
        const result = await ctx.clearinghouse.fetchAcknowledgments(connectorSubmissionId);
        await ctx.tx.insert(schema.externalCalls).values({ orgId, connector: ctx.clearinghouse.name, operation: 'ack_fetch', subjectType: 'claim', subjectId: claimId, durationMs: result.meta.durationMs, outcome: 'ok', costCents: result.meta.costCents, triggeredBy: 'system' });
        if (result.acknowledgments.length === 0) return false;

        let rejected = false;
        let payerControl: string | undefined;
        for (const ack of result.acknowledgments) {
          await ctx.tx.insert(schema.claimAcknowledgments).values({
            orgId, claimId, claimSubmissionId: submissionId, type: ack.type, resultCode: ack.result,
            statusCategoryCode: ack.statusCategoryCode ?? null, statusCode: ack.statusCode ?? null, message: ack.message ?? null,
            segmentId: ack.segmentId ?? null, elementPosition: ack.elementPosition ?? null, receivedAt: ack.receivedAt, rawContent: ack.raw ?? null,
          });
          if (ack.result === 'R') rejected = true;
          if (ack.payerClaimControlNumber) payerControl = ack.payerClaimControlNumber;
        }

        await ctx.tx.update(schema.claimSubmissions).set({ status: rejected ? 'rejected' : 'acknowledged', acknowledgedAt: ctx.now() }).where(eq(schema.claimSubmissions.id, submissionId));
        if (payerControl) await ctx.tx.update(schema.claims).set({ payerClaimControlNumber: payerControl }).where(eq(schema.claims.id, claimId));

        const [claim] = await ctx.tx.select({ claimNumber: schema.claims.claimNumber, practiceId: schema.claims.practiceId, patientId: schema.claims.patientId }).from(schema.claims).where(eq(schema.claims.id, claimId));
        if (rejected) {
          const reasons = result.acknowledgments.filter((a) => a.result === 'R').map((a) => a.message ?? `${a.statusCategoryCode ?? ''} ${a.statusCode ?? ''}`.trim());
          await transitionClaim(ctx, claimId, 'rejected', 'ack', reasons.join('; '));
          await emit(ctx, 'claim.rejected', 'claim', claimId, { claimNumber: claim?.claimNumber, reasons });
          // A front-end rejection has no 835, no CARC, and no appeal — it is only
          // visible if we make it visible. Straight to a queue.
          await createTask(ctx, {
            queueKey: 'rejections', practiceId: claim?.practiceId, subjectType: 'claim', subjectId: claimId, patientId: claim?.patientId,
            title: `${claim?.claimNumber} rejected before adjudication: ${reasons[0] ?? 'see acknowledgment'}`,
            detail: { submissionId, reasons }, priority: 'high', suggestedAction: 'correct_and_resubmit', dedupeKey: `reject:${submissionId}`,
          });
          await recordActivity(ctx.tx, { orgId, practiceId: claim?.practiceId, subjectType: 'claim', subjectId: claimId, verb: 'claim.rejected', summary: `claim ${claim?.claimNumber} was rejected by the clearinghouse/payer front end: ${reasons[0] ?? ''}`, actorType: 'system' });
        } else {
          await transitionClaim(ctx, claimId, 'acknowledged', 'ack', 'accepted by payer front end');
          await emit(ctx, 'claim.acknowledged', 'claim', claimId, { claimNumber: claim?.claimNumber, payerClaimControlNumber: payerControl ?? null });
          await recordActivity(ctx.tx, { orgId, practiceId: claim?.practiceId, subjectType: 'claim', subjectId: claimId, verb: 'claim.acknowledged', summary: `claim ${claim?.claimNumber} accepted by the payer front end`, actorType: 'system' });
        }
        return true;
      });

      if (!done) {
        if (attempt >= 12) {
          await forOrg(orgId, 'claim.ack.fetch', async (ctx) => {
            const [claim] = await ctx.tx.select({ claimNumber: schema.claims.claimNumber, practiceId: schema.claims.practiceId, patientId: schema.claims.patientId }).from(schema.claims).where(eq(schema.claims.id, claimId));
            await createTask(ctx, { queueKey: 'rejections', practiceId: claim?.practiceId, subjectType: 'claim', subjectId: claimId, patientId: claim?.patientId, title: `No acknowledgment for ${claim?.claimNumber} after 48 hours`, detail: { submissionId }, priority: 'high', dedupeKey: `noack:${submissionId}` });
          });
          continue;
        }
        // 5m, 15m, 30m, 1h, 2h, 4h, 4h...
        const delays = [300, 900, 1800, 3600, 7200, 14400];
        await boss.send(Q.claimAckFetch, { ...job.data, attempt: attempt + 1 } satisfies AckJob, { startAfter: delays[Math.min(attempt, delays.length - 1)], singletonKey: `ack:${submissionId}:${attempt + 1}` });
      }
    }
  });

  // Bare accelerator: re-checks every still-outstanding submission right now instead
  // of waiting out its backoff delay. The webhook route (apps/api) sends this the
  // moment Stedi tells us a 999/277CA is ready; it is also harmless to run on its own
  // schedule as a safety net, since fetchAcknowledgments is idempotent per submission.
  await boss.work(Q.claimAckFetchSweep, { batchSize: 1 }, async () => {
    for (const orgId of await listOrganizationIds()) {
      await forOrg(orgId, 'claim.ack.fetch.sweep', async (ctx) => {
        const outstanding = await ctx.tx
          .select({ id: schema.claimSubmissions.id, claimId: schema.claimSubmissions.claimId, connectorSubmissionId: schema.claimSubmissions.connectorSubmissionId })
          .from(schema.claimSubmissions)
          .where(and(eq(schema.claimSubmissions.orgId, orgId), eq(schema.claimSubmissions.status, 'sent')));
        for (const s of outstanding) {
          if (!s.connectorSubmissionId) continue;
          await boss.send(Q.claimAckFetch, { orgId, claimId: s.claimId, submissionId: s.id, connectorSubmissionId: s.connectorSubmissionId, attempt: 1 } satisfies AckJob, { singletonKey: `ack-sweep:${s.id}` });
        }
        if (outstanding.length) console.log(`[claims] ack sweep queued ${outstanding.length} outstanding submission(s) for org ${orgId}`);
      });
    }
  });

  // 276/277 polling on a cadence learned from the payer, stopping on finalisation.
  await boss.work<StatusJob>(Q.claimStatusPoll, { batchSize: 5 }, async (jobs: Job<StatusJob>[]) => {
    for (const job of jobs) {
      const { orgId, claimId, attempt } = job.data;
      const next = await forOrg(orgId, 'claim.status.poll', async (ctx) => {
        const [claim] = await ctx.tx.select().from(schema.claims).where(eq(schema.claims.id, claimId));
        if (!claim) return null;
        // Anything already resolved by an 835 needs no polling.
        if (!['submitted', 'acknowledged', 'in_process'].includes(claim.status)) return null;
        const gate = await automationGate(ctx, claim.practiceId, 'autoClaimStatus');
        if (!gate.allowed || gate.dryRun) return null;

        const [patient] = await ctx.tx.select().from(schema.patients).where(eq(schema.patients.id, claim.patientId));
        const [coverage] = await ctx.tx.select().from(schema.coverages).where(eq(schema.coverages.id, claim.coverageId));
        const [practice] = await ctx.tx.select().from(schema.practices).where(eq(schema.practices.id, claim.practiceId));
        const [payer] = await ctx.tx.select().from(schema.payers).where(eq(schema.payers.id, claim.payerId));
        if (!patient || !coverage || !practice || !payer) return null;

        const result = await ctx.clearinghouse.checkClaimStatus({
          payerId: payer.payerIdCode ?? '', patientControlNumber: claim.claimNumber, payerClaimControlNumber: claim.payerClaimControlNumber ?? undefined,
          billingProviderNpi: practice.npi ?? '', subscriberMemberId: coverage.memberId,
          subscriber: { lastName: patient.lastName, firstName: patient.firstName, dateOfBirth: patient.dateOfBirth },
          serviceDateFrom: claim.serviceDateFrom, serviceDateTo: claim.serviceDateThrough ?? claim.serviceDateFrom,
          totalChargeCents: claim.totalChargeCents, traceNumber: `${claim.claimNumber}-${attempt}`,
        });
        await ctx.tx.insert(schema.claimStatusChecks).values({ orgId, claimId, connector: ctx.clearinghouse.name, requestedAt: ctx.now(), respondedAt: ctx.now(), statusCategoryCode: result.statusCategoryCode, statusCode: result.statusCode, statusDescription: result.statusDescription ?? null, isFinal: result.isFinal, paidAmountCents: result.paidAmountCents ?? null, effectiveDate: result.effectiveDate ?? null, rawResponse: result.raw277 ?? null });
        await ctx.tx.insert(schema.externalCalls).values({ orgId, practiceId: claim.practiceId, connector: ctx.clearinghouse.name, operation: 'claim_status', subjectType: 'claim', subjectId: claimId, durationMs: result.meta.durationMs, outcome: 'ok', costCents: result.meta.costCents, triggeredBy: 'system' });
        if (result.payerClaimControlNumber && !claim.payerClaimControlNumber) await ctx.tx.update(schema.claims).set({ payerClaimControlNumber: result.payerClaimControlNumber }).where(eq(schema.claims.id, claimId));

        await emit(ctx, 'claim.status_updated', 'claim', claimId, { claimNumber: claim.claimNumber, statusCategoryCode: result.statusCategoryCode, statusCode: result.statusCode, isFinal: result.isFinal });
        await recordActivity(ctx.tx, { orgId, practiceId: claim.practiceId, subjectType: 'claim', subjectId: claimId, verb: 'claim.status_updated', summary: `payer reports ${result.statusDescription ?? result.statusCategoryCode}${result.paidAmountCents ? ` — ${(result.paidAmountCents / 100).toFixed(2)}` : ''}`, actorType: 'system' });

        if (result.isFinal) {
          // Finalised but no 835 yet: leave the claim to the remittance, but if it was
          // denied and no ERA follows, a task ensures it is not lost.
          if (result.statusCategoryCode === 'F2') {
            await createTask(ctx, { queueKey: 'denials', practiceId: claim.practiceId, subjectType: 'claim', subjectId: claimId, patientId: claim.patientId, title: `${claim.claimNumber} finalised as denied per 277; awaiting ERA`, detail: { statusCode: result.statusCode }, priority: 'normal', dedupeKey: `277denied:${claimId}` });
          }
          return null;
        }
        if (claim.status !== 'in_process' && result.statusCategoryCode.startsWith('A')) await transitionClaim(ctx, claimId, 'in_process', 'status_check', result.statusDescription);

        // Cadence: learned p90 days-to-remit for this payer, else a widening default.
        const [stats] = await ctx.tx.select({ p90: schema.payerBehaviorStats.p90DaysToRemit }).from(schema.payerBehaviorStats).where(and(eq(schema.payerBehaviorStats.payerId, claim.payerId), sql`practice_id is null`));
        const base = stats?.p90 ?? 21;
        const days = Math.min(30, Math.max(5, Math.round(base / 2) * attempt));
        return attempt >= 8 ? null : days * 86_400;
      });
      if (next) await boss.send(Q.claimStatusPoll, { orgId, claimId, attempt: attempt + 1 } satisfies StatusJob, { startAfter: next, singletonKey: `status:${claimId}:${attempt + 1}` });
    }
  });

  // Ready claims sit until an operator submits them, unless an org has opted into a
  // daily auto-submit hour — checked hourly so a per-practice override of either the
  // flag or the hour takes effect within 60 minutes rather than waiting for the next
  // calendar day.
  await boss.work(Q.claimAutoSubmitSweep, { batchSize: 1 }, async () => {
    const hour = new Date().getUTCHours();
    for (const orgId of await listOrganizationIds()) {
      await forOrg(orgId, 'claim.auto-submit.sweep', async (ctx) => {
        const ready = await ctx.tx
          .select({ id: schema.claims.id, practiceId: schema.claims.practiceId })
          .from(schema.claims)
          .where(and(eq(schema.claims.orgId, orgId), eq(schema.claims.status, 'ready')));
        if (ready.length === 0) return;

        const byPractice = new Map<string, string[]>();
        for (const c of ready) byPractice.set(c.practiceId, [...(byPractice.get(c.practiceId) ?? []), c.id]);

        for (const [practiceId, claimIds] of byPractice) {
          const gate = await automationGate(ctx, practiceId, 'autoSubmitReadyClaims');
          if (!gate.allowed || gate.dryRun) continue;

          const [settings] = await ctx.tx
            .select({ hour: schema.automationSettings.autoSubmitHourUtc })
            .from(schema.automationSettings)
            .where(and(eq(schema.automationSettings.orgId, orgId), sql`(practice_id is null or practice_id = ${practiceId})`))
            .orderBy(sql`practice_id nulls last`)
            .limit(1);
          if ((settings?.hour ?? -1) !== hour) continue;

          for (const claimId of claimIds) {
            await boss.send(Q.claimSubmit, { orgId, claimId } satisfies SubmitJob, { singletonKey: `autosubmit:${claimId}:${new Date().toISOString().slice(0, 10)}` });
          }
          console.log(`[claims] auto-submit sweep queued ${claimIds.length} ready claim(s) for org ${orgId} practice ${practiceId}`);
        }
      });
    }
  });

  // Timely filing: the claim that looks normal right up until it is uncollectible.
  await boss.work(Q.claimTimelyFilingSweep, { batchSize: 1 }, async () => {
    for (const orgId of await listOrganizationIds()) {
      await forOrg(orgId, 'claim.timely-filing.sweep', async (ctx) => {
        const at = await ctx.tx
          .select({ id: schema.claims.id, claimNumber: schema.claims.claimNumber, practiceId: schema.claims.practiceId, patientId: schema.claims.patientId, deadline: schema.claims.timelyFilingDeadline, status: schema.claims.status })
          .from(schema.claims)
          .where(and(sql`status in ('draft','scrubbing','needs_review','ready','rejected','secondary_ready')`, sql`timely_filing_deadline is not null`, sql`timely_filing_deadline <= current_date + interval '14 days'`));
        for (const c of at) {
          const daysLeft = Math.round((Date.parse(c.deadline! + 'T00:00:00Z') - ctx.now().getTime()) / 86_400_000);
          await createTask(ctx, {
            queueKey: 'timely-filing', practiceId: c.practiceId, subjectType: 'claim', subjectId: c.id, patientId: c.patientId,
            title: daysLeft < 0 ? `${c.claimNumber} missed its filing deadline ${-daysLeft} days ago (${c.status})` : `${c.claimNumber} must be filed within ${daysLeft} days (${c.status})`,
            detail: { deadline: c.deadline, daysLeft, status: c.status }, priority: daysLeft <= 3 ? 'urgent' : 'high', suggestedAction: 'submit', dueAt: new Date(c.deadline! + 'T00:00:00Z'), dedupeKey: `tf:${c.id}:${c.deadline}`,
          });
          await emit(ctx, 'claim.timely_filing_at_risk', 'claim', c.id, { claimNumber: c.claimNumber, deadline: c.deadline, daysLeft }, `tf:${c.id}:${c.deadline}`);
        }
        if (at.length) console.log(`[timely-filing] ${orgId}: ${at.length} claims at risk`);
      });
    }
  });
}
