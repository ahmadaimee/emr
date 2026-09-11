'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, schema, sql } from '@grove/db';
import { scrubClaimCommand } from '@grove/domain';
import { pageContext } from '@/lib/session';

/**
 * A claim's codes, lines, and providers are frozen the moment it's been transmitted —
 * editing after that point would silently diverge the claim from what the payer
 * actually received. Mirrors the `canSubmit` gate in the workspace UI.
 */
const EDITABLE_STATUSES = new Set(['draft', 'needs_review', 'ready', 'rejected', 'secondary_ready']);

async function loadEditableClaim(ctx: { tx: any; tenant: { orgId: string } }, claimId: string) {
  const [claim] = await ctx.tx.select().from(schema.claims).where(eq(schema.claims.id, claimId));
  if (!claim) throw new Error('Claim not found.');
  if (!EDITABLE_STATUSES.has(claim.status)) throw new Error(`Claim is ${claim.status.replace(/_/g, ' ')} and can no longer be edited.`);
  return claim;
}

async function recomputeClaimTotals(ctx: { tx: any }, claimId: string, encounterId: string) {
  const lines = await ctx.tx.select({ chargeCents: schema.serviceLines.chargeCents }).from(schema.serviceLines).where(eq(schema.serviceLines.encounterId, encounterId));
  const totalChargeCents = lines.reduce((s: number, l: { chargeCents: number }) => s + l.chargeCents, 0);
  await ctx.tx.update(schema.encounters).set({ totalChargeCents, updatedAt: new Date() }).where(eq(schema.encounters.id, encounterId));
  await ctx.tx.update(schema.claims).set({ totalChargeCents, balanceCents: totalChargeCents, updatedAt: new Date() }).where(eq(schema.claims.id, claimId));
}

/** Replaces the encounter's ordered diagnosis list. Refuses if a line still points past the new length. */
export async function updateClaimDiagnosesAction(claimId: string, diagnosisCodes: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const { run } = await pageContext();
  return run(`/claims/${claimId}/diagnoses`, async (ctx) => {
    try {
      const claim = await loadEditableClaim(ctx, claimId);
      const codes = diagnosisCodes.map((d) => d.trim().toUpperCase()).filter(Boolean).slice(0, 12);
      if (codes.length === 0) return { ok: false, error: 'A claim needs at least one diagnosis code.' };

      const lines = await ctx.tx.select({ diagnosisPointers: schema.serviceLines.diagnosisPointers }).from(schema.serviceLines).where(eq(schema.serviceLines.encounterId, claim.encounterId));
      const maxPointerUsed = Math.max(0, ...lines.flatMap((l: { diagnosisPointers: number[] }) => l.diagnosisPointers));
      if (maxPointerUsed > codes.length) {
        return { ok: false, error: `Service line(s) point at diagnosis #${maxPointerUsed}; remove or repoint them before deleting that code.` };
      }

      await ctx.tx.update(schema.encounters).set({ diagnosisCodes: codes, updatedAt: new Date() }).where(eq(schema.encounters.id, claim.encounterId));
      await scrubClaimCommand(ctx, claimId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update diagnoses.' };
    }
  }).then((r: any) => (r && typeof r === 'object' && 'ok' in r ? r : { ok: true as const })).finally(() => revalidatePath(`/claims/${claimId}`));
}

export interface ServiceLineInput {
  procedureCode: string;
  modifiers: string[];
  units: number;
  chargeCents: number;
  diagnosisPointers: number[];
  placeOfService?: string;
}

export async function addClaimServiceLineAction(claimId: string, line: ServiceLineInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const { run } = await pageContext();
  return run(`/claims/${claimId}/lines`, async (ctx) => {
    try {
      const claim = await loadEditableClaim(ctx, claimId);
      const [encounter] = await ctx.tx.select().from(schema.encounters).where(eq(schema.encounters.id, claim.encounterId));
      if (!encounter) return { ok: false, error: 'Encounter not found for this claim.' };
      const procedureCode = line.procedureCode.trim().toUpperCase();
      if (!procedureCode) return { ok: false, error: 'A procedure code is required.' };
      if (!(line.chargeCents > 0)) return { ok: false, error: 'Charge must be greater than zero.' };
      const pointers = line.diagnosisPointers.length ? line.diagnosisPointers : [1];
      if (pointers.some((p) => p < 1 || p > encounter.diagnosisCodes.length)) return { ok: false, error: 'Diagnosis pointer is out of range for this claim.' };

      const [maxLineRow] = await ctx.tx.select({ maxLine: sql<number>`coalesce(max(${schema.serviceLines.lineNumber}), 0)` }).from(schema.serviceLines).where(eq(schema.serviceLines.encounterId, claim.encounterId));

      await ctx.tx.insert(schema.serviceLines).values({
        orgId: ctx.tenant.orgId,
        encounterId: claim.encounterId,
        lineNumber: (maxLineRow?.maxLine ?? 0) + 1,
        procedureCode,
        modifier1: line.modifiers[0] || null,
        modifier2: line.modifiers[1] || null,
        modifier3: line.modifiers[2] || null,
        modifier4: line.modifiers[3] || null,
        diagnosisPointers: pointers,
        units: line.units || 1,
        chargeCents: line.chargeCents,
        serviceDate: encounter.serviceDate,
        placeOfService: line.placeOfService || null,
      });

      await recomputeClaimTotals(ctx, claimId, claim.encounterId);
      await scrubClaimCommand(ctx, claimId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to add the service line.' };
    }
  }).then((r: any) => (r && typeof r === 'object' && 'ok' in r ? r : { ok: true as const })).finally(() => revalidatePath(`/claims/${claimId}`));
}

export async function updateClaimServiceLineAction(claimId: string, lineId: string, updates: Partial<ServiceLineInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { run } = await pageContext();
  return run(`/claims/${claimId}/lines`, async (ctx) => {
    try {
      const claim = await loadEditableClaim(ctx, claimId);
      const [line] = await ctx.tx.select().from(schema.serviceLines).where(and(eq(schema.serviceLines.id, lineId), eq(schema.serviceLines.encounterId, claim.encounterId)));
      if (!line) return { ok: false, error: 'Service line not found on this claim.' };

      const set: Record<string, unknown> = {};
      if (updates.procedureCode !== undefined) {
        const code = updates.procedureCode.trim().toUpperCase();
        if (!code) return { ok: false, error: 'A procedure code is required.' };
        set.procedureCode = code;
      }
      if (updates.modifiers !== undefined) {
        set.modifier1 = updates.modifiers[0] || null;
        set.modifier2 = updates.modifiers[1] || null;
        set.modifier3 = updates.modifiers[2] || null;
        set.modifier4 = updates.modifiers[3] || null;
      }
      if (updates.units !== undefined) set.units = updates.units || 1;
      if (updates.chargeCents !== undefined) {
        if (!(updates.chargeCents > 0)) return { ok: false, error: 'Charge must be greater than zero.' };
        set.chargeCents = updates.chargeCents;
      }
      if (updates.diagnosisPointers !== undefined) {
        const [encounter] = await ctx.tx.select({ diagnosisCodes: schema.encounters.diagnosisCodes }).from(schema.encounters).where(eq(schema.encounters.id, claim.encounterId));
        const pointers = updates.diagnosisPointers.length ? updates.diagnosisPointers : [1];
        if (!encounter || pointers.some((p) => p < 1 || p > encounter.diagnosisCodes.length)) return { ok: false, error: 'Diagnosis pointer is out of range for this claim.' };
        set.diagnosisPointers = pointers;
      }
      if (updates.placeOfService !== undefined) set.placeOfService = updates.placeOfService || null;
      set.updatedAt = new Date();

      await ctx.tx.update(schema.serviceLines).set(set).where(eq(schema.serviceLines.id, lineId));
      if (updates.chargeCents !== undefined) await recomputeClaimTotals(ctx, claimId, claim.encounterId);
      await scrubClaimCommand(ctx, claimId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update the service line.' };
    }
  }).then((r: any) => (r && typeof r === 'object' && 'ok' in r ? r : { ok: true as const })).finally(() => revalidatePath(`/claims/${claimId}`));
}

export async function removeClaimServiceLineAction(claimId: string, lineId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { run } = await pageContext();
  return run(`/claims/${claimId}/lines`, async (ctx) => {
    try {
      const claim = await loadEditableClaim(ctx, claimId);
      const lines = await ctx.tx.select({ id: schema.serviceLines.id }).from(schema.serviceLines).where(eq(schema.serviceLines.encounterId, claim.encounterId)).orderBy(asc(schema.serviceLines.lineNumber));
      if (lines.length <= 1) return { ok: false, error: 'A claim needs at least one service line.' };

      await ctx.tx.delete(schema.serviceLines).where(eq(schema.serviceLines.id, lineId));

      const remaining = lines.filter((l: { id: string }) => l.id !== lineId);
      for (const [i, l] of remaining.entries()) {
        await ctx.tx.update(schema.serviceLines).set({ lineNumber: i + 1 }).where(eq(schema.serviceLines.id, l.id));
      }

      await recomputeClaimTotals(ctx, claimId, claim.encounterId);
      await scrubClaimCommand(ctx, claimId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to remove the service line.' };
    }
  }).then((r: any) => (r && typeof r === 'object' && 'ok' in r ? r : { ok: true as const })).finally(() => revalidatePath(`/claims/${claimId}`));
}

export interface ProviderRoleUpdates {
  renderingProviderId?: string;
  billingProviderId?: string | null;
  supervisingProviderId?: string | null;
  referringProviderId?: string | null;
}

export async function updateClaimProvidersAction(claimId: string, updates: ProviderRoleUpdates): Promise<{ ok: true } | { ok: false; error: string }> {
  const { run } = await pageContext();
  return run(`/claims/${claimId}/providers`, async (ctx) => {
    try {
      const claim = await loadEditableClaim(ctx, claimId);
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.renderingProviderId !== undefined) {
        if (!updates.renderingProviderId) return { ok: false, error: 'A rendering provider is required.' };
        set.renderingProviderId = updates.renderingProviderId;
      }
      if (updates.billingProviderId !== undefined) set.billingProviderId = updates.billingProviderId || null;
      if (updates.supervisingProviderId !== undefined) set.supervisingProviderId = updates.supervisingProviderId || null;
      if (updates.referringProviderId !== undefined) set.referringProviderId = updates.referringProviderId || null;

      await ctx.tx.update(schema.encounters).set(set).where(eq(schema.encounters.id, claim.encounterId));
      await scrubClaimCommand(ctx, claimId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update providers.' };
    }
  }).then((r: any) => (r && typeof r === 'object' && 'ok' in r ? r : { ok: true as const })).finally(() => revalidatePath(`/claims/${claimId}`));
}

export interface ClaimDataInput {
  relatedToEmployment?: boolean;
  relatedToAutoAccident?: boolean;
  relatedToOtherAccident?: boolean;
  accidentState?: string | null;
  accidentDate?: string | null;
  onsetDate?: string | null;
  initialTreatmentDate?: string | null;
  lastSeenDate?: string | null;
  hospitalizedFrom?: string | null;
  hospitalizedTo?: string | null;
  disabilityFrom?: string | null;
  disabilityTo?: string | null;
  outsideLabPerformed?: boolean;
  outsideLabChargesCents?: number | null;
  additionalClaimInfo?: string | null;
}

/** CMS-1500 items 10, 14-20 — condition, dates, hospitalization, outside lab, and free-text claim info. */
export async function updateClaimDataAction(claimId: string, updates: ClaimDataInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const { run } = await pageContext();
  return run(`/claims/${claimId}/data`, async (ctx) => {
    try {
      const claim = await loadEditableClaim(ctx, claimId);
      const set: Record<string, unknown> = { updatedAt: new Date() };
      for (const key of ['relatedToEmployment', 'relatedToAutoAccident', 'relatedToOtherAccident', 'outsideLabPerformed'] as const) {
        if (updates[key] !== undefined) set[key] = updates[key];
      }
      for (const key of ['accidentState', 'accidentDate', 'onsetDate', 'initialTreatmentDate', 'lastSeenDate', 'hospitalizedFrom', 'hospitalizedTo', 'disabilityFrom', 'disabilityTo', 'additionalClaimInfo'] as const) {
        if (updates[key] !== undefined) set[key] = updates[key] || null;
      }
      if (updates.outsideLabChargesCents !== undefined) set.outsideLabChargesCents = updates.outsideLabChargesCents ?? null;

      await ctx.tx.update(schema.encounters).set(set).where(eq(schema.encounters.id, claim.encounterId));
      await scrubClaimCommand(ctx, claimId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update claim data.' };
    }
  }).then((r: any) => (r && typeof r === 'object' && 'ok' in r ? r : { ok: true as const })).finally(() => revalidatePath(`/claims/${claimId}`));
}

/** 837 CLM20 — the code that justifies filing this claim past the payer's timely filing window. */
export async function updateClaimHeaderAction(claimId: string, updates: { delayReasonCode?: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { run } = await pageContext();
  return run(`/claims/${claimId}/header`, async (ctx) => {
    try {
      await loadEditableClaim(ctx, claimId);
      await ctx.tx.update(schema.claims).set({ delayReasonCode: updates.delayReasonCode || null, updatedAt: new Date() }).where(eq(schema.claims.id, claimId));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update claim header.' };
    }
  }).then((r: any) => (r && typeof r === 'object' && 'ok' in r ? r : { ok: true as const })).finally(() => revalidatePath(`/claims/${claimId}`));
}
