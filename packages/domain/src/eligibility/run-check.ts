import { recordActivity } from '@grove/audit';
import { and, desc, eq, schema } from '@grove/db';
import { summarizeBenefits, type BenefitSummary, type EligibilityInquiry270 } from '@grove/x12';
import { NotFoundError, type CommandContext } from '../context';
import { emit } from '../outbox';
import { createTask } from '../tasks/create';
import { diffBenefits } from './diff';

export type EligibilityTrigger = (typeof schema.eligibilityTrigger.enumValues)[number];

export interface RunEligibilityInput {
  coverageId: string;
  trigger: EligibilityTrigger;
  serviceDate?: string;
  serviceTypeCodes?: string[];
  providerId?: string;
  batchId?: string;
  encounterId?: string;
}

export interface RunEligibilityResult {
  checkId: string;
  status: (typeof schema.eligibilityStatus.enumValues)[number];
  summary: BenefitSummary | null;
  changes: ReturnType<typeof diffBenefits>;
  rejection?: { reasonCode: string; followUpActionCode: string };
}

/** AAA reject reasons where retrying can never help — the request itself is wrong. */
const NOT_FOUND_CODES = new Set(['58', '64', '65', '67', '68', '71', '72', '73', '75', '76', '77', '78']);
const PAYER_ERROR_CODES = new Set(['42', '79', '80']);

/**
 * One 270/271 round trip: send, parse, flatten benefits, DIFF against the previous
 * result, update the coverage snapshot, and file work only when something needs a
 * human. Idempotent per (coverage, service date, trigger, day) so the pre-visit job
 * and the check-in trigger cannot double-bill the same inquiry.
 */
export async function runEligibilityCheckCommand(ctx: CommandContext, input: RunEligibilityInput): Promise<RunEligibilityResult> {
  const orgId = ctx.tenant.orgId;
  const [coverage] = await ctx.tx.select().from(schema.coverages).where(eq(schema.coverages.id, input.coverageId));
  if (!coverage) throw new NotFoundError('coverage', input.coverageId);
  const [patient] = await ctx.tx.select().from(schema.patients).where(eq(schema.patients.id, coverage.patientId));
  const [payer] = await ctx.tx.select().from(schema.payers).where(eq(schema.payers.id, coverage.payerId));
  if (!patient || !payer) throw new NotFoundError('coverage', input.coverageId);

  const serviceDate = input.serviceDate ?? ctx.now().toISOString().slice(0, 10);
  const serviceTypeCodes = input.serviceTypeCodes ?? ['30', '98'];

  // Idempotency: same coverage + date + service types today → reuse.
  const dayStart = new Date(ctx.now());
  dayStart.setUTCHours(0, 0, 0, 0);
  const [recent] = await ctx.tx
    .select()
    .from(schema.eligibilityChecks)
    .where(and(eq(schema.eligibilityChecks.coverageId, coverage.id), eq(schema.eligibilityChecks.serviceDate, serviceDate), eq(schema.eligibilityChecks.status, 'active')))
    .orderBy(desc(schema.eligibilityChecks.createdAt))
    .limit(1);
  if (recent && recent.createdAt >= dayStart && input.trigger !== 'manual' && sameSet(recent.serviceTypeCodes ?? [], serviceTypeCodes)) {
    return { checkId: recent.id, status: recent.status, summary: (recent.parsed as { summary?: BenefitSummary } | null)?.summary ?? null, changes: [] };
  }

  const provider = input.providerId
    ? (await ctx.tx.select().from(schema.providers).where(eq(schema.providers.id, input.providerId)))[0]
    : (await ctx.tx.select().from(schema.providers).where(and(eq(schema.providers.practiceId, patient.practiceId), eq(schema.providers.active, true))).limit(1))[0];
  if (!provider) throw new NotFoundError('provider', input.providerId ?? 'default');

  const [connectorId] = await ctx.tx.select().from(schema.payerConnectorIds).where(and(eq(schema.payerConnectorIds.payerId, payer.id), eq(schema.payerConnectorIds.connector, ctx.clearinghouse.name)));
  const payerId = connectorId?.connectorEligibilityPayerId ?? connectorId?.connectorPayerId ?? payer.payerIdCode ?? '';

  const [check] = await ctx.tx
    .insert(schema.eligibilityChecks)
    .values({
      orgId, practiceId: patient.practiceId, patientId: patient.id, coverageId: coverage.id, payerId: payer.id, providerId: provider.id,
      batchId: input.batchId ?? null, encounterId: input.encounterId ?? null, trigger: input.trigger, status: 'sent',
      serviceTypeCodes, serviceDate, connector: ctx.clearinghouse.name, requestedAt: ctx.now(),
    })
    .returning({ id: schema.eligibilityChecks.id });
  const checkId = check!.id;
  const traceNumber = `GRV${checkId.replace(/-/g, '').slice(0, 20).toUpperCase()}`;

  const subscriberIsPatient = coverage.relationshipCode === '18';
  const inquiry: EligibilityInquiry270 = {
    payer: { name: payer.name.toUpperCase(), id: payerId },
    provider: { isPerson: true, person: { lastName: provider.lastName.toUpperCase(), firstName: provider.firstName.toUpperCase() }, npi: provider.npi },
    subscriber: subscriberIsPatient
      ? { person: { lastName: patient.lastName.toUpperCase(), firstName: patient.firstName.toUpperCase() }, memberId: coverage.memberId, dateOfBirth: patient.dateOfBirth, sex: patient.sex }
      : { person: { lastName: (coverage.subscriberLastName ?? '').toUpperCase(), firstName: (coverage.subscriberFirstName ?? '').toUpperCase() }, memberId: coverage.memberId, dateOfBirth: coverage.subscriberDateOfBirth ?? undefined, sex: (coverage.subscriberSex as 'M' | 'F' | 'U' | null) ?? undefined },
    dependent: subscriberIsPatient ? undefined : { person: { lastName: patient.lastName.toUpperCase(), firstName: patient.firstName.toUpperCase() }, dateOfBirth: patient.dateOfBirth, sex: patient.sex, relationship: coverage.relationshipCode },
    serviceDate,
    serviceTypeCodes,
    traceNumber,
  };

  const started = ctx.now();
  let status: RunEligibilityResult['status'];
  let summary: BenefitSummary | null = null;
  let rejection: RunEligibilityResult['rejection'];
  let changes: ReturnType<typeof diffBenefits> = [];

  try {
    const result = await ctx.clearinghouse.checkEligibility(inquiry);
    const p = result.parsed;
    const primaryRejection = p.rejections.find((r) => r.scope === 'subscriber' || r.scope === 'dependent') ?? p.rejections[0];

    if (primaryRejection) {
      rejection = { reasonCode: primaryRejection.reasonCode, followUpActionCode: primaryRejection.followUpActionCode };
      status = NOT_FOUND_CODES.has(primaryRejection.reasonCode) ? 'not_found' : PAYER_ERROR_CODES.has(primaryRejection.reasonCode) ? 'payer_error' : 'invalid_request';
    } else {
      status = p.isActive ? 'active' : 'inactive';
      summary = summarizeBenefits(p, serviceTypeCodes.find((c) => c !== '30') ?? '30');
    }

    // Previous summary for diffing.
    const [prevCheck] = await ctx.tx
      .select({ parsed: schema.eligibilityChecks.parsed })
      .from(schema.eligibilityChecks)
      .where(and(eq(schema.eligibilityChecks.coverageId, coverage.id), eq(schema.eligibilityChecks.status, 'active')))
      .orderBy(desc(schema.eligibilityChecks.respondedAt))
      .limit(1);
    const prevSummary = (prevCheck?.parsed as { summary?: BenefitSummary } | null)?.summary ?? null;
    if (summary) changes = diffBenefits(prevSummary, summary);
    else if (prevSummary?.active && status !== 'payer_error') changes = [{ field: 'active', from: true, to: false, materiality: 'critical', label: status === 'not_found' ? 'Payer no longer recognises this member' : 'Coverage is no longer active' }];

    await ctx.tx
      .update(schema.eligibilityChecks)
      .set({
        status, connectorTransactionId: result.meta.vendorTransactionId ?? null, controlNumber: p.transactionControlNumber,
        respondedAt: ctx.now(), latencyMs: result.meta.durationMs,
        reportedPlanBegin: p.subscriber.planDates?.begin ?? null, reportedPlanEnd: p.subscriber.planDates?.end ?? null,
        rejectReasonCode: rejection?.reasonCode ?? null, followUpActionCode: rejection?.followUpActionCode ?? null,
        rawRequest: result.raw270 ?? null, rawResponse: result.raw271,
        parsed: { summary, benefits: p.benefits.length, rejections: p.rejections },
        hasChanges: changes.length > 0, changeSummary: changes.length ? changes : null, updatedAt: ctx.now(),
      })
      .where(eq(schema.eligibilityChecks.id, checkId));

    if (p.benefits.length) {
      await ctx.tx.insert(schema.eligibilityBenefits).values(
        p.benefits.map((b) => ({
          orgId, eligibilityCheckId: checkId, benefitCode: b.code, coverageLevel: b.coverageLevel ?? null,
          serviceTypeCode: b.serviceTypeCodes[0] ?? null, insuranceTypeCode: b.insuranceType ?? null, planDescription: b.planDescription ?? null,
          timePeriodQualifier: b.timePeriodQualifier ?? null, amountCents: b.amountCents ?? null, percentBps: b.percentBps ?? null,
          quantityQualifier: b.quantityQualifier ?? null, quantity: b.quantity ?? null, inNetwork: b.inNetwork ?? null,
          authorizationRequired: b.authorizationRequired ?? null, messages: b.messages,
        })),
      );
    }

    await ctx.tx.insert(schema.externalCalls).values({ orgId, practiceId: patient.practiceId, connector: ctx.clearinghouse.name, operation: 'eligibility', subjectType: 'coverage', subjectId: coverage.id, startedAt: started, durationMs: result.meta.durationMs, httpStatus: result.meta.httpStatus ?? null, outcome: 'ok', costCents: result.meta.costCents, triggeredBy: input.trigger });
  } catch (err) {
    status = 'transport_error';
    await ctx.tx.update(schema.eligibilityChecks).set({ status, respondedAt: ctx.now(), rejectReasonText: (err as Error).message, updatedAt: ctx.now() }).where(eq(schema.eligibilityChecks.id, checkId));
    await ctx.tx.insert(schema.externalCalls).values({ orgId, practiceId: patient.practiceId, connector: ctx.clearinghouse.name, operation: 'eligibility', subjectType: 'coverage', subjectId: coverage.id, startedAt: started, durationMs: ctx.now().getTime() - started.getTime(), outcome: 'error', costCents: 0, triggeredBy: input.trigger, errorClass: (err as { errorClass?: string }).errorClass ?? 'unknown' });
    throw err;
  }

  // Snapshot on the coverage for lists and schedules. Payer-reported dates win.
  if (status === 'active' || status === 'inactive' || status === 'not_found') {
    await ctx.tx
      .update(schema.coverages)
      .set({
        lastVerifiedAt: ctx.now().toISOString().slice(0, 10), lastVerifiedStatus: status, lastVerifiedEligibilityId: checkId,
        ...(summary?.planEnd ? { terminationDate: summary.planEnd } : {}),
        ...(summary?.planBegin && !coverage.effectiveDate ? { effectiveDate: summary.planBegin } : {}),
        updatedAt: ctx.now(),
      })
      .where(eq(schema.coverages.id, coverage.id));
  }

  // Work only for exceptions.
  const exception = status === 'inactive' || status === 'not_found' || status === 'invalid_request' || changes.some((c) => c.materiality === 'critical');
  if (exception) {
    await createTask(ctx, {
      queueKey: 'eligibility', practiceId: patient.practiceId, subjectType: 'patient', subjectId: patient.id, patientId: patient.id,
      title: status === 'active' ? `${payer.name}: ${changes[0]!.label} — ${patient.lastName}, ${patient.firstName}` : `${payer.name} reports ${status.replace('_', ' ')} for ${patient.lastName}, ${patient.firstName}`,
      detail: { coverageId: coverage.id, checkId, status, rejection, changes, serviceDate },
      priority: status === 'active' ? 'normal' : 'high', suggestedAction: status === 'not_found' ? 'verify_member_id' : 'update_coverage',
      dedupeKey: `elig:${coverage.id}:${status}:${serviceDate}`,
    });
  }

  await emit(ctx, changes.length ? 'eligibility.changed' : 'eligibility.completed', 'coverage', coverage.id, { checkId, patientId: patient.id, status, changes, batchId: input.batchId ?? null });
  await recordActivity(ctx.tx, {
    orgId, practiceId: patient.practiceId, subjectType: 'patient', subjectId: patient.id,
    verb: changes.length ? 'eligibility.changed' : 'eligibility.verified',
    summary: status === 'active'
      ? `verified ${payer.name}: active${summary?.copayCents !== undefined ? `, $${(summary.copayCents / 100).toFixed(0)} copay` : ''}${summary?.deductibleRemainingCents !== undefined ? `, $${(summary.deductibleRemainingCents / 100).toFixed(0)} deductible remaining` : ''}${changes.length ? ` — ${changes[0]!.label}` : ''}`
      : `${payer.name} eligibility returned ${status.replace('_', ' ')}${rejection ? ` (AAA ${rejection.reasonCode})` : ''}`,
    detail: { checkId, trigger: input.trigger }, actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });

  return { checkId, status, summary, changes, rejection };
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}
