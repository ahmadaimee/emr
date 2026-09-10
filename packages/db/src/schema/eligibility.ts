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
  uuid,
} from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';
import { money } from './_types';

export const eligibilityTrigger = pgEnum('eligibility_trigger', [
  'manual',
  'batch',
  'pre_appointment',
  'check_in',
  'periodic_reverification',
  'pre_claim',
  'api',
]);

export const eligibilityStatus = pgEnum('eligibility_status', [
  'queued',
  'sent',
  'active',        // 271 confirms active coverage
  'inactive',      // 271 says coverage is not active
  'not_found',     // payer cannot identify the member (AAA 75)
  'payer_error',   // payer system unavailable (AAA 42/80)
  'invalid_request',
  'transport_error',
]);

/**
 * A single 270 request and its 271 response.
 *
 * The raw X12 in both directions is retained because a payer dispute is settled by what
 * was actually sent and received, not by our interpretation of it.
 */
export const eligibilityChecks = pgTable(
  'eligibility_checks',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    coverageId: uuid('coverage_id'),
    payerId: uuid('payer_id').notNull(),
    providerId: uuid('provider_id'),

    batchId: uuid('batch_id'),
    encounterId: uuid('encounter_id'),
    appointmentId: uuid('appointment_id'),

    trigger: eligibilityTrigger('trigger').notNull(),
    status: eligibilityStatus('status').notNull().default('queued'),

    /** Service type codes requested. 30 = generic health plan benefits. */
    serviceTypeCodes: text('service_type_codes').array(),
    serviceDate: date('service_date'),

    connector: text('connector'),
    connectorTransactionId: text('connector_transaction_id'),
    controlNumber: text('control_number'),

    requestedAt: timestamp('requested_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),

    /** Coverage window as the payer reports it, not as we have it on file. */
    reportedPlanBegin: date('reported_plan_begin'),
    reportedPlanEnd: date('reported_plan_end'),

    /**
     * AAA rejection reason when the payer refuses the request — 75 = subscriber not
     * found, 72 = invalid member ID, 42 = system unavailable. Distinguishing "we asked
     * badly" from "the payer is down" decides whether retrying can ever succeed.
     */
    rejectReasonCode: text('reject_reason_code'),
    rejectReasonText: text('reject_reason_text'),
    followUpActionCode: text('follow_up_action_code'),

    rawRequest: text('raw_request'),
    rawResponse: text('raw_response'),
    parsed: jsonb('parsed'),

    /**
     * True when the parsed benefits differ materially from the previous check for this
     * coverage. This is the whole point: a raw 271 dump is noise, a change in the
     * patient's financial position is a thing someone must act on.
     */
    hasChanges: boolean('has_changes').notNull().default(false),
    changeSummary: jsonb('change_summary'),

    ...timestamps,
  },
  (t) => [
    index('eligibility_checks_patient_idx').on(t.orgId, t.patientId, t.createdAt),
    index('eligibility_checks_coverage_idx').on(t.orgId, t.coverageId, t.createdAt),
    index('eligibility_checks_batch_idx').on(t.orgId, t.batchId),
    index('eligibility_checks_status_idx').on(t.orgId, t.status),
  ],
);

/**
 * One parsed EB segment from a 271.
 *
 * Payers commonly return dozens of EB loops — one per benefit category per service
 * type. Flattening them into rows is what turns "eligible: yes" into an answer to the
 * question the front desk actually has, which is "what do I collect from this patient
 * today".
 */
export const eligibilityBenefits = pgTable(
  'eligibility_benefits',
  {
    id: primaryId,
    orgId,
    eligibilityCheckId: uuid('eligibility_check_id').notNull(),

    /**
     * EB01 — 1=Active Coverage, 6=Inactive, A=Co-Insurance, B=Co-Payment,
     * C=Deductible, F=Limitations, G=Out of Pocket Max, I=Non-Covered.
     */
    benefitCode: text('benefit_code').notNull(),
    benefitDescription: text('benefit_description'),

    /** EB02 — IND / FAM / ESP. Tells you whether the amount is per person or per family. */
    coverageLevel: text('coverage_level'),
    /** EB03 — 30=health plan, 98=professional visit, 88=pharmacy, MH=mental health. */
    serviceTypeCode: text('service_type_code'),
    serviceTypeDescription: text('service_type_description'),

    /** EB04 — HMO / PPO / EPO / POS. */
    insuranceTypeCode: text('insurance_type_code'),
    planDescription: text('plan_description'),

    /** EB06 — 23=calendar year, 25=remaining, 27=visit, 29=admission. */
    timePeriodQualifier: text('time_period_qualifier'),

    /** EB07 — dollar amount, paired with C (deductible) or G (out-of-pocket max). */
    amountCents: money('amount_cents'),
    /** EB08 — percentage as basis points; 2000 = the patient pays 20% coinsurance. */
    percentBps: integer('percent_bps'),

    /** EB09/EB10 — visit or unit limits. */
    quantityQualifier: text('quantity_qualifier'),
    quantity: integer('quantity'),

    /** True when this benefit applies in network. Out-of-network rates differ sharply. */
    inNetwork: boolean('in_network'),

    /** Authorisation required for this benefit (EB11). */
    authorizationRequired: boolean('authorization_required'),

    messages: text('messages').array(),
    ...timestamps,
  },
  (t) => [
    index('eligibility_benefits_check_idx').on(t.orgId, t.eligibilityCheckId),
    index('eligibility_benefits_type_idx').on(
      t.eligibilityCheckId,
      t.serviceTypeCode,
      t.benefitCode,
    ),
  ],
);

export const eligibilityBatchStatus = pgEnum('eligibility_batch_status', [
  'draft',
  'queued',
  'running',
  'completed',
  'completed_with_errors',
  'cancelled',
]);

/**
 * A batch eligibility run.
 *
 * Batch verification is the operation front offices actually need — check tomorrow's
 * whole schedule, or an entire panel before month end — and it is either missing or
 * API-only in most competing products. Here it is a first-class UI operation with live
 * progress, exception grouping, and one-click fix-and-rerun.
 */
export const eligibilityBatches = pgTable(
  'eligibility_batches',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),

    name: text('name').notNull(),
    status: eligibilityBatchStatus('status').notNull().default('draft'),

    /**
     * How the member list was chosen:
     *   schedule_day  — everyone on a given day's schedule
     *   patient_list  — an explicit set of patients
     *   saved_view    — the result of a saved filter
     *   panel         — every active patient in the practice
     */
    sourceType: text('source_type').notNull(),
    sourceParams: jsonb('source_params').notNull().default({}),

    serviceDate: date('service_date'),
    serviceTypeCodes: text('service_type_codes').array(),

    totalCount: integer('total_count').notNull().default(0),
    completedCount: integer('completed_count').notNull().default(0),
    activeCount: integer('active_count').notNull().default(0),
    inactiveCount: integer('inactive_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    changedCount: integer('changed_count').notNull().default(0),

    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    /** Set for scheduled recurring runs, e.g. every weekday at 18:00. */
    scheduleCron: text('schedule_cron'),
    scheduleTimezone: text('schedule_timezone'),

    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [
    index('eligibility_batches_practice_idx').on(t.orgId, t.practiceId, t.createdAt),
    index('eligibility_batches_status_idx').on(t.orgId, t.status),
  ],
);
