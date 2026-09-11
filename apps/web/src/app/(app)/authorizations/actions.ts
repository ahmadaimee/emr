'use server';

import { revalidatePath } from 'next/cache';
import { DomainError, linkAuthorizationToClaimCommand, recordAuthorizationDecisionCommand, requestAuthorizationCommand } from '@grove/domain';
import { pageContext } from '@/lib/session';

export type ActionResult<T = undefined> = ({ ok: true } & (T extends undefined ? {} : { data: T })) | { ok: false; error: string };

export async function createAuthorizationAction(input: {
  patientId: string;
  payerId: string;
  renderingProviderId?: string;
  urgency: 'routine' | 'urgent';
  procedureCode: string;
  diagnosisCode: string;
  unitsRequested: number;
  serviceDateFrom: string;
  notes?: string;
}): Promise<ActionResult<{ authorizationId: string }>> {
  if (!input.patientId) return { ok: false, error: 'Select a patient.' };
  if (!input.payerId) return { ok: false, error: 'Select a payer.' };
  if (!input.procedureCode.trim()) return { ok: false, error: 'A procedure code is required.' };
  if (!input.diagnosisCode.trim()) return { ok: false, error: 'A diagnosis code is required.' };

  const { run } = await pageContext();
  const result = await run('/authorizations/new', async (ctx) => {
    try {
      const res = await requestAuthorizationCommand(ctx, {
        patientId: input.patientId,
        payerId: input.payerId,
        renderingProviderId: input.renderingProviderId,
        urgency: input.urgency,
        procedureCodes: [input.procedureCode.trim().toUpperCase()],
        diagnosisCodes: [input.diagnosisCode.trim().toUpperCase()],
        serviceDateFrom: input.serviceDateFrom,
        unitsRequested: input.unitsRequested,
        notes: input.notes,
      });
      return { ok: true as const, data: { authorizationId: res.authorizationId } };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to create the authorization request.' };
    }
  });

  if (result?.ok) {
    revalidatePath('/authorizations');
    return result;
  }
  return result ?? { ok: false, error: 'Database unavailable — the request could not be saved.' };
}

export async function recordAuthorizationDecisionAction(
  authorizationId: string,
  decision: { status: 'approved' | 'partially_approved' | 'denied'; authorizationNumber?: string; unitsApproved?: number; expiresOn?: string; payerResponseMessage?: string },
): Promise<ActionResult> {
  const { run } = await pageContext();
  const result = await run('/authorizations/decision', async (ctx) => {
    try {
      await recordAuthorizationDecisionCommand(ctx, authorizationId, decision);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to record the decision.' };
    }
  });
  revalidatePath('/authorizations');
  return result ?? { ok: false, error: 'Database unavailable.' };
}

export async function linkAuthorizationAction(claimId: string, authorizationId: string): Promise<ActionResult> {
  const { run } = await pageContext();
  const result = await run(`/claims/${claimId}/link-authorization`, async (ctx) => {
    try {
      await linkAuthorizationToClaimCommand(ctx, claimId, authorizationId);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to link the authorization.' };
    }
  });
  revalidatePath(`/claims/${claimId}`);
  return result ?? { ok: false, error: 'Database unavailable.' };
}
