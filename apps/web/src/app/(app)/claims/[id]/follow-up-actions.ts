'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent, recordActivity } from '@grove/audit';
import { eq, schema } from '@grove/db';
import { createTask, emit, runEligibilityCheckCommand, transitionClaim } from '@grove/domain';
import { pageContext } from '@/lib/session';

export interface FollowUpUpdate {
  assignedTo?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: 'open' | 'in_progress' | 'waiting' | 'snoozed' | 'resolved' | 'cancelled';
  dueAt?: string | null;
  resolutionNote?: string;
}

/** Edits a claim's follow-up task in place — the same `tasks` row the work queues run on. */
export async function updateClaimFollowUpAction(claimId: string, taskId: string, updates: FollowUpUpdate) {
  const { run, session } = await pageContext();
  await run(`/claims/${claimId}/follow-up`, async (ctx) => {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.assignedTo !== undefined) {
      set.assignedTo = updates.assignedTo || null;
      set.assignedAt = updates.assignedTo ? new Date() : null;
    }
    if (updates.priority !== undefined) set.priority = updates.priority;
    if (updates.status !== undefined) {
      set.status = updates.status;
      if (updates.status === 'resolved') {
        set.resolvedAt = new Date();
        set.resolvedBy = session.actor.userId;
      }
    }
    if (updates.dueAt !== undefined) set.dueAt = updates.dueAt ? new Date(updates.dueAt) : null;
    if (updates.resolutionNote !== undefined) set.resolutionNote = updates.resolutionNote;

    await ctx.tx.update(schema.tasks).set(set).where(eq(schema.tasks.id, taskId));
    await ctx.tx.insert(schema.taskEvents).values({
      orgId: ctx.tenant.orgId,
      taskId,
      eventType: 'status_changed',
      actorUserId: session.actor.userId,
      detail: updates,
    });
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'update',
      resourceType: 'task',
      resourceId: taskId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { action: 'follow_up_update', ...updates },
    });
  });

  revalidatePath(`/claims/${claimId}`);
}

/** Files a new follow-up task against a claim that doesn't have one yet. */
export async function createClaimFollowUpAction(claimId: string, params: { queueKey: string; title?: string; priority?: 'low' | 'normal' | 'high' | 'urgent'; dueAt?: string | null }) {
  const { run } = await pageContext();
  await run(`/claims/${claimId}/follow-up`, async (ctx) => {
    const [claim] = await ctx.tx
      .select({ practiceId: schema.claims.practiceId, patientId: schema.claims.patientId, claimNumber: schema.claims.claimNumber })
      .from(schema.claims)
      .where(eq(schema.claims.id, claimId));
    if (!claim) throw new Error('Claim not found');

    await createTask(ctx, {
      queueKey: params.queueKey,
      practiceId: claim.practiceId,
      subjectType: 'claim',
      subjectId: claimId,
      patientId: claim.patientId,
      title: params.title?.trim() || `Follow up: ${claim.claimNumber}`,
      priority: params.priority ?? 'normal',
      dueAt: params.dueAt ? new Date(params.dueAt) : null,
      dedupeKey: `manual-followup:${claimId}:${Date.now()}`,
    });
  });

  revalidatePath(`/claims/${claimId}`);
}

/** Runs a fresh 270/271 eligibility check for this claim's coverage, on demand. */
export async function checkClaimEligibilityAction(claimId: string) {
  const { run } = await pageContext();
  const result = await run(`/claims/${claimId}/eligibility-check`, async (ctx) => {
    const [claim] = await ctx.tx
      .select({ coverageId: schema.claims.coverageId, serviceDateFrom: schema.claims.serviceDateFrom, encounterId: schema.claims.encounterId })
      .from(schema.claims)
      .where(eq(schema.claims.id, claimId));
    if (!claim) throw new Error('Claim not found');
    return runEligibilityCheckCommand(ctx, {
      coverageId: claim.coverageId,
      trigger: 'manual',
      serviceDate: claim.serviceDateFrom,
      encounterId: claim.encounterId,
    });
  });

  revalidatePath(`/claims/${claimId}`);
  return result;
}

/** Runs a real-time ASC X12 276/277 claim status inquiry against the clearinghouse, on demand. */
export async function checkClaimStatusNowAction(claimId: string): Promise<{ ok: true; statusDescription: string | null; isFinal: boolean } | { ok: false; error: string }> {
  const { run } = await pageContext();
  const result = await run(`/claims/${claimId}/status-check`, async (ctx) => {
    try {
      const [claim] = await ctx.tx.select().from(schema.claims).where(eq(schema.claims.id, claimId));
      if (!claim) return { ok: false as const, error: 'Claim not found.' };

      const [patient] = await ctx.tx.select().from(schema.patients).where(eq(schema.patients.id, claim.patientId));
      const [coverage] = await ctx.tx.select().from(schema.coverages).where(eq(schema.coverages.id, claim.coverageId));
      const [practice] = await ctx.tx.select().from(schema.practices).where(eq(schema.practices.id, claim.practiceId));
      const [payer] = await ctx.tx.select().from(schema.payers).where(eq(schema.payers.id, claim.payerId));
      if (!patient || !coverage || !practice || !payer) return { ok: false as const, error: 'Missing claim details.' };

      const result = await ctx.clearinghouse.checkClaimStatus({
        payerId: payer.payerIdCode ?? '', patientControlNumber: claim.claimNumber, payerClaimControlNumber: claim.payerClaimControlNumber ?? undefined,
        billingProviderNpi: practice.npi ?? '', subscriberMemberId: coverage.memberId,
        subscriber: { lastName: patient.lastName, firstName: patient.firstName, dateOfBirth: patient.dateOfBirth },
        serviceDateFrom: claim.serviceDateFrom, serviceDateTo: claim.serviceDateThrough ?? claim.serviceDateFrom,
        totalChargeCents: claim.totalChargeCents, traceNumber: `${claim.claimNumber}-manual-${Date.now()}`,
      });

      await ctx.tx.insert(schema.claimStatusChecks).values({
        orgId: ctx.tenant.orgId, claimId, connector: ctx.clearinghouse.name, requestedAt: ctx.now(), respondedAt: ctx.now(),
        statusCategoryCode: result.statusCategoryCode, statusCode: result.statusCode, statusDescription: result.statusDescription ?? null,
        isFinal: result.isFinal, paidAmountCents: result.paidAmountCents ?? null, effectiveDate: result.effectiveDate ?? null, rawResponse: result.raw277 ?? null,
      });
      if (result.payerClaimControlNumber && !claim.payerClaimControlNumber) {
        await ctx.tx.update(schema.claims).set({ payerClaimControlNumber: result.payerClaimControlNumber }).where(eq(schema.claims.id, claimId));
      }

      await emit(ctx, 'claim.status_updated', 'claim', claimId, { claimNumber: claim.claimNumber, statusCategoryCode: result.statusCategoryCode, statusCode: result.statusCode, isFinal: result.isFinal });
      await recordActivity(ctx.tx, {
        orgId: ctx.tenant.orgId, practiceId: claim.practiceId, subjectType: 'claim', subjectId: claimId,
        verb: 'claim.status_updated',
        summary: `payer reports ${result.statusDescription ?? result.statusCategoryCode}${result.paidAmountCents ? ` — $${(result.paidAmountCents / 100).toFixed(2)}` : ''}`,
        actorType: 'user',
      });

      if (!result.isFinal && claim.status !== 'in_process' && result.statusCategoryCode.startsWith('A')) {
        await transitionClaim(ctx, claimId, 'in_process', 'status_check', result.statusDescription);
      }

      return { ok: true as const, statusDescription: result.statusDescription ?? null, isFinal: result.isFinal };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : 'Failed to check claim status.' };
    }
  });

  revalidatePath(`/claims/${claimId}`);
  return (result && typeof result === 'object' && 'ok' in result ? result : { ok: false, error: 'Unavailable in demo mode.' }) as any;
}
