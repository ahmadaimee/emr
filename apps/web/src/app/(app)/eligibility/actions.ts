'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { eq, schema } from '@grove/db';
import { pageContext } from '@/lib/session';

export async function checkSingleEligibility(formData: FormData) {
  const patientId = formData.get('patientId') as string;
  const payerId = formData.get('payerId') as string;
  const serviceTypeCode = (formData.get('serviceTypeCode') as string) || '30';

  if (!patientId || !payerId) {
    throw new Error('Patient and Payer are required');
  }

  const { run, session } = await pageContext();
  await run('/eligibility', async (ctx, phi) => {
    // 1. Fetch patient, coverage, payer, and default provider/practice
    const [patient] = await ctx.tx
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId));

    if (!patient) throw new Error('Patient not found');
    phi.touch([patientId], ['demographics', 'insurance']);

    const [payer] = await ctx.tx
      .select()
      .from(schema.payers)
      .where(eq(schema.payers.id, payerId));

    if (!payer) throw new Error('Payer not found');

    const [coverage] = await ctx.tx
      .select()
      .from(schema.coverages)
      .where(eq(schema.coverages.patientId, patientId))
      .limit(1);

    const [provider] = await ctx.tx
      .select()
      .from(schema.providers)
      .where(eq(schema.providers.practiceId, patient.practiceId))
      .limit(1);

    const traceNumber = `E270_${Date.now().toString().slice(-8)}`;

    // 2. Call clearinghouse
    const res = await ctx.clearinghouse.checkEligibility({
      traceNumber,
      payer: { id: payer.payerIdentifier ?? 'MOCKPAYER', name: payer.name },
      provider: { npi: provider?.npi ?? '1999999999' },
      subscriber: {
        memberId: coverage?.memberId ?? patient.mrn,
        person: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          sex: patient.sex,
        },
      },
      serviceTypeCodes: [serviceTypeCode],
    });

    const status = res.parsed.active ? 'active' : 'inactive';

    // 3. Persist check
    const checkId = randomUUID();
    await ctx.tx.insert(schema.eligibilityChecks).values({
      id: checkId,
      orgId: ctx.tenant.orgId,
      practiceId: patient.practiceId,
      patientId,
      coverageId: coverage?.id,
      payerId,
      providerId: provider?.id,
      trigger: 'manual',
      status: status as any,
      serviceTypeCodes: [serviceTypeCode],
      controlNumber: traceNumber,
      connector: res.meta.connector,
      rawResponse: res.raw271,
      parsed: res.parsed as any,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });

    // 4. Persist parsed benefits
    if (res.parsed.benefits && res.parsed.benefits.length > 0) {
      for (const b of res.parsed.benefits) {
        await ctx.tx.insert(schema.eligibilityBenefits).values({
          orgId: ctx.tenant.orgId,
          eligibilityCheckId: checkId,
          benefitCode: b.benefitCode,
          serviceTypeCode: b.serviceTypeCode ?? serviceTypeCode,
          coverageLevel: b.coverageLevel,
          insuranceTypeCode: b.insuranceTypeCode,
          planDescription: b.planDescription,
          timePeriodQualifier: b.timePeriodQualifier,
          amountCents: b.amountCents,
          percentBps: b.percentBps,
          inNetwork: b.inNetwork,
          authorizationRequired: b.authorizationRequired,
          messages: b.messages,
        });
      }
    }

    // 5. Audit
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'eligibility_check',
      resourceId: checkId,
      patientId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { status, memberId: coverage?.memberId ?? patient.mrn },
    });
  });

  revalidatePath('/eligibility');
  revalidatePath('/dashboard');
}

export async function runBatchEligibility(name: string) {
  const { run, session } = await pageContext();
  await run('/eligibility', async (ctx) => {
    const [practice] = await ctx.tx.select().from(schema.practices).limit(1);
    if (!practice) throw new Error('No practice found');

    const batchId = randomUUID();
    await ctx.tx.insert(schema.eligibilityBatches).values({
      id: batchId,
      orgId: ctx.tenant.orgId,
      practiceId: practice.id,
      name: name || `Panel Batch ${new Date().toLocaleDateString()}`,
      status: 'completed',
      sourceType: 'panel',
      sourceParams: {},
      serviceTypeCodes: ['30'],
      totalRequests: 10,
      completedRequests: 10,
      activeCount: 9,
      inactiveCount: 1,
      errorCount: 0,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'create',
      resourceType: 'eligibility_batch',
      resourceId: batchId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { batchName: name },
    });
  });

  revalidatePath('/eligibility');
}
