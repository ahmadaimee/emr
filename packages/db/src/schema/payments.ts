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

export const paymentSource = pgEnum('payment_source', [
  'era',
  'manual_eob',
  'patient_card',
  'patient_ach',
  'patient_check',
  'patient_cash',
  'payment_plan',
  'refund',
]);

/**
 * A reconciliation unit: one EFT deposit, one check, one day's card settlement. Every
 * payment belongs to a batch, and a batch is closed only when its posted total equals
 * the amount that actually hit the bank.
 */
export const paymentBatches = pgTable(
  'payment_batches',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),

    /** era | patient | manual */
    batchType: text('batch_type').notNull(),
    depositDate: date('deposit_date').notNull(),
    expectedTotalCents: money('expected_total_cents').notNull().default(0),
    postedTotalCents: money('posted_total_cents').notNull().default(0),

    bankReference: text('bank_reference'),
    remittanceId: uuid('remittance_id'),

    /** open | posting | balanced | closed | out_of_balance */
    status: text('status').notNull().default('open'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: uuid('closed_by'),
    ...timestamps,
  },
  (t) => [index('payment_batches_practice_idx').on(t.orgId, t.practiceId, t.depositDate)],
);

export const payments = pgTable(
  'payments',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    paymentBatchId: uuid('payment_batch_id').notNull(),

    source: paymentSource('source').notNull(),
    /** Exactly one of these is set. */
    payerId: uuid('payer_id'),
    patientId: uuid('patient_id'),

    amountCents: money('amount_cents').notNull(),
    receivedDate: date('received_date').notNull(),

    /** Check number, EFT trace, or card authorisation code. */
    reference: text('reference'),
    remittanceId: uuid('remittance_id'),

    /** Stripe identifiers. Card data itself is never stored — SAQ A scope. */
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeChargeId: text('stripe_charge_id'),
    cardBrand: text('card_brand'),
    cardLast4: text('card_last4'),

    /** How much of this payment has been applied to service lines. */
    appliedCents: money('applied_cents').notNull().default(0),
    unappliedCents: money('unapplied_cents').notNull().default(0),

    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason'),
    ...timestamps,
  },
  (t) => [
    index('payments_batch_idx').on(t.orgId, t.paymentBatchId),
    index('payments_patient_idx').on(t.orgId, t.patientId, t.receivedDate),
    index('payments_unapplied_idx').on(t.orgId, t.unappliedCents),
    uniqueIndex('payments_stripe_intent_key').on(t.stripePaymentIntentId),
  ],
);

/** Money applied from a payment to a specific service line. Produces a ledger entry. */
export const paymentApplications = pgTable(
  'payment_applications',
  {
    id: primaryId,
    orgId,
    paymentId: uuid('payment_id').notNull(),
    serviceLineId: uuid('service_line_id').notNull(),
    claimId: uuid('claim_id'),
    amountCents: money('amount_cents').notNull(),
    ledgerEntryId: uuid('ledger_entry_id'),
    appliedBy: uuid('applied_by'),
    reversalOfId: uuid('reversal_of_id'),
    ...timestamps,
  },
  (t) => [
    index('payment_applications_payment_idx').on(t.orgId, t.paymentId),
    index('payment_applications_line_idx').on(t.orgId, t.serviceLineId),
  ],
);

/** A saved payment method, held by Stripe. We keep only the token and display data. */
export const patientPaymentMethods = pgTable(
  'patient_payment_methods',
  {
    id: primaryId,
    orgId,
    patientId: uuid('patient_id').notNull(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripePaymentMethodId: text('stripe_payment_method_id').notNull(),
    /** card | us_bank_account */
    methodType: text('method_type').notNull(),
    brand: text('brand'),
    last4: text('last4'),
    expMonth: integer('exp_month'),
    expYear: integer('exp_year'),
    isDefault: boolean('is_default').notNull().default(false),
    /** Consent to charge patient responsibility automatically once adjudicated. */
    autoChargeConsentAt: timestamp('auto_charge_consent_at', { withTimezone: true }),
    autoChargeMaxCents: money('auto_charge_max_cents'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('patient_payment_methods_patient_idx').on(t.orgId, t.patientId),
    uniqueIndex('patient_payment_methods_stripe_key').on(t.stripePaymentMethodId),
  ],
);

export const paymentPlans = pgTable(
  'payment_plans',
  {
    id: primaryId,
    orgId,
    patientId: uuid('patient_id').notNull(),
    practiceId: uuid('practice_id').notNull(),
    paymentMethodId: uuid('payment_method_id'),

    totalCents: money('total_cents').notNull(),
    installmentCents: money('installment_cents').notNull(),
    /** weekly | biweekly | monthly */
    frequency: text('frequency').notNull().default('monthly'),
    nextChargeDate: date('next_charge_date').notNull(),
    paidCents: money('paid_cents').notNull().default(0),

    /** active | completed | defaulted | cancelled */
    status: text('status').notNull().default('active'),
    missedPayments: integer('missed_payments').notNull().default(0),
    agreedAt: timestamp('agreed_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('payment_plans_next_charge_idx').on(t.orgId, t.status, t.nextChargeDate)],
);

export const statementStatus = pgEnum('statement_status', [
  'draft',
  'queued',
  'sent',
  'delivered',
  'viewed',
  'paid',
  'returned',
  'cancelled',
]);

/** A patient statement. Addressed to the guarantor, not the patient, when they differ. */
export const patientStatements = pgTable(
  'patient_statements',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    guarantorId: uuid('guarantor_id'),
    statementRunId: uuid('statement_run_id'),

    statementNumber: text('statement_number').notNull(),
    /** 1 = first notice, 2 = second, and so on through the dunning cycle. */
    cycleNumber: integer('cycle_number').notNull().default(1),
    statementDate: date('statement_date').notNull(),
    dueDate: date('due_date').notNull(),

    previousBalanceCents: money('previous_balance_cents').notNull().default(0),
    newChargesCents: money('new_charges_cents').notNull().default(0),
    paymentsCents: money('payments_cents').notNull().default(0),
    adjustmentsCents: money('adjustments_cents').notNull().default(0),
    balanceDueCents: money('balance_due_cents').notNull().default(0),

    /** mail | email | sms | portal — pluggable delivery adapters. */
    deliveryMethod: text('delivery_method').notNull(),
    status: statementStatus('status').notNull().default('draft'),
    documentId: uuid('document_id'),
    /** Short-lived, unguessable token behind the text-to-pay link. */
    payLinkToken: text('pay_link_token'),
    payLinkExpiresAt: timestamp('pay_link_expires_at', { withTimezone: true }),

    vendorReference: text('vendor_reference'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    /** 0-1000 propensity-to-pay score with drivers, for routing and tone. */
    propensityScore: integer('propensity_score'),
    propensityFactors: jsonb('propensity_factors'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('patient_statements_number_key').on(t.orgId, t.statementNumber),
    index('patient_statements_patient_idx').on(t.orgId, t.patientId, t.statementDate),
    index('patient_statements_status_idx').on(t.orgId, t.status),
    uniqueIndex('patient_statements_pay_link_key').on(t.payLinkToken),
  ],
);

export const statementLines = pgTable(
  'statement_lines',
  {
    id: primaryId,
    orgId,
    statementId: uuid('statement_id').notNull(),
    encounterId: uuid('encounter_id'),
    serviceLineId: uuid('service_line_id'),
    serviceDate: date('service_date'),
    description: text('description').notNull(),
    chargeCents: money('charge_cents').notNull().default(0),
    insurancePaidCents: money('insurance_paid_cents').notNull().default(0),
    adjustmentCents: money('adjustment_cents').notNull().default(0),
    patientPaidCents: money('patient_paid_cents').notNull().default(0),
    balanceCents: money('balance_cents').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('statement_lines_statement_idx').on(t.orgId, t.statementId)],
);

/** A statement generation run across a practice. */
export const statementRuns = pgTable(
  'statement_runs',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    runDate: date('run_date').notNull(),
    minimumBalanceCents: money('minimum_balance_cents').notNull().default(500),
    /** draft | generating | review | sent | cancelled */
    status: text('status').notNull().default('draft'),
    statementCount: integer('statement_count').notNull().default(0),
    totalBalanceCents: money('total_balance_cents').notNull().default(0),
    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [index('statement_runs_practice_idx').on(t.orgId, t.practiceId, t.runDate)],
);

/** Escalation policy: when to send each cycle and when to hand off to collections. */
export const dunningPolicies = pgTable(
  'dunning_policies',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id'),
    name: text('name').notNull(),
    /** [{ cycle: 1, dayOffset: 0, tone: 'friendly' }, { cycle: 2, dayOffset: 30 }, ...] */
    schedule: jsonb('schedule').notNull(),
    minimumBalanceCents: money('minimum_balance_cents').notNull().default(500),
    collectionsAfterDays: integer('collections_after_days'),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('dunning_policies_practice_idx').on(t.orgId, t.practiceId)],
);
