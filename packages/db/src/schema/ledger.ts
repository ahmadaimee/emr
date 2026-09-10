import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgId, primaryId } from './_shared';
import { money } from './_types';

export const ledgerEntryType = pgEnum('ledger_entry_type', [
  'charge',
  'payment_insurance',
  'payment_patient',
  'contractual_adjustment',
  'write_off',
  'transfer_to_patient',
  'transfer_to_secondary',
  'refund',
  'recoupment',
  'interest',
  'reversal',
  'bad_debt',
]);

export const responsibilityParty = pgEnum('responsibility_party', [
  'insurance',
  'patient',
  'none',
]);

/**
 * The financial ledger. Every dollar that moves through the system is one row here.
 *
 * APPEND-ONLY. There is no `updatedAt`, no UPDATE privilege and no DELETE privilege
 * for the application role. A mistake is corrected by a reversal entry that points at
 * the entry it reverses — never by editing history. Balances on claims, service lines
 * and patients are DERIVED from this table and reconciled against it nightly; if the
 * two ever disagree, there is a bug and the ledger is right.
 *
 * Retrofitting a ledger onto a year of mutable balance columns is the most expensive
 * remediation in this domain. It is built on day one for that reason.
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    encounterId: uuid('encounter_id'),
    claimId: uuid('claim_id'),
    serviceLineId: uuid('service_line_id'),

    entryType: ledgerEntryType('entry_type').notNull(),

    /** Signed. Debits (charges) are positive; credits (payments, adjustments) negative. */
    amountCents: money('amount_cents').notNull(),

    /** Whose balance this entry affects. */
    responsibility: responsibilityParty('responsibility').notNull(),
    payerId: uuid('payer_id'),

    /** Accounting period the entry belongs to. */
    postingDate: date('posting_date').notNull(),
    /** Date of service, for aging. */
    serviceDate: date('service_date').notNull(),

    /** Provenance: which remittance line, payment, or action produced this. */
    sourceType: text('source_type').notNull(),
    sourceId: uuid('source_id').notNull(),

    /** Set on a reversal, pointing at the entry it cancels. */
    reversesEntryId: uuid('reverses_entry_id'),
    paymentBatchId: uuid('payment_batch_id'),

    note: text('note'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ledger_entries_claim_idx').on(t.orgId, t.claimId),
    index('ledger_entries_patient_idx').on(t.orgId, t.patientId, t.responsibility),
    index('ledger_entries_posting_idx').on(t.orgId, t.practiceId, t.postingDate),
    index('ledger_entries_service_line_idx').on(t.orgId, t.serviceLineId),
    index('ledger_entries_source_idx').on(t.sourceType, t.sourceId),
  ],
);

/**
 * Derived balances, maintained by trigger for read speed and reconciled nightly
 * against `sum(ledger_entries.amount_cents)`. A variance is an alarm, not a rounding
 * error to be absorbed.
 */
export const balanceSnapshots = pgTable(
  'balance_snapshots',
  {
    id: primaryId,
    orgId,
    /** claim | patient | service_line */
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),

    insuranceBalanceCents: money('insurance_balance_cents').notNull().default(0),
    patientBalanceCents: money('patient_balance_cents').notNull().default(0),
    totalChargedCents: money('total_charged_cents').notNull().default(0),
    totalPaidCents: money('total_paid_cents').notNull().default(0),
    totalAdjustedCents: money('total_adjusted_cents').notNull().default(0),

    lastEntryAt: timestamp('last_entry_at', { withTimezone: true }),
    lastReconciledAt: timestamp('last_reconciled_at', { withTimezone: true }),
    /** Non-zero means the snapshot and the ledger disagree. */
    reconciliationVarianceCents: money('reconciliation_variance_cents').notNull().default(0),
  },
  (t) => [
    uniqueIndex('balance_snapshots_subject_key').on(t.subjectType, t.subjectId),
    index('balance_snapshots_variance_idx').on(t.orgId, t.reconciliationVarianceCents),
  ],
);
