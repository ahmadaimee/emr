import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';
import { money } from './_types';

export const claimType = pgEnum('claim_type', ['professional', 'institutional', 'dental']);

/**
 * Claim lifecycle.
 *
 * `acknowledged` and `rejected` describe the CLEARINGHOUSE/front-end result (999,
 * 277CA) — the claim never reached adjudication. `denied` describes a PAYER decision on
 * an adjudicated claim. Collapsing these two into one status is a common and expensive
 * modelling error: front-end rejections generate no remittance, no denial code and no
 * appeal right, so they silently fall out of every A/R report that only watches denials.
 */
export const claimStatus = pgEnum('claim_status', [
  'draft',
  'scrubbing',
  'needs_review',      // scrubber raised errors a human must clear
  'ready',
  'queued',
  'submitted',
  'acknowledged',      // accepted by clearinghouse/payer front end
  'rejected',          // front-end rejection: never adjudicated
  'in_process',        // payer has it, awaiting adjudication
  'paid',
  'partially_paid',
  'denied',            // adjudicated and denied
  'appealed',
  'secondary_ready',
  'secondary_submitted',
  'patient_responsibility',
  'closed',
  'voided',
]);

/**
 * 837 CLM05-3 / UB-04 frequency. 1 = original, 7 = replacement of a prior claim,
 * 8 = void. A 7 or 8 must carry the payer's original claim control number in REF*F8,
 * otherwise the payer treats it as a duplicate original and denies it.
 */
export const claimFrequency = pgEnum('claim_frequency', ['original', 'replacement', 'void']);

export const claims = pgTable(
  'claims',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    encounterId: uuid('encounter_id').notNull(),
    coverageId: uuid('coverage_id').notNull(),
    payerId: uuid('payer_id').notNull(),

    claimNumber: text('claim_number').notNull(),
    type: claimType('type').notNull().default('professional'),
    status: claimStatus('status').notNull().default('draft'),
    frequency: claimFrequency('frequency').notNull().default('original'),

    /** Which coverage rank this claim bills. Drives COB sequencing. */
    coverageRank: text('coverage_rank').notNull().default('primary'),

    /**
     * Links a replacement or void back to the claim it supersedes, and carries the
     * payer's control number forward so the payer can match it.
     */
    originalClaimId: uuid('original_claim_id'),
    payerClaimControlNumber: text('payer_claim_control_number'),

    /** For a secondary claim, the remittance that established what the primary paid. */
    primaryRemittanceClaimId: uuid('primary_remittance_claim_id'),

    totalChargeCents: money('total_charge_cents').notNull().default(0),
    totalAllowedCents: money('total_allowed_cents').notNull().default(0),
    totalPaidCents: money('total_paid_cents').notNull().default(0),
    totalAdjustmentCents: money('total_adjustment_cents').notNull().default(0),
    patientResponsibilityCents: money('patient_responsibility_cents').notNull().default(0),
    balanceCents: money('balance_cents').notNull().default(0),

    serviceDateFrom: date('service_date_from').notNull(),
    serviceDateThrough: date('service_date_through'),

    /**
     * Timely filing deadline, computed from the plan's filing window at claim creation.
     *
     * This exists because an expiring claim is otherwise indistinguishable from an
     * ordinary aging claim — nothing in the lifecycle generates a warning, and the
     * money simply becomes uncollectible. A daily job escalates claims approaching it.
     */
    timelyFilingDeadline: date('timely_filing_deadline'),
    appealDeadline: date('appeal_deadline'),

    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    firstRemittanceAt: timestamp('first_remittance_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),

    /** Pre-submission denial risk, 0-1000, with the drivers that produced it. */
    denialRiskScore: integer('denial_risk_score'),
    denialRiskFactors: jsonb('denial_risk_factors'),

    /** Set when the automation, not a person, created this claim. */
    createdByAutomation: text('created_by_automation'),

    ...timestamps,
  },
  (t) => [
    uniqueIndex('claims_org_number_key').on(t.orgId, t.claimNumber),
    index('claims_status_idx').on(t.orgId, t.practiceId, t.status),
    index('claims_patient_idx').on(t.orgId, t.patientId),
    index('claims_encounter_idx').on(t.orgId, t.encounterId),
    index('claims_payer_status_idx').on(t.orgId, t.payerId, t.status),
    index('claims_timely_filing_idx').on(t.orgId, t.status, t.timelyFilingDeadline),
    index('claims_balance_idx').on(t.orgId, t.practiceId, t.balanceCents),
  ],
);

/**
 * An immutable snapshot of exactly what was built and sent.
 *
 * Once a claim is submitted its content is frozen here. When a payer disputes what we
 * filed, the answer is this row — the generated X12 and the structured payload behind
 * it — not a reconstruction from current master data that may since have changed.
 */
export const claimVersions = pgTable(
  'claim_versions',
  {
    id: primaryId,
    orgId,
    claimId: uuid('claim_id').notNull(),
    versionNumber: integer('version_number').notNull(),

    /** Fully resolved claim payload: providers, subscriber, lines, all denormalised. */
    payload: jsonb('payload').notNull(),
    /** The generated X12 837 transaction as sent. */
    x12: text('x12'),

    /** SHA-256 of the payload, so an unchanged resubmission is detectable. */
    contentHash: text('content_hash').notNull(),

    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('claim_versions_key').on(t.claimId, t.versionNumber),
    index('claim_versions_claim_idx').on(t.orgId, t.claimId),
  ],
);

export const submissionStatus = pgEnum('submission_status', [
  'queued',
  'sent',
  'transport_failed',
  'acknowledged',
  'rejected',
  'accepted_with_errors',
]);

/**
 * One attempt to deliver a claim. Control numbers are recorded per attempt so that any
 * inbound 999/277CA/835 can be traced back to the exact envelope that produced it.
 */
export const claimSubmissions = pgTable(
  'claim_submissions',
  {
    id: primaryId,
    orgId,
    claimId: uuid('claim_id').notNull(),
    claimVersionId: uuid('claim_version_id').notNull(),

    attemptNumber: integer('attempt_number').notNull().default(1),
    status: submissionStatus('status').notNull().default('queued'),

    connector: text('connector').notNull(),
    connectorSubmissionId: text('connector_submission_id'),
    connectorBatchId: text('connector_batch_id'),

    /** X12 envelope control numbers. */
    isaControlNumber: text('isa_control_number'),
    gsControlNumber: text('gs_control_number'),
    stControlNumber: text('st_control_number'),

    sentAt: timestamp('sent_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),

    /** Paper submission, when the payer will not accept EDI. */
    isPaper: boolean('is_paper').notNull().default(false),
    paperFormDocumentId: uuid('paper_form_document_id'),

    errorMessage: text('error_message'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('claim_submissions_attempt_key').on(t.claimId, t.attemptNumber),
    index('claim_submissions_claim_idx').on(t.orgId, t.claimId),
    index('claim_submissions_connector_idx').on(t.orgId, t.connectorSubmissionId),
  ],
);

export const acknowledgmentType = pgEnum('acknowledgment_type', [
  'ta1',
  'x999',
  'x277ca',
  'connector',
]);

/**
 * Front-end acknowledgments: TA1 (envelope), 999 (syntax/implementation-guide), 277CA
 * (claim-level payer front-end edits), and connector-proprietary responses.
 *
 * These are tracked as first-class records because a rejection here means the claim was
 * never adjudicated — there will be no 835, no CARC, and no appeal right. Products that
 * only watch for denials lose this revenue silently.
 */
export const claimAcknowledgments = pgTable(
  'claim_acknowledgments',
  {
    id: primaryId,
    orgId,
    claimId: uuid('claim_id'),
    claimSubmissionId: uuid('claim_submission_id'),

    type: acknowledgmentType('type').notNull(),
    /** A = accepted, R = rejected, E = accepted with errors. */
    resultCode: text('result_code').notNull(),

    /** Category/status codes from the 277CA STC segment. */
    statusCategoryCode: text('status_category_code'),
    statusCode: text('status_code'),
    entityCode: text('entity_code'),
    message: text('message'),

    /** IK3/IK4 pointers from a 999, identifying the offending segment and element. */
    segmentId: text('segment_id'),
    segmentPosition: integer('segment_position'),
    elementPosition: integer('element_position'),

    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    rawContent: text('raw_content'),

    /** Set once a person or an automation has dealt with the rejection. */
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by'),

    ...timestamps,
  },
  (t) => [
    index('claim_acknowledgments_claim_idx').on(t.orgId, t.claimId),
    index('claim_acknowledgments_unresolved_idx').on(t.orgId, t.resultCode, t.resolvedAt),
  ],
);

/**
 * 276 claim-status polling history. Cadence is driven by learned payer behaviour rather
 * than a fixed timer, and stops once the payer reports a final status.
 */
export const claimStatusChecks = pgTable(
  'claim_status_checks',
  {
    id: primaryId,
    orgId,
    claimId: uuid('claim_id').notNull(),

    connector: text('connector'),
    requestedAt: timestamp('requested_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),

    statusCategoryCode: text('status_category_code'),
    statusCode: text('status_code'),
    statusDescription: text('status_description'),
    /** True when the payer reports a final disposition and polling should stop. */
    isFinal: boolean('is_final').notNull().default(false),

    paidAmountCents: money('paid_amount_cents'),
    effectiveDate: date('effective_date'),

    rawResponse: text('raw_response'),
    ...timestamps,
  },
  (t) => [index('claim_status_checks_claim_idx').on(t.orgId, t.claimId, t.createdAt)],
);

/**
 * Immutable history of every status change. This is what "days in each stage" and
 * "who moved this claim and why" are answered from; `claims.status` is just the
 * current pointer.
 */
export const claimStateTransitions = pgTable(
  'claim_state_transitions',
  {
    id: primaryId,
    orgId,
    claimId: uuid('claim_id').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    /** user | system | era | ack | status_check */
    trigger: text('trigger').notNull(),
    reason: text('reason'),
    actorUserId: uuid('actor_user_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('claim_state_transitions_claim_idx').on(t.orgId, t.claimId, t.occurredAt)],
);

/**
 * What a prior payer did to each line — 837 Loop 2430 (SVD / CAS / DTP*573).
 *
 * A secondary claim must tell the secondary payer exactly what the primary paid and
 * adjusted, line by line. This table is populated from the primary 835 at posting time
 * and read when the secondary claim is generated, which is what makes COB automatic
 * instead of a rekeying exercise from a paper EOB.
 */
export const claimLinePriorAdjudications = pgTable(
  'claim_line_prior_adjudications',
  {
    id: primaryId,
    orgId,
    claimId: uuid('claim_id').notNull(),
    serviceLineId: uuid('service_line_id').notNull(),
    priorPayerId: uuid('prior_payer_id').notNull(),
    priorRemittanceLineId: uuid('prior_remittance_line_id'),
    priorPayerClaimControlNumber: text('prior_payer_claim_control_number'),

    procedureCode: text('procedure_code').notNull(),
    modifiers: text('modifiers').array(),
    paidAmountCents: money('paid_amount_cents').notNull(),
    paidUnits: integer('paid_units'),
    /** DTP*573 — the date the prior payer adjudicated the line. */
    adjudicationDate: date('adjudication_date').notNull(),

    /** CAS repeats: [{ group: 'CO', reasonCode: '45', amountCents: 12000 }, ...] */
    adjustments: jsonb('adjustments').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('claim_line_prior_adjudications_key').on(t.serviceLineId, t.priorPayerId),
    index('claim_line_prior_adjudications_claim_idx').on(t.orgId, t.claimId),
  ],
);

/**
 * Per-payer overrides to the generated 837.
 *
 * The TR3 is one document; the real world is hundreds of payer companion guides that
 * each deviate from it slightly. A claim that validates perfectly and is rejected by one
 * Blues plan over a taxonomy qualifier is normal. Every such rejection becomes either a
 * scrubber rule or a row here — never a hard-coded `if (payer === ...)`.
 */
export const payerFormatterOverrides = pgTable(
  'payer_formatter_overrides',
  {
    id: primaryId,
    orgId,
    payerId: uuid('payer_id').notNull(),
    claimType: text('claim_type').notNull().default('professional'),
    /** e.g. '2310B.PRV' or '2000A.PRV03' */
    target: text('target').notNull(),
    /** set | omit | transform */
    operation: text('operation').notNull(),
    value: jsonb('value'),
    reason: text('reason').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('payer_formatter_overrides_payer_idx').on(t.orgId, t.payerId, t.active)],
);
