import { recordActivity } from '@grove/audit';
import { eq, schema } from '@grove/db';
import { buildInterchange, generate278, IMPLEMENTATIONS, serialize } from '@grove/x12';
import { DomainError, NotFoundError, type CommandContext } from '../context';
import { emit } from '../outbox';
import { createTask } from '../tasks/create';

export interface RequestAuthorizationInput {
  patientId: string;
  payerId: string;
  coverageId?: string;
  renderingProviderId?: string;
  urgency?: 'routine' | 'urgent';
  procedureCodes: string[];
  diagnosisCodes: string[];
  serviceDateFrom: string;
  serviceDateThrough?: string;
  unitsRequested?: number;
  notes?: string;
}

export interface RequestAuthorizationResult {
  authorizationId: string;
  dueAt: Date;
}

/**
 * Open a tracked prior-authorization request and produce the 278 X12 artifact.
 *
 * Most payers still answer prior auth by phone, fax, or their own portal rather than
 * a returned 278 — so this does not attempt a live clearinghouse round trip the way
 * eligibility (270/271) does. What it guarantees is a due date computed from the CMS
 * Interoperability and Prior Authorization Final Rule (7 calendar days standard, 72
 * hours urgent, effective Jan 1 2026) and a real 278 request document for the file,
 * even when the actual submission channel is a fax machine.
 */
export async function requestAuthorizationCommand(ctx: CommandContext, input: RequestAuthorizationInput): Promise<RequestAuthorizationResult> {
  const orgId = ctx.tenant.orgId;
  if (input.procedureCodes.length === 0) throw new DomainError('At least one procedure code is required', 'procedure_required', 422);
  if (input.diagnosisCodes.length === 0) throw new DomainError('At least one diagnosis code is required', 'diagnosis_required', 422);

  const [patient] = await ctx.tx.select().from(schema.patients).where(eq(schema.patients.id, input.patientId));
  if (!patient) throw new NotFoundError('patient', input.patientId);
  const [payer] = await ctx.tx.select().from(schema.payers).where(eq(schema.payers.id, input.payerId));
  if (!payer) throw new NotFoundError('payer', input.payerId);

  const coverage = input.coverageId ? (await ctx.tx.select().from(schema.coverages).where(eq(schema.coverages.id, input.coverageId)))[0] : undefined;
  const provider = input.renderingProviderId ? (await ctx.tx.select().from(schema.providers).where(eq(schema.providers.id, input.renderingProviderId)))[0] : undefined;

  const urgency = input.urgency ?? 'routine';
  const now = ctx.now();
  const dueAt = new Date(now.getTime() + (urgency === 'urgent' ? 72 * 3_600_000 : 7 * 86_400_000));

  const traceNumber = `AUTH${now.getTime()}`;
  let rawRequest278: string | undefined;
  if (provider) {
    const body = generate278(
      {
        payer: { name: payer.name, id: payer.payerIdCode ?? payer.id },
        requester: { isPerson: true, person: { lastName: provider.lastName, firstName: provider.firstName }, npi: provider.npi },
        subscriber: { person: { lastName: patient.lastName, firstName: patient.firstName }, memberId: coverage?.memberId ?? patient.mrn, dateOfBirth: patient.dateOfBirth },
        certificationTypeCode: 'I',
        serviceTypeCode: 'HC',
        diagnosisCodes: input.diagnosisCodes,
        procedureCodes: input.procedureCodes,
        serviceDateFrom: input.serviceDateFrom,
        serviceDateThrough: input.serviceDateThrough,
        traceNumber,
      },
      { timestamp: now },
    );
    rawRequest278 = serialize(
      buildInterchange(
        { sender: { qualifier: 'ZZ', id: 'GROVE' }, receiver: { qualifier: 'ZZ', id: (payer.payerIdCode ?? payer.name).slice(0, 15) }, controlNumber: Date.now() % 1_000_000_000, usage: 'P', timestamp: now },
        { functionalId: 'HI', controlNumber: 1, version: IMPLEMENTATIONS['278'] },
        [{ type: '278', implementation: IMPLEMENTATIONS['278'], controlNumber: 1, body }],
      ),
    );
  }

  const [row] = await ctx.tx
    .insert(schema.authorizations)
    .values({
      orgId,
      practiceId: patient.practiceId,
      patientId: patient.id,
      payerId: payer.id,
      coverageId: coverage?.id ?? null,
      renderingProviderId: provider?.id ?? null,
      status: 'submitted',
      urgency,
      procedureCodes: input.procedureCodes,
      diagnosisCodes: input.diagnosisCodes,
      serviceDateFrom: input.serviceDateFrom,
      serviceDateThrough: input.serviceDateThrough ?? null,
      unitsRequested: input.unitsRequested ?? null,
      requestedAt: now,
      dueAt,
      rawRequest278: rawRequest278 ?? null,
      notes: input.notes ?? null,
      createdBy: ctx.actor?.userId ?? null,
    })
    .returning({ id: schema.authorizations.id });
  const authorizationId = row!.id;

  await emit(ctx, 'authorization.requested', 'authorization', authorizationId, { patientId: patient.id, payerId: payer.id, urgency, dueAt: dueAt.toISOString() });
  await recordActivity(ctx.tx, {
    orgId, practiceId: patient.practiceId, subjectType: 'patient', subjectId: patient.id,
    verb: 'authorization.requested', summary: `requested ${urgency} prior authorization from ${payer.name} for ${input.procedureCodes.join(', ')}`,
    detail: { authorizationId, dueAt: dueAt.toISOString() }, actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });

  return { authorizationId, dueAt };
}

/** Staff records what the payer actually said — by phone, portal, fax, or a returned 278. */
export interface RecordAuthorizationDecisionInput {
  status: 'approved' | 'partially_approved' | 'denied';
  authorizationNumber?: string;
  unitsApproved?: number;
  expiresOn?: string;
  payerResponseMessage?: string;
}

export async function recordAuthorizationDecisionCommand(ctx: CommandContext, authorizationId: string, decision: RecordAuthorizationDecisionInput) {
  const [auth] = await ctx.tx.select().from(schema.authorizations).where(eq(schema.authorizations.id, authorizationId));
  if (!auth) throw new NotFoundError('authorization', authorizationId);
  if (decision.status !== 'denied' && !decision.authorizationNumber) {
    throw new DomainError('An authorization number is required to record an approval', 'authorization_number_required', 422);
  }

  await ctx.tx
    .update(schema.authorizations)
    .set({
      status: decision.status,
      authorizationNumber: decision.authorizationNumber ?? null,
      unitsApproved: decision.unitsApproved ?? null,
      expiresOn: decision.expiresOn ?? null,
      payerResponseMessage: decision.payerResponseMessage ?? null,
      respondedAt: ctx.now(),
      updatedAt: ctx.now(),
    })
    .where(eq(schema.authorizations.id, authorizationId));

  await emit(ctx, 'authorization.decided', 'authorization', authorizationId, { status: decision.status, authorizationNumber: decision.authorizationNumber ?? null });
  await recordActivity(ctx.tx, {
    orgId: ctx.tenant.orgId, practiceId: auth.practiceId, subjectType: 'patient', subjectId: auth.patientId,
    verb: 'authorization.decided', summary: decision.status === 'denied' ? 'prior authorization denied' : `prior authorization ${decision.status.replace('_', ' ')} — #${decision.authorizationNumber}`,
    detail: { authorizationId, status: decision.status }, actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });

  if (decision.status === 'denied') {
    await createTask(ctx, {
      queueKey: 'denials', practiceId: auth.practiceId, subjectType: 'patient', subjectId: auth.patientId, patientId: auth.patientId,
      title: `Prior authorization denied for ${auth.procedureCodes.join(', ')}`,
      detail: { authorizationId, payerResponseMessage: decision.payerResponseMessage }, priority: 'high', suggestedAction: 'appeal', dedupeKey: `authdenied:${authorizationId}`,
    });
  }
}

/** Copy an approved authorization's number onto a claim before it's built. */
export async function linkAuthorizationToClaimCommand(ctx: CommandContext, claimId: string, authorizationId: string) {
  const [claim] = await ctx.tx.select({ id: schema.claims.id, practiceId: schema.claims.practiceId, claimNumber: schema.claims.claimNumber }).from(schema.claims).where(eq(schema.claims.id, claimId));
  if (!claim) throw new NotFoundError('claim', claimId);
  const [auth] = await ctx.tx.select().from(schema.authorizations).where(eq(schema.authorizations.id, authorizationId));
  if (!auth) throw new NotFoundError('authorization', authorizationId);
  if (!['approved', 'partially_approved'].includes(auth.status)) {
    throw new DomainError(`Authorization is ${auth.status}, not approved`, 'authorization_not_approved', 409);
  }
  if (auth.expiresOn && auth.expiresOn < ctx.now().toISOString().slice(0, 10)) {
    throw new DomainError(`Authorization #${auth.authorizationNumber} expired ${auth.expiresOn}`, 'authorization_expired', 409);
  }

  await ctx.tx.update(schema.claims).set({ authorizationId, priorAuthNumber: auth.authorizationNumber, updatedAt: ctx.now() }).where(eq(schema.claims.id, claimId));
  await recordActivity(ctx.tx, {
    orgId: ctx.tenant.orgId, practiceId: claim.practiceId, subjectType: 'claim', subjectId: claimId,
    verb: 'claim.status_updated', summary: `linked prior authorization #${auth.authorizationNumber} to ${claim.claimNumber}`,
    detail: { authorizationId }, actorUserId: ctx.actor?.userId ?? null, actorType: ctx.actor ? 'user' : 'system',
  });
}
