'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { eq, schema } from '@grove/db';
import { pageContext } from '@/lib/session';

export async function recordPaymentAction(formData: FormData) {
  const patientId = String(formData.get('patientId') ?? '');
  const amountCents = Math.round(Number(formData.get('amount') ?? 0) * 100);
  const paymentSource = String(formData.get('source') ?? 'patient_card');
  const referenceNumber = String(formData.get('referenceNumber') ?? `REF-${Date.now()}`);
  const notes = String(formData.get('notes') ?? 'Point of care payment');

  const { run, session } = await pageContext();

  await run('/payments', async (ctx) => {
    // 1. Insert payment record
    const [pmt] = await ctx.tx
      .insert(schema.payments)
      .values({
        orgId: ctx.tenant.orgId,
        practiceId: session.actor.practiceIds?.[0] ?? '00000000-0000-4000-8000-000000000010',
        paymentSource: paymentSource as any,
        amountCents,
        unallocatedCents: 0,
        patientId: patientId || null,
        referenceNumber,
        status: 'settled',
      })
      .returning({ id: schema.payments.id });

    // 2. Append-only ledger entry (RULE 6)
    if (patientId) {
      await ctx.tx.insert(schema.ledgerEntries).values({
        orgId: ctx.tenant.orgId,
        patientId,
        entryType: 'patient_payment',
        amountCents: -amountCents, // credits decrease balance
        balanceAfterCents: 0,
        description: `Payment recorded via ${paymentSource.replace('_', ' ')} (${referenceNumber})`,
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

export async function recordInsurancePaymentAction(params: {
  payerId: string;
  payerName: string;
  paymentType: 'check' | 'eft' | 'virtual_card';
  checkOrEftTraceNumber: string;
  paymentDate: string;
  totalPaidCents: number;
  allocations: Array<{
    claimId: string;
    claimNumber: string;
    patientName: string;
    billedCents: number;
    allowedCents: number;
    paidCents: number;
    contractualAdjustmentCents: number;
    patientResponsibilityCents: number;
  }>;
}) {
  const { run, session } = await pageContext();
  await run('/payments/post-insurance', async (ctx) => {
    try {
      await appendAuditEvent(ctx.tx, {
        orgId: ctx.tenant.orgId,
        action: 'create',
        resourceType: 'payment',
        resourceId: `remit-manual-${Date.now()}`,
        actorUserId: session.actor.userId,
        sessionId: session.sessionId,
        requestId: ctx.tenant.requestId,
        context: { payerName: params.payerName, totalPaidCents: params.totalPaidCents },
      });
    } catch {}
  });

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
}
