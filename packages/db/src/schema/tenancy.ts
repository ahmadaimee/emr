import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';

/**
 * An organization is the tenant root — for us, the billing company. Every RLS policy in
 * the system resolves to "does this row's org_id match the caller's organization".
 */
export const organizations = pgTable(
  'organizations',
  {
    id: primaryId,
    name: text('name').notNull(),
    slug: text('slug').notNull(),

    /** Submitter identity used in the ISA/GS envelope of outbound EDI. */
    ediSubmitterId: text('edi_submitter_id'),
    ediSubmitterName: text('edi_submitter_name'),

    /**
     * Test until the clearinghouse and payers approve production submission.
     * Guards the ISA15 usage indicator; sending 'P' before approval gets you rejected
     * at best and blacklisted at worst.
     */
    ediUsageIndicator: text('edi_usage_indicator').notNull().default('T'),

    settings: jsonb('settings').notNull().default({}),
    ...timestamps,
  },
  (t) => [uniqueIndex('organizations_slug_key').on(t.slug)],
);

/** A client practice whose revenue cycle we run. */
export const practices = pgTable(
  'practices',
  {
    id: primaryId,
    orgId,
    name: text('name').notNull(),
    /** Group NPI (type 2). */
    npi: text('npi'),
    taxId: text('tax_id'),
    taxIdType: text('tax_id_type').notNull().default('EI'), // EI = EIN, SY = SSN
    taxonomyCode: text('taxonomy_code'),
    /** Required if the practice bills lab claims. */
    cliaNumber: text('clia_number'),

    /**
     * EFT enrollment status — never the account/routing number itself. Real banking
     * details belong in CAQH EnrollHub or the payer's own enrollment flow, not a
     * second copy sitting in this database; this is only enough to check the box on
     * the onboarding checklist. not_started | submitted | active.
     */
    eftEnrollmentStatus: text('eft_enrollment_status').notNull().default('not_started'),
    eftBankName: text('eft_bank_name'),

    /**
     * Default place of service. Note: POS must reflect where the *patient* was, not
     * where the provider sat. This is only a default for charge entry, and the
     * scrubber still validates POS against the CPT and the encounter.
     */
    defaultPlaceOfService: text('default_place_of_service'),

    /**
     * Accept-assignment default and billing style. Drives CMS-1500 box 27 and the
     * 837 CLM07/CLM08 assignment indicators.
     */
    acceptsAssignment: boolean('accepts_assignment').notNull().default(true),

    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('practices_org_idx').on(t.orgId),
    uniqueIndex('practices_org_npi_key').on(t.orgId, t.npi),
  ],
);

/**
 * A service location. Its address determines the Medicare Administrative Contractor
 * jurisdiction, which in turn determines which LCDs apply — the same documentation can
 * be covered in one MAC and denied in another, so this is not cosmetic.
 */
export const locations = pgTable(
  'locations',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    name: text('name').notNull(),

    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    /** 9-digit ZIP. Payers reject 5-digit ZIPs in the billing provider loop. */
    postalCode: text('postal_code').notNull(),
    countryCode: text('country_code').notNull().default('US'),

    /** Facility NPI when the location bills as a facility. */
    npi: text('npi'),
    placeOfService: text('place_of_service'),

    /** Resolved MAC jurisdiction (e.g. 'JH', 'J6'), used to select applicable LCDs. */
    macJurisdiction: text('mac_jurisdiction'),

    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('locations_practice_idx').on(t.orgId, t.practiceId)],
);

export const providerType = pgEnum('provider_type', ['rendering', 'billing', 'supervising', 'referring']);

/** An individual clinician (type 1 NPI). */
export const providers = pgTable(
  'providers',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),

    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    middleName: text('middle_name'),
    suffix: text('suffix'),
    credentials: text('credentials'),

    npi: text('npi').notNull(),
    taxonomyCode: text('taxonomy_code'),
    /** DEA and state licence drive e-prescribing and some payer edits. */
    deaNumber: text('dea_number'),
    stateLicense: text('state_license'),
    licenseState: text('license_state'),

    /** The payer-facing credentialing profile almost every commercial enrollment pulls from. */
    caqhNumber: text('caqh_number'),
    caqhAttestedAt: date('caqh_attested_at'),
    boardCertifications: text('board_certifications').array().notNull().default([]),
    malpracticeCarrier: text('malpractice_carrier'),
    malpracticePolicyNumber: text('malpractice_policy_number'),
    malpracticeExpiresOn: date('malpractice_expires_on'),

    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('providers_practice_idx').on(t.orgId, t.practiceId),
    uniqueIndex('providers_org_npi_key').on(t.orgId, t.npi),
  ],
);

/**
 * Payer-specific provider enrollment. Validating an NPI against NPPES is not enough —
 * what matters is what THIS payer has on file for this provider, which routinely lags
 * or differs from the national registry. Claims fail on the payer's copy, not NPPES.
 */
export const providerEnrollments = pgTable(
  'provider_enrollments',
  {
    id: primaryId,
    orgId,
    providerId: uuid('provider_id').notNull(),
    payerId: uuid('payer_id').notNull(),
    practiceId: uuid('practice_id').notNull(),

    /** Legacy/proprietary identifiers the payer still requires in REF segments. */
    ptan: text('ptan'),
    providerNumber: text('provider_number'),
    /** Taxonomy as enrolled with this payer, which may differ from the provider record. */
    enrolledTaxonomyCode: text('enrolled_taxonomy_code'),

    effectiveDate: date('effective_date'),
    terminationDate: date('termination_date'),

    /** participating | non_participating | pending | terminated */
    status: text('status').notNull().default('pending'),

    /**
     * ERA and EFT enrollment are linked by billing NPI but are their own approval
     * steps with the payer, separate from claims (837) enrollment above — tracked
     * separately because a practice can submit claims well before either clears.
     * not_started | submitted | active, for both.
     */
    eraEnrollmentStatus: text('era_enrollment_status').notNull().default('not_started'),
    eftEnrollmentStatus: text('eft_enrollment_status').notNull().default('not_started'),
    tradingPartnerAgreementSignedOn: date('trading_partner_agreement_signed_on'),

    ...timestamps,
  },
  (t) => [
    index('provider_enrollments_lookup_idx').on(t.orgId, t.providerId, t.payerId),
    index('provider_enrollments_payer_idx').on(t.orgId, t.payerId),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  practices: many(practices),
}));

export const practicesRelations = relations(practices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [practices.orgId],
    references: [organizations.id],
  }),
  locations: many(locations),
  providers: many(providers),
}));

export const providersRelations = relations(providers, ({ one, many }) => ({
  practice: one(practices, { fields: [providers.practiceId], references: [practices.id] }),
  enrollments: many(providerEnrollments),
}));
