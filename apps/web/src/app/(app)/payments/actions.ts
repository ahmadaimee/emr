'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { eq, inArray, schema } from '@grove/db';
import { DomainError, postRemittanceCommand } from '@grove/domain';
import type { CasAdjustment, Remittance835, RemittanceClaim, RemittanceLine } from '@grove/x12';
import { pageContext } from '@/lib/session';

export async function recordPaymentAction(formData: FormData) {
  const patientId = String(formData.get('patientId') ?? '');
  const amountCents = Math.round(Number(formData.get('amount') ?? 0) * 100);
  const paymentSource = String(formData.get('source') ?? 'patient_card');
  const referenceNumber = String(formData.get('referenceNumber') ?? `REF-${Date.now()}`);
  const notes = String(formData.get('notes') ?? 'Point of care payment');

  const { run, session } = await pageContext();

  await run('/payments', async (ctx) => {
    const practiceId = session.actor.practiceIds?.[0] ?? '00000000-0000-4000-8000-000000000010';
    const today = new Date().toISOString().slice(0, 10);

    // 1. Every payment belongs to a reconciliation batch; a point-of-care payment gets
    // its own single-payment batch, same as post.ts does for an ERA deposit.
    const [batch] = await ctx.tx
      .insert(schema.paymentBatches)
      .values({ orgId: ctx.tenant.orgId, practiceId, batchType: 'patient', depositDate: today, expectedTotalCents: amountCents, postedTotalCents: amountCents, status: 'closed' })
      .returning({ id: schema.paymentBatches.id });

    // 2. Insert payment record
    const [pmt] = await ctx.tx
      .insert(schema.payments)
      .values({
        orgId: ctx.tenant.orgId,
        practiceId,
        paymentBatchId: batch!.id,
        source: paymentSource as any,
        amountCents,
        receivedDate: today,
        patientId: patientId || null,
        reference: referenceNumber,
      })
      .returning({ id: schema.payments.id });

    // 3. Append-only ledger entry (RULE 6)
    if (patientId) {
      await ctx.tx.insert(schema.ledgerEntries).values({
        orgId: ctx.tenant.orgId,
        practiceId,
        patientId,
        entryType: 'payment_patient',
        amountCents: -amountCents, // credits decrease balance
        responsibility: 'patient',
        postingDate: today,
        serviceDate: today,
        sourceType: 'payment',
        sourceId: pmt!.id,
        note: `Payment recorded via ${paymentSource.replace('_', ' ')} (${referenceNumber})`,
      });
    }

    // 3. HMAC-chained audit log (RULE 7)
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'payment',
      resourceId: pmt?.id ?? `pmt-${Date.now()}`,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { amountCents, paymentSource, patientId },
    });
  });

  try {
    const { addMockPayment } = await import('@/lib/mock-data');
    addMockPayment({
      id: `pmt-${Date.now()}`,
      paymentNumber: `PMT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      source: paymentSource,
      amountCents,
      allocatedCents: amountCents,
      unallocatedCents: 0,
      status: 'settled',
      referenceNumber,
      method: paymentSource === 'patient_card' ? 'Visa •••• 4242' : paymentSource.replace(/_/g, ' ').toUpperCase(),
      postedAt: new Date(),
      patientName: 'Miller, Eleanor',
      mrn: 'MRN-44910',
      patientId: patientId || 'pat-1',
      claimNumber: 'CLM-2026-0101',
      practiceName: 'Orchard Family Practice',
    });
  } catch {}

  revalidatePath('/payments');
  revalidatePath('/dashboard');
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

export interface InsuranceAllocation {
  claimId: string;
  claimNumber: string;
  patientName: string;
  billedCents: number;
  allowedCents: number;
  paidCents: number;
  contractualAdjustmentCents: number;
  patientResponsibilityCents: number;
  /** CARC group PR reason — 1 Deductible, 2 Coinsurance, 3 Copayment. */
  prReasonCode?: '1' | '2' | '3';
}

export type PostInsuranceResult =
  | { ok: true; remittanceId: string; status: string }
  | { ok: false; error: string };

/**
 * "Post Insurance Check / EOB" — the manual-entry counterpart to an electronic 835.
 *
 * Not every payer sends an ERA; some still mail a paper EOB or fax one. This builds
 * the same `Remittance835` shape a real 835 parses into and hands it to
 * `postRemittanceCommand`, so a manually keyed check reconciles claim balances, posts
 * ledger entries, classifies denials, and shows up on /remittances exactly like an
 * electronic one would — rather than being a parallel, disconnected payment log.
 */
export async function recordInsurancePaymentAction(params: {
  payerId: string;
  payerName: string;
  paymentType: 'check' | 'eft' | 'virtual_card';
  checkOrEftTraceNumber: string;
  paymentDate: string;
  totalPaidCents: number;
  allocations: InsuranceAllocation[];
}): Promise<PostInsuranceResult> {
  if (!params.checkOrEftTraceNumber.trim()) return { ok: false, error: 'Check / EFT trace number is required.' };
  if (params.allocations.length === 0) return { ok: false, error: 'Add at least one claim to allocate this payment.' };

  const { run, session } = await pageContext();

  const result = await run('/payments/post-insurance', async (ctx) => {
    try {
      const claims = await ctx.tx.select().from(schema.claims).where(inArray(schema.claims.id, params.allocations.map((a) => a.claimId)));
      const claimById = new Map(claims.map((c) => [c.id, c]));

      const encounterIds = [...new Set(claims.map((c) => c.encounterId))];
      const lines = encounterIds.length ? await ctx.tx.select().from(schema.serviceLines).where(inArray(schema.serviceLines.encounterId, encounterIds)) : [];
      const linesByEncounter = new Map<string, typeof lines>();
      for (const l of lines) linesByEncounter.set(l.encounterId, [...(linesByEncounter.get(l.encounterId) ?? []), l]);

      const [payer] = await ctx.tx.select().from(schema.payers).where(eq(schema.payers.id, params.payerId));

      const remitClaims: RemittanceClaim[] = [];
      for (const a of params.allocations) {
        const claim = claimById.get(a.claimId);
        if (!claim) return { ok: false as const, error: `Claim ${a.claimNumber} was not found.` };
        const claimLines = linesByEncounter.get(claim.encounterId) ?? [];
        if (claimLines.length === 0) return { ok: false as const, error: `Claim ${a.claimNumber} has no service lines to allocate this payment against.` };

        // No line-level entry on this form — spread the claim-level paid / adjustment
        // amounts across service lines proportionally to each line's share of the
        // total charge, same as a payer would when its EOB pays a multi-line claim.
        const totalCharge = claimLines.reduce((s, l) => s + l.chargeCents, 0) || 1;
        let remainingPaid = a.paidCents;
        let remainingCo = a.contractualAdjustmentCents;
        let remainingPr = a.patientResponsibilityCents;

        const remitLines: RemittanceLine[] = claimLines.map((line, i) => {
          const isLast = i === claimLines.length - 1;
          const share = line.chargeCents / totalCharge;
          const paid = isLast ? remainingPaid : Math.round(a.paidCents * share);
          const co = isLast ? remainingCo : Math.round(a.contractualAdjustmentCents * share);
          const pr = isLast ? remainingPr : Math.round(a.patientResponsibilityCents * share);
          remainingPaid -= paid;
          remainingCo -= co;
          remainingPr -= pr;

          const adjustments: CasAdjustment[] = [];
          if (co > 0) adjustments.push({ group: 'CO', reasonCode: '45', amountCents: co });
          if (pr > 0) adjustments.push({ group: 'PR', reasonCode: a.prReasonCode ?? '1', amountCents: pr });

          return {
            procedureCode: line.procedureCode,
            modifiers: [line.modifier1, line.modifier2, line.modifier3, line.modifier4].filter((m): m is string => Boolean(m)),
            chargeCents: line.chargeCents,
            paidCents: paid,
            allowedCents: line.chargeCents - co,
            serviceDate: line.serviceDate,
            lineControlNumber: `L${line.lineNumber}`,
            adjustments,
            remarkCodes: [],
            references: [],
          };
        });

        remitClaims.push({
          patientControlNumber: claim.claimNumber,
          claimStatusCode: a.paidCents > 0 ? '1' : '4',
          totalChargeCents: a.billedCents,
          totalPaidCents: a.paidCents,
          patientResponsibilityCents: a.patientResponsibilityCents,
          claimFilingIndicator: payer?.claimFilingIndicator ?? '',
          payerClaimControlNumber: '',
          adjustments: [],
          remarkCodes: [],
          references: [],
          amounts: [],
          lines: remitLines,
        });
      }

      const remit: Remittance835 = {
        transactionControlNumber: `EOB${Date.now()}`,
        paymentMethod: params.paymentType === 'eft' ? 'ACH' : 'CHK',
        totalPaidCents: params.totalPaidCents,
        paymentDate: params.paymentDate,
        traceNumber: params.checkOrEftTraceNumber.trim(),
        payerIdentifier: payer?.payerIdCode ?? params.payerId,
        payer: { name: params.payerName, identifiers: payer?.payerIdCode ? [{ qualifier: 'PI', value: payer.payerIdCode }] : [] },
        payee: { name: 'Billing provider' },
        claims: remitClaims,
        providerAdjustments: [],
      };

      const res = await postRemittanceCommand(ctx, remit, {
        connector: 'manual_eob',
        fileName: `Manual EOB — ${params.checkOrEftTraceNumber.trim()}`,
        practiceId: claims[0]?.practiceId,
      });

      await appendAuditEvent(ctx.tx, {
        orgId: ctx.tenant.orgId,
        action: 'create',
        resourceType: 'remittance',
        resourceId: res.remittanceId,
        actorUserId: session.actor.userId,
        sessionId: session.sessionId,
        requestId: ctx.tenant.requestId,
        context: { payerName: params.payerName, totalPaidCents: params.totalPaidCents, source: 'manual_eob' },
      });

      return { ok: true as const, remittanceId: res.remittanceId, status: res.status };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to post the insurance payment.' };
    }
  });

  if (result?.ok) {
    try {
      const { addMockInsurancePayment } = await import('@/lib/mock-data');
      addMockInsurancePayment({
        id: `ins-pmt-${Date.now()}`,
        paymentNumber: `INS-CHK-${Math.floor(1000 + Math.random() * 9000)}`,
        payerId: params.payerId,
        payerName: params.payerName,
        paymentType: params.paymentType,
        checkOrEftTraceNumber: params.checkOrEftTraceNumber,
        paymentDate: params.paymentDate,
        totalPaidCents: params.totalPaidCents,
        contractualWriteoffCents: params.allocations.reduce((sum, a) => sum + (a.contractualAdjustmentCents || 0), 0),
        patientResponsibilityCents: params.allocations.reduce((sum, a) => sum + (a.patientResponsibilityCents || 0), 0),
        claimsCount: params.allocations.length,
        status: 'posted',
        postedAt: new Date(),
        claimsAllocated: params.allocations,
      });
    } catch {}

    revalidatePath('/payments');
    revalidatePath('/remittances');
    revalidatePath('/dashboard');
    revalidatePath('/claims');
    return result;
  }

  return result ?? { ok: false, error: 'Database unavailable — the payment could not be posted.' };
}
