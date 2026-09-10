import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';
import { money } from './_types';

export const payerType = pgEnum('payer_type', [
  'medicare',
  'medicaid',
  'commercial',
  'blue_cross',
  'tricare',
  'champva',
  'workers_comp',
  'auto_medical',
  'self_pay',
  'other',
]);

export const payers = pgTable(
  'payers',
  {
    id: primaryId,
    orgId,
    name: text('name').notNull(),
    type: payerType('type').notNull(),

    /**
     * The clearinghouse's payer ID — this is what actually routes the claim, and it
     * differs per clearinghouse for the same real-world payer. Keyed by connector in
     * `payer_connector_ids` rather than assumed to be universal.
     */
    payerIdCode: text('payer_id_code'),

    /**
     * SBR09 claim filing indicator (MB=Medicare Part B, MC=Medicaid, CI=Commercial,
     * BL=Blue Cross, HM=HMO, ...). Getting this wrong causes payer routing failures.
     */
    claimFilingIndicator: text('claim_filing_indicator'),

    /** Where paper claims go when a payer will not take EDI. */
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),

    supportsEligibility: boolean('supports_eligibility').notNull().default(true),
    supportsClaimStatus: boolean('supports_claim_status').notNull().default(true),
    supportsEra: boolean('supports_era').notNull().default(true),
    supportsSecondaryElectronic: boolean('supports_secondary_electronic')
      .notNull()
      .default(true),

    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('payers_org_idx').on(t.orgId),
    index('payers_name_idx').on(t.orgId, t.name),
  ],
);

/**
 * The same payer has a different ID at every clearinghouse. Keeping these per connector
 * is what makes the clearinghouse genuinely swappable — and multi-sourcing is a
 * resilience requirement, not a preference, after the 2024 Change Healthcare outage
 * took a single point of failure offline for the entire industry.
 */
export const payerConnectorIds = pgTable(
  'payer_connector_ids',
  {
    id: primaryId,
    orgId,
    payerId: uuid('payer_id').notNull(),
    /** claimmd | stedi | availity | ... */
    connector: text('connector').notNull(),
    connectorPayerId: text('connector_payer_id').notNull(),
    /** Some connectors use a different ID for eligibility than for claims. */
    connectorEligibilityPayerId: text('connector_eligibility_payer_id'),
    enrollmentRequired: boolean('enrollment_required').notNull().default(false),
    enrollmentStatus: text('enrollment_status').notNull().default('not_required'),
    ...timestamps,
  },
  (t) => [uniqueIndex('payer_connector_key').on(t.payerId, t.connector)],
);

/**
 * A specific plan under a payer. Timely filing lives here because it is plan-specific,
 * and because a claim approaching its filing deadline otherwise looks exactly like any
 * other aging claim right up until it becomes permanently uncollectible. Nothing in the
 * normal claim lifecycle generates a warning — so we generate one.
 */
export const payerPlans = pgTable(
  'payer_plans',
  {
    id: primaryId,
    orgId,
    payerId: uuid('payer_id').notNull(),
    name: text('name').notNull(),
    planType: text('plan_type'), // HMO | PPO | EPO | POS | HDHP

    /** Days from date of service to file an original claim. */
    timelyFilingDays: integer('timely_filing_days'),
    /** Days from the primary remittance date to file a secondary claim. */
    timelyFilingSecondaryDays: integer('timely_filing_secondary_days'),
    /** Days from remittance to file an appeal. */
    appealFilingDays: integer('appeal_filing_days'),

    ...timestamps,
  },
  (t) => [index('payer_plans_payer_idx').on(t.orgId, t.payerId)],
);

/**
 * A negotiated contract between a practice and a payer. This is the input to
 * underpayment detection — the industry-wide blind spot. Without contracted rates
 * loaded, "the payer paid something" is indistinguishable from "the payer paid
 * correctly", which is precisely why underpayments go uncollected everywhere.
 */
export const payerContracts = pgTable(
  'payer_contracts',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    payerId: uuid('payer_id').notNull(),
    planId: uuid('plan_id'),

    name: text('name').notNull(),
    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),

    /**
     * How the contract prices services:
     *   fee_schedule        — explicit per-code allowed amounts
     *   medicare_percentage — a multiple of the Medicare Physician Fee Schedule
     *   case_rate | capitation | percent_of_charges
     */
    reimbursementMethod: text('reimbursement_method').notNull().default('fee_schedule'),
    /** e.g. 1.25 for 125% of Medicare. Stored as basis points to stay exact. */
    medicarePercentageBps: integer('medicare_percentage_bps'),
    /** Which MPFS locality applies, when priced off Medicare. */
    medicareLocality: text('medicare_locality'),

    /** Tolerance before a variance is treated as an underpayment worth working. */
    underpaymentToleranceCents: money('underpayment_tolerance_cents').notNull().default(0),

    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('payer_contracts_lookup_idx').on(t.orgId, t.practiceId, t.payerId),
    index('payer_contracts_effective_idx').on(t.orgId, t.effectiveDate, t.terminationDate),
  ],
);

export const feeSchedules = pgTable(
  'fee_schedules',
  {
    id: primaryId,
    orgId,
    contractId: uuid('contract_id'),
    practiceId: uuid('practice_id'),
    name: text('name').notNull(),
    /** charge | allowed | medicare */
    scheduleType: text('schedule_type').notNull().default('allowed'),
    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),
    ...timestamps,
  },
  (t) => [index('fee_schedules_contract_idx').on(t.orgId, t.contractId)],
);

/**
 * A priced line. Facility and non-facility rates are held separately because place of
 * service swings reimbursement materially — POS 02 vs POS 10 for telehealth can differ
 * by 20-40%, and comparing a payment against the wrong one manufactures phantom
 * underpayments.
 */
export const feeScheduleLines = pgTable(
  'fee_schedule_lines',
  {
    id: primaryId,
    orgId,
    feeScheduleId: uuid('fee_schedule_id').notNull(),

    procedureCode: text('procedure_code').notNull(),
    /** Modifiers that change the rate, e.g. 26 professional / TC technical. */
    modifier1: text('modifier1'),
    modifier2: text('modifier2'),

    nonFacilityRateCents: money('non_facility_rate_cents'),
    facilityRateCents: money('facility_rate_cents'),

    /** RVU components, for contracts priced off the Medicare fee schedule. */
    workRvu: integer('work_rvu_millis'),
    practiceExpenseRvu: integer('practice_expense_rvu_millis'),
    malpracticeRvu: integer('malpractice_rvu_millis'),

    effectiveDate: date('effective_date'),
    terminationDate: date('termination_date'),
    ...timestamps,
  },
  (t) => [
    index('fee_schedule_lines_lookup_idx').on(
      t.orgId,
      t.feeScheduleId,
      t.procedureCode,
    ),
  ],
);

/** Per-payer behaviour learned from history, used to self-tune follow-up cadence. */
export const payerBehaviorStats = pgTable(
  'payer_behavior_stats',
  {
    id: primaryId,
    orgId,
    payerId: uuid('payer_id').notNull(),
    practiceId: uuid('practice_id'),

    /** Observed days from submission to first remittance. */
    medianDaysToRemit: integer('median_days_to_remit'),
    p90DaysToRemit: integer('p90_days_to_remit'),
    medianDaysToAcknowledge: integer('median_days_to_acknowledge'),

    denialRateBps: integer('denial_rate_bps'),
    firstPassRateBps: integer('first_pass_rate_bps'),

    sampleSize: integer('sample_size').notNull().default(0),
    computedAt: date('computed_at'),
    detail: jsonb('detail'),
    ...timestamps,
  },
  (t) => [uniqueIndex('payer_behavior_key').on(t.orgId, t.payerId, t.practiceId)],
);
