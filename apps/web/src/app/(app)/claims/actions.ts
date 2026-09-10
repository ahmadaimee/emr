'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, schema } from '@grove/db';
import { DomainError, scrubClaimCommand, submitClaimCommand, transitionClaim } from '@grove/domain';
import { pageContext } from '@/lib/session';

export async function bulkSubmitAction(claimIds: string[]): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  const { run } = await pageContext();
  let succeeded = 0;
  const errors: string[] = [];
  for (const id of claimIds.slice(0, 100)) {
    try {
      await run('/claims/bulk-submit', (ctx) => submitClaimCommand(ctx, id, { acknowledgeWarnings: true }));
      succeeded++;
    } catch (err) {
      const e = err as DomainError;
      errors.push(`${e.message}`);
    }
  }
  revalidatePath('/claims');
  return { succeeded, failed: errors.length, errors };
}

export async function scrubAction(claimId: string) {
  const { run } = await pageContext();
  await run('/claims/scrub', (ctx) => scrubClaimCommand(ctx, claimId));
  revalidatePath(`/claims/${claimId}`);
}

export async function submitAction(claimId: string, acknowledgeWarnings: boolean): Promise<{ ok: boolean; message: string }> {
  const { run } = await pageContext();
  try {
    const r = await run('/claims/submit', (ctx) => submitClaimCommand(ctx, claimId, { acknowledgeWarnings }));
    revalidatePath(`/claims/${claimId}`);
    return { ok: true, message: `Submitted as attempt via ${r.connectorSubmissionId || 'connector'}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function overrideFindingAction(findingId: string, claimId: string, reason: string) {
  const { run, session } = await pageContext();
  await run('/claims/override-finding', async (ctx) => {
    await ctx.tx.update(schema.ruleFindings).set({ status: 'overridden', overriddenBy: session.actor.userId, overrideReason: reason, overriddenAt: new Date() }).where(eq(schema.ruleFindings.id, findingId));
  });
  revalidatePath(`/claims/${claimId}`);
}

export async function voidClaimAction(claimId: string, reason: string) {
  const { run } = await pageContext();
  await run('/claims/void', (ctx) => transitionClaim(ctx, claimId, 'voided', 'user', reason));
  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}`);
}

export async function updateClaimFilingAction(
  claimId: string,
  params: {
    claimType?: '837P' | '837I' | '837D';
    claimFrequencyCode?: string;
    originalPayerControlNumber?: string;
    coverageRank?: 'primary' | 'secondary' | 'tertiary';
    priorAuthNumber?: string;
  }
) {
  const { run } = await pageContext();
  await run(`/claims/${claimId}/update-filing`, async (ctx) => {
    try {
      await ctx.tx
        .update(schema.claims)
        .set({
          coverageRank: params.coverageRank as any,
          priorAuthNumber: params.priorAuthNumber,
          updatedAt: new Date(),
        })
        .where(eq(schema.claims.id, claimId));
    } catch {}
  });

  try {
    const { updateMockClaimFiling } = await import('@/lib/mock-data');
    updateMockClaimFiling(claimId, params);
  } catch {}

  revalidatePath(`/claims/${claimId}`);
  revalidatePath(`/claims/${claimId}/hcfa`);
}

export async function addClaimNoteAction(
  claimId: string,
  params: { category: string; content: string }
) {
  const { run, session } = await pageContext();
  await run(`/claims/${claimId}/add-note`, async (ctx) => {
    try {
      await ctx.tx.insert(schema.activityEvents).values({
        orgId: ctx.tenant.orgId,
        actorType: 'user',
        actorUserId: session.actor.userId,
        actorLabel: session.actor.email,
        subjectType: 'claim',
        subjectId: claimId,
        verb: 'claim.note_added',
        summary: `[${params.category}] ${params.content}`,
        occurredAt: new Date(),
      } as any);
    } catch {}
  });

  try {
    const { addMockClaimNote } = await import('@/lib/mock-data');
    addMockClaimNote(claimId, {
      category: params.category,
      content: params.content,
      author: session.actor.email.split('@')[0],
      authorRole: 'Operator',
    });
  } catch {}

  revalidatePath(`/claims/${claimId}`);
}

export async function dismissPatientAlertAction(patientId: string) {
  try {
    const { dismissMockPatientAlert } = await import('@/lib/mock-data');
    dismissMockPatientAlert(patientId);
  } catch {}
}

