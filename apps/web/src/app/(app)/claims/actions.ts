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
