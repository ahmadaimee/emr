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

export const remittanceStatus = pgEnum('remittance_status', [
  'received',
  'parsed',
  'balanced',
  'out_of_balance',
  'posting',
  'posted',
  'partially_posted',
  'failed',
]);

/**
 * An 835 remittance advice — one payer payment covering many claims.
 *
 * `out_of_balance` is a real, routine state, not an error condition: CLP totals
 * frequently fail to equal the sum of their SVC lines plus CAS adjustments. Treating
 * that as an exception to be worked, rather than crashing the posting run or silently
 * forcing a balance, is the difference between a posting engine that can be trusted and
 * one that quietly corrupts A/R.
 */
export const remittances = pgTable(
  'remittances',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id'),
    payerId: uuid('payer_id'),

    status: remittanceStatus('status').notNull().default('received'),

    /** BPR — how and how much the payer paid. */
    paymentMethod: text('payment_method'),     // ACH | CHK | FWT | NON
    totalPaidCents: money('total_paid_cents').notNull().default(0),
    paymentDate: date('payment_date'),

    /** TRN02 — the reassociation trace number tying the 835 to the actual deposit. */
    traceNumber: text('trace_number'),
    payerIdentifier: text('payer_identifier'),
    checkNumber: text('check_number'),

    payerName: text('payer_name'),
    payeeName: text('payee_name'),
    payeeNpi: text('payee_npi'),

    /** Sum of child CLP paid amounts, for reconciliation against totalPaidCents. */
    computedClaimTotalCents: money('computed_claim_total_cents').notNull().default(0),
    /** Sum of PLB adjustments, which are NOT tied to any individual claim. */
    providerAdjustmentTotalCents: money('provider_adjustment_total_cents')
      .notNull()
      .default(0),
    balanceVarianceCents: money('balance_variance_cents').notNull().default(0),

    connector: text('connector'),
    connectorFileId: text('connector_file_id'),
    /** Object-store key for the raw 835. Retained for dispute resolution. */
    rawFileKey: text('raw_file_key'),
    fileName: text('file_name'),

    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    postedBy: uuid('posted_by'),

    ...timestamps,
  },
  (t) => [
    index('remittances_org_status_idx').on(t.orgId, t.status),
    index('remittances_payment_date_idx').on(t.orgId, t.paymentDate),
    uniqueIndex('remittances_trace_key').on(t.orgId, t.traceNumber, t.payerIdentifier),
  ],
);

/** CLP — the claim-level result inside an 835. */
export const remittanceClaims = pgTable(
  'remittance_claims',
  {
    id: primaryId,
    orgId,
    remittanceId: uuid('remittance_id').notNull(),
    /** Resolved by matching CLP01 to claims.claimNumber. Null when unmatched. */
    claimId: uuid('claim_id'),

    /** CLP01 — the patient control number we sent. */
    patientControlNumber: text('patient_control_number').notNull(),
    /**
     * CLP02 — 1 processed as primary, 2 as secondary, 3 as tertiary, 4 denied,
     * 19/20/21 processed as primary/secondary/tertiary forwarded to the next payer,
     * 22 reversal of previous payment.
     */
    claimStatusCode: text('claim_status_code').notNull(),

    totalChargeCents: money('total_charge_cents').notNull().default(0),
    totalPaidCents: money('total_paid_cents').notNull().default(0),
    patientResponsibilityCents: money('patient_responsibility_cents').notNull().default(0),

    /** CLP07 — the payer's own claim control number, needed to file a corrected claim. */
    payerClaimControlNumber: text('payer_claim_control_number'),
    claimFilingIndicator: text('claim_filing_indicator'),

    /** Where the payer says the remaining balance goes, when it forwards to another payer. */
    crossoverCarrierName: text('crossover_carrier_name'),
    crossoverCarrierId: text('crossover_carrier_id'),

    /** MOA/MIA remark codes at claim level. */
    remarkCodes: text('remark_codes').array(),

    /** True when CLP paid does not equal the sum of its SVC lines. */
    outOfBalance: boolean('out_of_balance').notNull().default(false),
    varianceCents: money('variance_cents').notNull().default(0),

    postedAt: timestamp('posted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('remittance_claims_remittance_idx').on(t.orgId, t.remittanceId),
    index('remittance_claims_claim_idx').on(t.orgId, t.claimId),
    index('remittance_claims_unmatched_idx').on(t.orgId, t.claimId, t.patientControlNumber),
  ],
);

/** SVC — the service-line result inside an 835. */
export const remittanceLines = pgTable(
  'remittance_lines',
  {
    id: primaryId,
    orgId,
    remittanceClaimId: uuid('remittance_claim_id').notNull(),
    /** Resolved to the originating service line where possible. */
    serviceLineId: uuid('service_line_id'),

    lineNumber: integer('line_number'),

    procedureCode: text('procedure_code').notNull(),
    modifier1: text('modifier1'),
    modifier2: text('modifier2'),
    modifier3: text('modifier3'),
    modifier4: text('modifier4'),

    /** The procedure the payer actually adjudicated, when it re-coded the line. */
    adjudicatedProcedureCode: text('adjudicated_procedure_code'),

    chargeCents: money('charge_cents').notNull().default(0),
    paidCents: money('paid_cents').notNull().default(0),
    allowedCents: money('allowed_cents').notNull().default(0),

    unitsBilled: integer('units_billed'),
    unitsPaid: integer('units_paid'),

    serviceDate: date('service_date'),
    remarkCodes: text('remark_codes').array(),

    /**
     * Contract variance: expected allowed minus actual allowed. Positive means the
     * payer underpaid relative to the contracted rate. This is computed at posting
     * time so underpayments surface as work, not as a report nobody runs.
     */
    expectedAllowedCents: money('expected_allowed_cents'),
    underpaymentCents: money('underpayment_cents'),

    ...timestamps,
  },
  (t) => [
    index('remittance_lines_claim_idx').on(t.orgId, t.remittanceClaimId),
    index('remittance_lines_service_line_idx').on(t.orgId, t.serviceLineId),
    index('remittance_lines_underpayment_idx').on(t.orgId, t.underpaymentCents),
  ],
);

/**
 * CAS group codes. These decide what may be posted automatically:
 *
 *   CO — contractual obligation: a write-off. Safe to auto-post.
 *   PR — patient responsibility: the ONLY group that may be billed to the patient.
 *   OA — other adjustment: catch-all, meaning is context-dependent.
 *   PI — payer-initiated reduction, not supported by contract.
 *   CR — correction/reversal of a prior payment.
 *
 * OA and PI are deliberately NOT auto-posted. They routinely carry denials and
 * unilateral reductions that a human should see before they vanish into a write-off.
 */
export const casGroupCode = pgEnum('cas_group_code', ['CO', 'PR', 'OA', 'PI', 'CR']);

export const remittanceAdjustments = pgTable(
  'remittance_adjustments',
  {
    id: primaryId,
    orgId,
    /** Exactly one of these is set: adjustments occur at claim OR line level. */
    remittanceClaimId: uuid('remittance_claim_id'),
    remittanceLineId: uuid('remittance_line_id'),

    groupCode: casGroupCode('group_code').notNull(),
    /** CARC — the reason code, e.g. 45 fee schedule, 1 deductible, 97 bundled. */
    reasonCode: text('reason_code').notNull(),
    reasonDescription: text('reason_description'),

    amountCents: money('amount_cents').notNull(),
    quantity: integer('quantity'),

    /** True when this adjustment represents a denial rather than a routine write-off. */
    isDenial: boolean('is_denial').notNull().default(false),

    ...timestamps,
  },
  (t) => [
    index('remittance_adjustments_claim_idx').on(t.orgId, t.remittanceClaimId),
    index('remittance_adjustments_line_idx').on(t.orgId, t.remittanceLineId),
    index('remittance_adjustments_reason_idx').on(t.orgId, t.groupCode, t.reasonCode),
  ],
);

/**
 * PLB — provider-level adjustments. These are not attached to any claim: recoupments,
 * capitation payments, interest, penalties. They must be posted to a suspense or
 * provider-level account, never forced onto a claim to make totals balance.
 */
export const providerLevelAdjustments = pgTable(
  'provider_level_adjustments',
  {
    id: primaryId,
    orgId,
    remittanceId: uuid('remittance_id').notNull(),

    providerIdentifier: text('provider_identifier'),
    fiscalPeriodDate: date('fiscal_period_date'),

    /** PLB03-1, e.g. WO withholding, FB forwarding balance, L6 interest, CS adjustment. */
    adjustmentReasonCode: text('adjustment_reason_code').notNull(),
    referenceIdentifier: text('reference_identifier'),
    amountCents: money('amount_cents').notNull(),

    /** Set when a recoupment could be traced back to the claim it claws back. */
    relatedClaimId: uuid('related_claim_id'),

    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('provider_level_adjustments_remittance_idx').on(t.orgId, t.remittanceId)],
);

/**
 * A denial, promoted out of the raw CAS rows into something workable.
 *
 * Denials are records with an owner and a state, not a report. Each carries the
 * taxonomy bucket it was classified into, the suggested remedy, and whether that remedy
 * can be applied automatically.
 */
export const denials = pgTable(
  'denials',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    claimId: uuid('claim_id').notNull(),
    remittanceClaimId: uuid('remittance_claim_id'),
    remittanceLineId: uuid('remittance_line_id'),

    payerId: uuid('payer_id').notNull(),
    groupCode: text('group_code').notNull(),
    reasonCode: text('reason_code').notNull(),
    remarkCodes: text('remark_codes').array(),

    deniedAmountCents: money('denied_amount_cents').notNull().default(0),

    /**
     * Taxonomy bucket — eligibility, authorization, coding, medical_necessity,
     * timely_filing, duplicate, coordination_of_benefits, credentialing, bundling,
     * documentation, non_covered, other. This is what makes denial analytics mean
     * anything; raw CARC codes are too granular to steer operations by.
     */
    category: text('category').notNull(),
    /** True when the root cause was ours and was preventable. Drives process fixes. */
    preventable: boolean('preventable'),

    /** rebill | corrected_claim | appeal | write_off | bill_patient | request_records */
    suggestedAction: text('suggested_action'),
    suggestedActionDetail: jsonb('suggested_action_detail'),
    /** True when the fix is deterministic enough to apply without review. */
    autoResolvable: boolean('auto_resolvable').notNull().default(false),

    /** open | in_progress | appealed | resolved | written_off | abandoned */
    status: text('status').notNull().default('open'),
    workQueueId: uuid('work_queue_id'),
    assignedTo: uuid('assigned_to'),

    appealDeadline: date('appeal_deadline'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    recoveredAmountCents: money('recovered_amount_cents').notNull().default(0),

    ...timestamps,
  },
  (t) => [
    index('denials_status_idx').on(t.orgId, t.practiceId, t.status),
    index('denials_category_idx').on(t.orgId, t.category, t.createdAt),
    index('denials_payer_idx').on(t.orgId, t.payerId, t.reasonCode),
    index('denials_assigned_idx').on(t.orgId, t.assignedTo, t.status),
    index('denials_deadline_idx').on(t.orgId, t.status, t.appealDeadline),
  ],
);
