'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, schema } from '@grove/db';
import { createClaimCommand, DomainError, scrubClaimCommand, setClaimCustomStatusCommand, submitClaimCommand, transitionClaim } from '@grove/domain';
import { pageContext } from '@/lib/session';

export interface NewClaimLineInput {
  procedureCode: string;
  modifiers: string[];
  units: number;
  chargeCents: number;
  diagnosisPointers: number[];
}

export type CreateClaimResult = { ok: true; claimId: string; claimNumber: string } | { ok: false; error: string };

/**
 * A claim is always built from an encounter with billed service lines — there is no
 * such thing as a claim with nothing on it. This creates the supporting encounter and
 * lines directly (there is no separate "start an encounter" step in this app yet),
 * then hands off to `createClaimCommand`, which is what actually prices the claim and
 * posts the charge to the ledger.
 */
export async function createClaimAction(input: {
  patientId: string;
  renderingProviderId: string;
  serviceDate: string;
  placeOfService: string;
  diagnosisCodes: string[];
  lines: NewClaimLineInput[];
}): Promise<CreateClaimResult> {
  if (!input.patientId) return { ok: false, error: 'Select a patient.' };
  if (!input.renderingProviderId) return { ok: false, error: 'Select a rendering provider.' };
  if (!input.serviceDate) return { ok: false, error: 'Service date is required.' };

  const diagnosisCodes = input.diagnosisCodes.map((d) => d.trim().toUpperCase()).filter(Boolean);
  if (diagnosisCodes.length === 0) return { ok: false, error: 'At least one diagnosis code is required.' };

  const lines = input.lines
    .map((l) => ({ ...l, procedureCode: l.procedureCode.trim().toUpperCase(), units: l.units || 1 }))
    .filter((l) => l.procedureCode && l.chargeCents > 0);
  if (lines.length === 0) return { ok: false, error: 'Add at least one service line with a procedure code and a charge.' };

  const { run } = await pageContext();

  const result = await run('/claims/new', async (ctx) => {
    try {
      const [patient] = await ctx.tx.select().from(schema.patients).where(eq(schema.patients.id, input.patientId));
      if (!patient) return { ok: false as const, error: 'Patient not found.' };

      const [location] = await ctx.tx.select().from(schema.locations).where(eq(schema.locations.practiceId, patient.practiceId)).limit(1);
      if (!location) return { ok: false as const, error: 'No service location is configured for this patient’s practice yet.' };

      const encounterNumber = `ENC-${Date.now().toString(36).toUpperCase()}`;
      const totalChargeCents = lines.reduce((s, l) => s + l.chargeCents, 0);

      const [encounter] = await ctx.tx
        .insert(schema.encounters)
        .values({
          orgId: ctx.tenant.orgId,
          practiceId: patient.practiceId,
          patientId: patient.id,
          locationId: location.id,
          encounterNumber,
          status: 'ready_to_bill',
          serviceDate: input.serviceDate,
          renderingProviderId: input.renderingProviderId,
          placeOfService: input.placeOfService,
          diagnosisCodes,
          totalChargeCents,
        })
        .returning({ id: schema.encounters.id });
      const encounterId = encounter!.id;

      for (const [i, l] of lines.entries()) {
        await ctx.tx.insert(schema.serviceLines).values({
          orgId: ctx.tenant.orgId,
          encounterId,
          lineNumber: i + 1,
          procedureCode: l.procedureCode,
          modifier1: l.modifiers[0] || null,
          modifier2: l.modifiers[1] || null,
          modifier3: l.modifiers[2] || null,
          modifier4: l.modifiers[3] || null,
          diagnosisPointers: l.diagnosisPointers.length ? l.diagnosisPointers : [1],
          units: l.units,
          chargeCents: l.chargeCents,
          serviceDate: input.serviceDate,
          placeOfService: input.placeOfService,
        });
      }

      const res = await createClaimCommand(ctx, { encounterId });
      return { ok: true as const, claimId: res.claimId, claimNumber: res.claimNumber };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to create the claim.' };
    }
  });

  if (result?.ok) {
    revalidatePath('/claims');
    revalidatePath(`/claims/${result.claimId}`);
    revalidatePath('/dashboard');
    return result;
  }
  return result ?? { ok: false, error: 'Database unavailable — the claim could not be created.' };
}

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
  let actorEmail = '';
  await run(`/claims/${claimId}/add-note`, async (ctx) => {
    try {
      const [user] = await ctx.tx.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, session.actor.userId));
      actorEmail = user?.email ?? '';
      await ctx.tx.insert(schema.activityEvents).values({
        orgId: ctx.tenant.orgId,
        actorType: 'user',
        actorUserId: session.actor.userId,
        actorLabel: actorEmail,
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
      author: actorEmail ? actorEmail.split('@')[0] : session.actor.userId,
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

export async function setCustomStatusAction(claimId: string, statusId: string | null): Promise<{ ok: boolean; error?: string }> {
  const { run } = await pageContext();
  const result = await run(`/claims/${claimId}/custom-status`, async (ctx) => {
    try {
      await setClaimCustomStatusCommand(ctx, claimId, statusId);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to update the status tag.' };
    }
  });
  revalidatePath(`/claims/${claimId}`);
  revalidatePath('/claims');
  return result ?? { ok: false, error: 'Database unavailable.' };
}

