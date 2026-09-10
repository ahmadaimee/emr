import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';
import { citext } from './_types';

/**
 * Coverage rank. This single column drives coordination of benefits: when a primary
 * remittance posts and a rank-2 coverage exists, the secondary claim builds itself.
 * Rekeying the secondary from a paper EOB is the manual step this replaces.
 */
export const coverageRank = pgEnum('coverage_rank', [
  'primary',
  'secondary',
  'tertiary',
]);

export const coverages = pgTable(
  'coverages',
  {
    id: primaryId,
    orgId,
    patientId: uuid('patient_id').notNull(),
    payerId: uuid('payer_id').notNull(),
    planId: uuid('plan_id'),

    rank: coverageRank('rank').notNull(),

    /** Case-insensitive: payers are inconsistent about member ID casing. */
    memberId: citext('member_id').notNull(),
    groupNumber: text('group_number'),
    groupName: text('group_name'),

    /**
     * Subscriber relationship to the patient, using 837 codes:
     * 18=self, 01=spouse, 19=child, 20=employee, 21=unknown, G8=other.
     * When this is not '18', the 837 needs a separate 2000C patient loop.
     */
    relationshipCode: text('relationship_code').notNull().default('18'),

    /** Subscriber demographics, required when the subscriber is not the patient. */
    subscriberFirstName: text('subscriber_first_name'),
    subscriberLastName: text('subscriber_last_name'),
    subscriberDateOfBirth: date('subscriber_date_of_birth'),
    subscriberSex: text('subscriber_sex'),
    subscriberAddressLine1: text('subscriber_address_line1'),
    subscriberCity: text('subscriber_city'),
    subscriberState: text('subscriber_state'),
    subscriberPostalCode: text('subscriber_postal_code'),

    effectiveDate: date('effective_date'),
    terminationDate: date('termination_date'),

    /** CMS-1500 box 27 / 837 CLM08. */
    assignmentOfBenefits: boolean('assignment_of_benefits').notNull().default(true),
    releaseOfInformation: text('release_of_information').notNull().default('Y'),

    /**
     * Denormalised snapshot of the most recent eligibility check, so lists and
     * schedules can show coverage state without joining through the full history.
     */
    lastVerifiedAt: date('last_verified_at'),
    lastVerifiedStatus: text('last_verified_status'),
    lastVerifiedEligibilityId: uuid('last_verified_eligibility_id'),

    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('coverages_patient_idx').on(t.orgId, t.patientId, t.rank),
    index('coverages_payer_idx').on(t.orgId, t.payerId),
    index('coverages_verification_idx').on(t.orgId, t.active, t.lastVerifiedAt),

    // A patient may hold only one ACTIVE coverage per rank. A partial index keeps
    // terminated coverages in history rather than forcing them to be deleted.
    uniqueIndex('coverages_patient_rank_active_key')
      .on(t.patientId, t.rank)
      .where(sql`active = true`),
  ],
);

/**
 * Workers' compensation and auto/liability claims carry extra identifiers that
 * ordinary coverage does not, and route to entirely different claim edits.
 */
export const coverageCaseDetails = pgTable(
  'coverage_case_details',
  {
    id: primaryId,
    orgId,
    coverageId: uuid('coverage_id').notNull(),

    claimNumber: text('claim_number'),
    dateOfInjury: date('date_of_injury'),
    employerName: text('employer_name'),
    adjusterName: text('adjuster_name'),
    adjusterPhone: text('adjuster_phone'),

    /** Prior authorisation covering the whole case rather than one encounter. */
    authorizationNumber: text('authorization_number'),
    authorizedVisits: integer('authorized_visits'),
    authorizedVisitsUsed: integer('authorized_visits_used').notNull().default(0),
    authorizationStartDate: date('authorization_start_date'),
    authorizationEndDate: date('authorization_end_date'),

    ...timestamps,
  },
  (t) => [uniqueIndex('coverage_case_details_coverage_key').on(t.coverageId)],
);
