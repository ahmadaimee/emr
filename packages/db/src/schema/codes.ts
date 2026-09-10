import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared';

/*
 * Reference code sets and edit tables.
 *
 * These are global reference data, NOT tenant data — they carry no org_id and no RLS
 * policy, and are readable by every tenant.
 *
 * Licensing note: ICD-10-CM, HCPCS, NDC, POS, taxonomy and the CMS edit files are all
 * free to redistribute. CPT is NOT — the AMA requires a per-provider end-user licence
 * AND a separate distributor licence to display CPT codes or descriptions in a product
 * UI. `procedureCodes` therefore stores descriptions nullable, and CPT descriptions are
 * only populated for organisations whose licence is on file.
 */

export const diagnosisCodes = pgTable(
  'diagnosis_codes',
  {
    id: primaryId,
    /** ICD-10-CM, no decimal point, e.g. E1165. */
    code: text('code').notNull(),
    description: text('description').notNull(),
    shortDescription: text('short_description'),

    /**
     * False for codes that require further specification. Billing an unbillable
     * header code is an immediate rejection.
     */
    billable: boolean('billable').notNull().default(true),

    /** Some codes may not be used as the principal diagnosis. */
    validAsPrincipal: boolean('valid_as_principal').notNull().default(true),
    /** Sex-specific codes; payers edit against patient demographics. */
    sexRestriction: text('sex_restriction'),
    ageMin: integer('age_min'),
    ageMax: integer('age_max'),

    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('diagnosis_codes_code_key').on(t.code, t.effectiveDate),
    index('diagnosis_codes_search_idx').on(t.code),
  ],
);

export const procedureCodes = pgTable(
  'procedure_codes',
  {
    id: primaryId,
    /** CPT or HCPCS Level II. */
    code: text('code').notNull(),
    codeSystem: text('code_system').notNull(), // CPT | HCPCS

    /** Null when the AMA licence does not permit us to store CPT descriptions. */
    description: text('description'),
    shortDescription: text('short_description'),

    /** Add-on codes may never be billed alone. */
    isAddOn: boolean('is_add_on').notNull().default(false),
    /** Codes exempt from modifier 51 / 63 and similar. */
    modifier51Exempt: boolean('modifier_51_exempt').notNull().default(false),

    /** Global surgical period in days: 0, 10, 90, or XXX. */
    globalDays: text('global_days'),
    /** Which places of service this code may legitimately be billed in. */
    allowedPlacesOfService: text('allowed_places_of_service').array(),

    /** Bilateral, assistant-surgeon and multiple-procedure indicators from the MPFS. */
    bilateralIndicator: text('bilateral_indicator'),
    assistantSurgeonIndicator: text('assistant_surgeon_indicator'),
    multipleProcedureIndicator: text('multiple_procedure_indicator'),

    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),
    ...timestamps,
  },
  (t) => [uniqueIndex('procedure_codes_key').on(t.code, t.codeSystem, t.effectiveDate)],
);

/**
 * NCCI procedure-to-procedure edits.
 *
 * `modifierIndicator` is the field naive scrubbers get wrong, and it is the single most
 * expensive mistake in claim editing:
 *
 *   '0' — the pair can NEVER be unbundled. No modifier will help. Appending 59 to an
 *         indicator-0 pair produces a guaranteed, non-appealable denial, yet scrubbers
 *         that merely check "is a modifier present" will pass it straight through.
 *   '1' — may be bypassed with an appropriate modifier when clinically justified.
 *   '9' — the edit has been retracted and no longer applies.
 */
export const ncciPtpEdits = pgTable(
  'ncci_ptp_edits',
  {
    id: primaryId,
    /** practitioner | outpatient_hospital | dme. Ambulatory needs 'practitioner'. */
    editSet: text('edit_set').notNull().default('practitioner'),

    columnOneCode: text('column_one_code').notNull(),
    columnTwoCode: text('column_two_code').notNull(),

    modifierIndicator: text('modifier_indicator').notNull(),

    effectiveDate: date('effective_date').notNull(),
    deletionDate: date('deletion_date'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('ncci_ptp_key').on(
      t.editSet,
      t.columnOneCode,
      t.columnTwoCode,
      t.effectiveDate,
    ),
    index('ncci_ptp_lookup_idx').on(t.editSet, t.columnTwoCode, t.columnOneCode),
  ],
);

/**
 * Medically Unlikely Edits — the maximum units billable for one patient on one day.
 *
 * `mai` determines HOW the limit is applied, and getting it wrong is the second
 * classic scrubber failure:
 *
 *   '1' — line-level edit. Each claim line is judged on its own, so the same code can
 *         legitimately appear on multiple lines.
 *   '2' — date-of-service edit, absolute. Units must be summed across EVERY line and
 *         EVERY claim for that patient and date. Never overridable.
 *   '3' — date-of-service edit, overridable with documentation on appeal.
 *
 * A scrubber that checks units only within a single line silently passes MAI 2/3
 * violations, which then deny after submission.
 */
export const mueEdits = pgTable(
  'mue_edits',
  {
    id: primaryId,
    editSet: text('edit_set').notNull().default('practitioner'),

    code: text('code').notNull(),
    maxUnits: integer('max_units').notNull(),
    mai: text('mai').notNull(),
    rationale: text('rationale'),

    effectiveDate: date('effective_date').notNull(),
    deletionDate: date('deletion_date'),
    ...timestamps,
  },
  (t) => [uniqueIndex('mue_edits_key').on(t.editSet, t.code, t.effectiveDate)],
);

/** Add-on codes and the primary codes they must accompany. */
export const addOnCodeEdits = pgTable(
  'add_on_code_edits',
  {
    id: primaryId,
    addOnCode: text('add_on_code').notNull(),
    primaryCode: text('primary_code').notNull(),
    /** 1 = only the listed primaries, 2 = any primary, 3 = payer discretion. */
    addOnType: text('add_on_type').notNull().default('1'),
    effectiveDate: date('effective_date').notNull(),
    deletionDate: date('deletion_date'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('add_on_code_key').on(t.addOnCode, t.primaryCode, t.effectiveDate),
    index('add_on_code_lookup_idx').on(t.addOnCode),
  ],
);

/**
 * Local and national coverage determinations.
 *
 * LCDs are specific to a MAC jurisdiction — identical documentation can be covered in
 * one jurisdiction and denied in the next. A scrubber that applies one generic national
 * ruleset is wrong for most of the country, so coverage checks resolve the MAC from the
 * service location before selecting policies.
 */
export const coveragePolicies = pgTable(
  'coverage_policies',
  {
    id: primaryId,
    /** LCD | NCD | payer_policy */
    policyType: text('policy_type').notNull(),
    policyId: text('policy_id').notNull(),
    title: text('title').notNull(),

    /** Null for NCDs, which are national. */
    macJurisdiction: text('mac_jurisdiction'),
    /** Set for commercial payer policies rather than Medicare. */
    payerId: text('payer_id'),

    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),
    sourceUrl: text('source_url'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('coverage_policies_key').on(t.policyType, t.policyId, t.macJurisdiction),
    index('coverage_policies_jurisdiction_idx').on(t.macJurisdiction, t.policyType),
  ],
);

/** Which diagnoses support medical necessity for which procedures, under a policy. */
export const coveragePolicyCodes = pgTable(
  'coverage_policy_codes',
  {
    id: primaryId,
    policyId: text('policy_id').notNull(),
    procedureCode: text('procedure_code').notNull(),
    diagnosisCode: text('diagnosis_code').notNull(),
    /** supports | does_not_support */
    relationship: text('relationship').notNull().default('supports'),
    ...timestamps,
  },
  (t) => [
    index('coverage_policy_codes_lookup_idx').on(t.procedureCode, t.diagnosisCode),
    uniqueIndex('coverage_policy_codes_key').on(
      t.policyId,
      t.procedureCode,
      t.diagnosisCode,
    ),
  ],
);

/** CARC and RARC code lists, versioned. X12 revises these several times a year. */
export const adjustmentReasonCodes = pgTable(
  'adjustment_reason_codes',
  {
    id: primaryId,
    /** CARC | RARC */
    codeType: text('code_type').notNull(),
    code: text('code').notNull(),
    description: text('description').notNull(),

    /** Our mapping into the denial taxonomy that drives routing. */
    denialCategory: text('denial_category'),
    suggestedAction: text('suggested_action'),
    /** True when this code denies payment rather than describing a routine reduction. */
    isDenial: boolean('is_denial').notNull().default(false),
    /** True when the fix is deterministic enough to automate. */
    autoResolvable: boolean('auto_resolvable').notNull().default(false),

    effectiveDate: date('effective_date'),
    deactivatedDate: date('deactivated_date'),
    ...timestamps,
  },
  (t) => [uniqueIndex('adjustment_reason_codes_key').on(t.codeType, t.code)],
);

/** Place of service codes, and whether each pays at the facility rate. */
export const placeOfServiceCodes = pgTable(
  'place_of_service_codes',
  {
    id: primaryId,
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /**
     * True when this POS pays the facility rate. POS 02 (telehealth away from home)
     * and POS 10 (telehealth in the home) differ here, and the gap is large enough to
     * matter on every telehealth claim.
     */
    facilityRate: boolean('facility_rate').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('place_of_service_codes_key').on(t.code)],
);

/** Tracks each ingest of a quarterly CMS file, so we know what version is loaded. */
export const codeSetVersions = pgTable(
  'code_set_versions',
  {
    id: primaryId,
    codeSet: text('code_set').notNull(), // ncci_ptp | mue | icd10cm | hcpcs | carc | ...
    version: text('version').notNull(),
    effectiveDate: date('effective_date').notNull(),
    recordCount: integer('record_count').notNull().default(0),
    sourceUrl: text('source_url'),
    checksum: text('checksum'),
    ...timestamps,
  },
  (t) => [uniqueIndex('code_set_versions_key').on(t.codeSet, t.version)],
);
