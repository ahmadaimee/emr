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
import { citext } from './_types';

export const patientSex = pgEnum('patient_sex', ['M', 'F', 'U']);

export const patients = pgTable(
  'patients',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),

    /** Human-facing account number, unique within the practice. */
    mrn: text('mrn').notNull(),

    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    middleName: text('middle_name'),
    suffix: text('suffix'),
    preferredName: text('preferred_name'),

    dateOfBirth: date('date_of_birth').notNull(),

    /**
     * Administrative sex as the payer knows it — this is what must match the 271 and
     * what payers edit against. Clinical gender identity is a separate concept and
     * belongs with the clinical record, not here; conflating them breaks claims.
     */
    sex: patientSex('sex').notNull(),

    /**
     * SSN is encrypted at the application layer and stored with its key version so the
     * key can be rotated without a destructive migration. Most claims never need it.
     */
    ssnEncrypted: text('ssn_encrypted'),
    ssnKeyVersion: integer('ssn_key_version'),
    /** Last four, kept in clear for search and identity confirmation. */
    ssnLast4: text('ssn_last4'),

    email: citext('email'),
    phoneHome: text('phone_home'),
    phoneMobile: text('phone_mobile'),

    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    countryCode: text('country_code').notNull().default('US'),

    /** Communication preferences drive statement delivery and text-to-pay. */
    preferredLanguage: text('preferred_language').notNull().default('en'),
    allowSms: boolean('allow_sms').notNull().default(false),
    allowEmail: boolean('allow_email').notNull().default(false),
    statementDeliveryMethod: text('statement_delivery_method').notNull().default('mail'),

    deceasedDate: date('deceased_date'),

    /**
     * Set when this record has been merged into another. The row is retained rather
     * than deleted so that historical claims keep pointing at something real and the
     * audit trail stays intact.
     */
    mergedIntoPatientId: uuid('merged_into_patient_id'),
    mergedAt: timestamp('merged_at', { withTimezone: true }),

    ...timestamps,
  },
  (t) => [
    uniqueIndex('patients_practice_mrn_key').on(t.orgId, t.practiceId, t.mrn),
    index('patients_name_idx').on(t.orgId, t.practiceId, t.lastName, t.firstName),
    index('patients_dob_idx').on(t.orgId, t.dateOfBirth),
    index('patients_active_idx').on(t.orgId, t.practiceId, t.mergedIntoPatientId),
  ],
);

/**
 * Candidate duplicates surfaced by the matching job. Duplicates are proposed, never
 * merged automatically — an incorrect auto-merge blends two people's clinical and
 * financial histories, which is far harder to unwind than a missed duplicate.
 */
export const patientMatchCandidates = pgTable(
  'patient_match_candidates',
  {
    id: primaryId,
    orgId,
    patientId: uuid('patient_id').notNull(),
    candidatePatientId: uuid('candidate_patient_id').notNull(),

    /** 0-1000. Deterministic (exact SSN/DOB+name) scores higher than fuzzy. */
    score: integer('score').notNull(),
    /** Which comparators fired, so a human can see why this was proposed. */
    signals: jsonb('signals').notNull(),

    /** pending | confirmed_duplicate | not_duplicate | merged */
    status: text('status').notNull().default('pending'),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

    ...timestamps,
  },
  (t) => [
    uniqueIndex('patient_match_pair_key').on(t.patientId, t.candidatePatientId),
    index('patient_match_status_idx').on(t.orgId, t.status, t.score),
  ],
);

/**
 * The financially responsible party, when that is not the patient. Statements address
 * the guarantor, not the patient.
 */
export const guarantors = pgTable(
  'guarantors',
  {
    id: primaryId,
    orgId,
    patientId: uuid('patient_id').notNull(),

    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    /** 18=self, 01=spouse, 19=child, G8=other. Mirrors the 837 relationship codes. */
    relationshipCode: text('relationship_code').notNull().default('18'),
    dateOfBirth: date('date_of_birth'),

    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    phone: text('phone'),
    email: citext('email'),

    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('guarantors_patient_idx').on(t.orgId, t.patientId)],
);
