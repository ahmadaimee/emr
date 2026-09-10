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
import { money } from './_types';

export const encounterStatus = pgEnum('encounter_status', [
  'open',
  'ready_to_bill',
  'billed',
  'on_hold',
  'voided',
]);

/**
 * An encounter groups the charges arising from one date of service. Claims are built
 * from encounters, but the two are not the same thing: one encounter can split into
 * several claims (different payers, or a payer that will not accept more than a set
 * number of service lines per claim).
 */
export const encounters = pgTable(
  'encounters',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    locationId: uuid('location_id').notNull(),

    encounterNumber: text('encounter_number').notNull(),
    status: encounterStatus('status').notNull().default('open'),

    serviceDate: date('service_date').notNull(),
    serviceDateThrough: date('service_date_through'),

    renderingProviderId: uuid('rendering_provider_id').notNull(),
    billingProviderId: uuid('billing_provider_id'),
    supervisingProviderId: uuid('supervising_provider_id'),
    referringProviderId: uuid('referring_provider_id'),

    /**
     * Place of service for the encounter. POS describes where the PATIENT was, not
     * where the provider sat — defaulting it from provider setup is a common and
     * expensive mistake, since facility vs non-facility pricing can differ by 20-40%.
     */
    placeOfService: text('place_of_service').notNull(),

    /** Ordered diagnosis list. Position matters: service lines point at these by index. */
    diagnosisCodes: text('diagnosis_codes').array().notNull().default([]),

    /** 837 CLM11 related-causes — employment, auto accident, other accident. */
    relatedToEmployment: boolean('related_to_employment').notNull().default(false),
    relatedToAutoAccident: boolean('related_to_auto_accident').notNull().default(false),
    relatedToOtherAccident: boolean('related_to_other_accident').notNull().default(false),
    accidentState: text('accident_state'),
    accidentDate: date('accident_date'),

    /** Dates that drive payer edits and appear on the CMS-1500. */
    onsetDate: date('onset_date'),
    initialTreatmentDate: date('initial_treatment_date'),
    lastSeenDate: date('last_seen_date'),
    hospitalizedFrom: date('hospitalized_from'),
    hospitalizedTo: date('hospitalized_to'),

    priorAuthorizationNumber: text('prior_authorization_number'),
    referralNumber: text('referral_number'),
    clia: text('clia_number'),

    notes: text('notes'),
    totalChargeCents: money('total_charge_cents').notNull().default(0),

    ...timestamps,
  },
  (t) => [
    uniqueIndex('encounters_practice_number_key').on(
      t.orgId,
      t.practiceId,
      t.encounterNumber,
    ),
    index('encounters_patient_idx').on(t.orgId, t.patientId, t.serviceDate),
    index('encounters_status_idx').on(t.orgId, t.practiceId, t.status),
    index('encounters_service_date_idx').on(t.orgId, t.serviceDate),
  ],
);

/**
 * One billable service line.
 *
 * `diagnosisPointers` holds ORDINAL POSITIONS (1-based) into the encounter's diagnosis
 * array, not the codes themselves. This mirrors 837 SV107, which takes numeric pointers
 * — the alpha-to-numeric conversion (CMS-1500 box 24E letters A-L to positions 1-12) is
 * one of the most common bugs in practice management systems, so we store the numeric
 * form and derive the letters for display rather than the other way round.
 */
export const serviceLines = pgTable(
  'service_lines',
  {
    id: primaryId,
    orgId,
    encounterId: uuid('encounter_id').notNull(),

    /** 1-based ordering within the encounter. */
    lineNumber: integer('line_number').notNull(),

    procedureCode: text('procedure_code').notNull(),
    procedureDescription: text('procedure_description'),

    /** Up to four modifiers, in the order they must appear on the claim. */
    modifier1: text('modifier1'),
    modifier2: text('modifier2'),
    modifier3: text('modifier3'),
    modifier4: text('modifier4'),

    /** 1-based positions into encounters.diagnosisCodes. Max four per line. */
    diagnosisPointers: integer('diagnosis_pointers').array().notNull().default([]),

    units: integer('units').notNull().default(1),
    /** MJ (minutes), UN (units), F2 (international units). Anaesthesia bills in minutes. */
    unitType: text('unit_type').notNull().default('UN'),

    chargeCents: money('charge_cents').notNull(),
    /** What the contract says the payer should allow. Drives underpayment detection. */
    expectedAllowedCents: money('expected_allowed_cents'),

    serviceDate: date('service_date').notNull(),
    serviceDateThrough: date('service_date_through'),

    /** Overrides the encounter POS when a single line was performed elsewhere. */
    placeOfService: text('place_of_service'),

    /** Line-level rendering provider, when it differs from the encounter's. */
    renderingProviderId: uuid('rendering_provider_id'),

    /** Drug billing: NDC, quantity and unit of measure are required for J-codes. */
    ndcCode: text('ndc_code'),
    ndcQuantity: integer('ndc_quantity_millis'),
    ndcUnitOfMeasure: text('ndc_unit_of_measure'),

    emergency: boolean('emergency').notNull().default(false),
    epsdt: boolean('epsdt').notNull().default(false),
    familyPlanning: boolean('family_planning').notNull().default(false),

    /**
     * Set when an ABN was obtained before service. Medical-necessity denials are
     * generally unappealable without one, and the ABN has to exist BEFORE the encounter
     * — which is why the scrubber raises this at charge entry, not after the denial.
     */
    abnObtained: boolean('abn_obtained').notNull().default(false),
    abnDate: date('abn_date'),

    /** Running financial state, maintained as remittances and payments post. */
    allowedCents: money('allowed_cents').notNull().default(0),
    paidCents: money('paid_cents').notNull().default(0),
    adjustmentCents: money('adjustment_cents').notNull().default(0),
    patientResponsibilityCents: money('patient_responsibility_cents').notNull().default(0),
    balanceCents: money('balance_cents').notNull().default(0),

    voidedAt: date('voided_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('service_lines_encounter_line_key').on(t.encounterId, t.lineNumber),
    index('service_lines_encounter_idx').on(t.orgId, t.encounterId),
    index('service_lines_procedure_idx').on(t.orgId, t.procedureCode, t.serviceDate),
  ],
);
