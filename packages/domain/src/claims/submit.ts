import { createHash } from 'node:crypto';
import { canonicalize, recordActivity } from '@grove/audit';
import { assertCan } from '@grove/auth';
import { desc, eq, schema, sql } from '@grove/db';
import { buildInterchange, generate837P, IMPLEMENTATIONS, serialize } from '@grove/x12';
import { DomainError, type CommandContext } from '../context';
import { emit } from '../outbox';
import { assembleProfessionalClaim, loadClaimAssembly } from './assembly';
import { transitionClaim } from './lifecycle';
import { scrubClaimCommand } from './scrub';

export interface SubmitClaimOptions {
  /** Submit despite warning-level findings. Error-level findings always block. */
  acknowledgeWarnings?: boolean;
}

export interface SubmitClaimResult {
  claimId: string;
  claimNumber: string;
  claimVersionId: string;
  submissionId: string;
  connectorSubmissionId: string;
  status: string;
}

/**
 * Snapshot, generate, transmit. The claim content is frozen into `claim_versions`
 * BEFORE transmission so what we sent is provably what we recorded.
 */
export async function submitClaimCommand(ctx: CommandContext, claimId: string, opts: SubmitClaimOptions = {}): Promise<SubmitClaimResult> {
  const a0 = await loadClaimAssembly(ctx, claimId);
  if (ctx.actor) assertCan(ctx.actor, 'claim:submit', { practiceId: a0.claim.practiceId });

  // Always scrub immediately before submission; master data may have changed.
  const scrub = await scrubClaimCommand(ctx, claimId);
  if (scrub.errorCount > 0) {
    throw new DomainError(`Claim has ${scrub.errorCount} unresolved scrub errors`, 'claim_not_scrubbable', 422, { findings: scrub.findings });
  }
  if (scrub.warningCount > 0 && !opts.acknowledgeWarnings) {
    throw new DomainError(`Claim has ${scrub.warningCount} warnings; acknowledge them to submit`, 'claim_has_warnings', 422, { findings: scrub.findings });
  }

  const a = await loadClaimAssembly(ctx, claimId);
  const payload = assembleProfessionalClaim(a);
  const contentHash = createHash('sha256').update(canonicalize(payload)).digest('hex');

  // Immutable version. Resubmitting identical content reuses the last version.
  const [last] = await ctx.tx
    .select({ id: schema.claimVersions.id, versionNumber: schema.claimVersions.versionNumber, contentHash: schema.claimVersions.contentHash })
    .from(schema.claimVersions)
    .where(eq(schema.claimVersions.claimId, claimId))
    .orderBy(desc(schema.claimVersions.versionNumber))
    .limit(1);

  let versionId: string;
  if (last && last.contentHash === contentHash) {
    versionId = last.id;
  } else {
    const [v] = await ctx.tx
      .insert(schema.claimVersions)
      .values({
        orgId: ctx.tenant.orgId,
        claimId,
        versionNumber: (last?.versionNumber ?? 0) + 1,
        payload,
        contentHash,
        createdBy: ctx.actor?.userId ?? null,
      })
      .returning({ id: schema.claimVersions.id });
    versionId = v!.id;
  }

  // Control numbers are reserved from never-resetting sequences.
  const [ctl] = await ctx.tx.execute<{ isa: string; gs: string; st: string }>(sql`
    select nextval('x12_isa_control_seq')::text as isa, nextval('x12_gs_control_seq')::text as gs, nextval('x12_st_control_seq')::text as st
  `);
  const isa = Number(ctl!.isa);
  const gs = Number(ctl!.gs);
  const st = Number(ctl!.st);

  const org = a.organization;
  const submitterId = org.ediSubmitterId ?? 'GROVE';
  const receiverId = ctx.clearinghouse.name.toUpperCase();
  const usage = (org.ediUsageIndicator === 'P' ? 'P' : 'T') as 'P' | 'T';

  const body = generate837P([payload], {
    submitter: { name: org.ediSubmitterName ?? org.name.toUpperCase(), id: submitterId, contactName: 'EDI DESK' },
    receiver: { name: receiverId, id: receiverId },
    batchReference: `${a.claim.claimNumber}-${st}`,
    timestamp: ctx.now(),
  });
  const x12 = serialize(
    buildInterchange(
      { sender: { qualifier: 'ZZ', id: submitterId }, receiver: { qualifier: 'ZZ', id: receiverId }, controlNumber: isa, usage, timestamp: ctx.now() },
      { functionalId: 'HC', controlNumber: gs, version: IMPLEMENTATIONS['837P'] },
      [{ type: '837', implementation: IMPLEMENTATIONS['837P'], controlNumber: st, body }],
    ),
  );
  await ctx.tx.update(schema.claimVersions).set({ x12 }).where(eq(schema.claimVersions.id, versionId));

  const [attempt] = await ctx.tx
    .select({ n: sql<number>`coalesce(max(attempt_number), 0)::int` })
    .from(schema.claimSubmissions)
    .where(eq(schema.claimSubmissions.claimId, claimId));
  const attemptNumber = Number(attempt?.n ?? 0) + 1;

  const [submission] = await ctx.tx
    .insert(schema.claimSubmissions)
    .values({
      orgId: ctx.tenant.orgId,
      claimId,
      claimVersionId: versionId,
      attemptNumber,
      status: 'queued',
      connector: ctx.clearinghouse.name,
      isaControlNumber: String(isa).padStart(9, '0'),
      gsControlNumber: String(gs),
      stControlNumber: String(st).padStart(4, '0'),
    })
    .returning({ id: schema.claimSubmissions.id });
  const submissionId = submission!.id;

  await transitionClaim(ctx, claimId, 'queued', ctx.actor ? 'user' : 'system');

  // Transmit. The metered call is recorded whether it succeeds or fails.
  const started = ctx.now();
  let connectorSubmissionId = '';
  let status: string;
  try {
    const result = await ctx.clearinghouse.submitClaim({
      x12,
      patientControlNumbers: [a.claim.claimNumber],
      payerId: a.payer.payerIdCode ?? '',
      usage,
    });
    connectorSubmissionId = result.submissionId;
    const rejected = result.immediateAck?.result === 'R';
    status = rejected ? 'rejected' : 'sent';
    await ctx.tx
      .update(schema.claimSubmissions)
      .set({ status: rejected ? 'rejected' : 'sent', connectorSubmissionId, sentAt: ctx.now(), errorMessage: rejected ? result.immediateAck?.message ?? null : null })
      .where(eq(schema.claimSubmissions.id, submissionId));
    await ctx.tx.insert(schema.externalCalls).values({
      orgId: ctx.tenant.orgId, practiceId: a.claim.practiceId, connector: ctx.clearinghouse.name, operation: 'claim_submit',
      subjectType: 'claim', subjectId: claimId, startedAt: started, durationMs: result.meta.durationMs, httpStatus: result.meta.httpStatus ?? null,
      outcome: 'ok', costCents: result.meta.costCents, triggeredBy: ctx.actor ? 'user' : 'system',
    });
    await transitionClaim(ctx, claimId, 'submitted', ctx.actor ? 'user' : 'system');
    if (rejected) await transitionClaim(ctx, claimId, 'rejected', 'ack', result.immediateAck?.message);
  } catch (err) {
    const message = (err as Error).message;
    await ctx.tx.update(schema.claimSubmissions).set({ status: 'transport_failed', errorMessage: message }).where(eq(schema.claimSubmissions.id, submissionId));
    await ctx.tx.insert(schema.externalCalls).values({
      orgId: ctx.tenant.orgId, practiceId: a.claim.practiceId, connector: ctx.clearinghouse.name, operation: 'claim_submit',
      subjectType: 'claim', subjectId: claimId, startedAt: started, durationMs: ctx.now().getTime() - started.getTime(),
      outcome: 'error', costCents: 0, triggeredBy: ctx.actor ? 'user' : 'system', errorClass: (err as { errorClass?: string }).errorClass ?? 'unknown',
    });
    await transitionClaim(ctx, claimId, 'ready', 'system', `transport failed: ${message}`);
    throw new DomainError(`Submission failed: ${message}`, 'submission_failed', 502);
  }

  await emit(ctx, 'claim.submitted', 'claim', claimId, { claimNumber: a.claim.claimNumber, submissionId, connectorSubmissionId, attemptNumber });
  await recordActivity(ctx.tx, {
    orgId: ctx.tenant.orgId,
    practiceId: a.claim.practiceId,
    subjectType: 'claim',
    subjectId: claimId,
    verb: 'claim.submitted',
    summary: `submitted claim ${a.claim.claimNumber} to ${a.payer.name}${attemptNumber > 1 ? ` (attempt ${attemptNumber})` : ''}`,
    detail: { payerId: a.payer.id, connector: ctx.clearinghouse.name, totalChargeCents: payload.totalChargeCents },
    actorUserId: ctx.actor?.userId ?? null,
    actorType: ctx.actor ? 'user' : 'system',
  });

  return { claimId, claimNumber: a.claim.claimNumber, claimVersionId: versionId, submissionId, connectorSubmissionId, status };
}
