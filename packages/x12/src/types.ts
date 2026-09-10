/**
 * Typed models for the transactions Grove exchanges. These are transport-neutral —
 * the database layer maps to and from them — so the X12 package has no dependency on
 * the schema and can be tested in isolation against official sample files.
 *
 * All money is integer cents. All dates are ISO YYYY-MM-DD strings.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  /** 9-digit ZIP required in the billing provider and service facility loops. */
  postalCode: string;
  countryCode?: string;
}

export interface Person {
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
}

export interface Organization {
  name: string;
}

export type Sex = 'M' | 'F' | 'U';

export interface Provider {
  /** true → NM102 = 1 (person); false → 2 (non-person entity). */
  isPerson: boolean;
  person?: Person;
  organization?: Organization;
  npi: string;
  taxonomyCode?: string;
  address?: Address;
  /** EIN or SSN for the billing provider (REF*EI / REF*SY). */
  taxId?: string;
  taxIdType?: 'EI' | 'SY';
  /** Payer-assigned legacy identifiers (REF*G2 etc.). */
  secondaryIds?: Array<{ qualifier: string; value: string }>;
  contact?: { name: string; phone?: string; email?: string };
}

export interface Payer {
  name: string;
  /** The clearinghouse/payer ID sent in NM109 of loop 2010BB. */
  payerId: string;
  address?: Address;
  /** SBR09 claim filing indicator. */
  claimFilingIndicator: string;
}

export interface Subscriber {
  person: Person;
  memberId: string;
  /** CMS-1500 item 7 telephone. */
  phone?: string;
  groupNumber?: string;
  groupName?: string;
  dateOfBirth?: string;
  sex?: Sex;
  address?: Address;
  /** SBR02 individual relationship: 18 self, 01 spouse, 19 child, G8 other. */
  relationshipToPatient: string;
}

export interface Patient {
  person: Person;
  /** CMS-1500 item 5 telephone. */
  phone?: string;
  dateOfBirth: string;
  sex: Sex;
  address: Address;
  /** PAT01 relationship to subscriber, when patient ≠ subscriber. */
  relationshipToSubscriber?: string;
}

export interface CasAdjustment {
  group: 'CO' | 'PR' | 'OA' | 'PI' | 'CR';
  reasonCode: string;
  amountCents: number;
  quantity?: number;
}

// ---------------------------------------------------------------------------
// 837P — Professional claim
// ---------------------------------------------------------------------------

export interface ServiceLine {
  lineNumber: number;
  procedureCode: string;
  modifiers: string[];
  chargeCents: number;
  units: number;
  unitType?: 'UN' | 'MJ';
  /** 1-based positions into claim.diagnoses. 1–4 entries. NUMERIC, never letters. */
  diagnosisPointers: number[];
  serviceDate: string;
  serviceDateThrough?: string;
  placeOfService?: string;
  emergency?: boolean;
  epsdt?: boolean;
  familyPlanning?: boolean;
  /** Our line identifier, echoed back in the 835 as REF*6R. */
  lineControlNumber?: string;
  renderingProvider?: Provider;
  ndc?: { code: string; quantity: number; unit: string };
  /** Loop 2430: what a prior payer did with this line (secondary claims only). */
  priorAdjudications?: PriorLineAdjudication[];
}

export interface PriorLineAdjudication {
  payerId: string;
  procedureCode: string;
  modifiers: string[];
  paidAmountCents: number;
  paidUnits?: number;
  adjudicationDate: string;
  adjustments: CasAdjustment[];
}

export interface OtherSubscriber {
  /** Loop 2320 — the OTHER payer's subscriber, for COB. */
  sequence: 'P' | 'S' | 'T';
  relationshipToPatient: string;
  person: Person;
  memberId: string;
  groupNumber?: string;
  claimFilingIndicator: string;
  payer: Payer;
  payerClaimControlNumber?: string;
  /** AMT*D — total the other payer paid on this claim. */
  paidAmountCents: number;
  /** Claim-level CAS from the other payer's remittance. */
  claimAdjustments: CasAdjustment[];
  /** AMT*EAF — remaining patient liability, when known. */
  remainingPatientLiabilityCents?: number;
}

export interface ProfessionalClaim {
  /** CLM01 — our patient control number, echoed back in the 835 CLP01. */
  patientControlNumber: string;
  totalChargeCents: number;
  placeOfService: string;
  /** CLM05-3 — 1 original, 7 replacement, 8 void. */
  frequencyCode: '1' | '7' | '8';
  /** REF*F8 — required for frequency 7 and 8. */
  originalPayerClaimControlNumber?: string;
  /** CLM06 provider signature on file. */
  providerSignatureOnFile: boolean;
  /** CLM07 assignment: A assigned, B assignment accepted on clinical lab only, C not assigned. */
  assignmentCode: 'A' | 'B' | 'C';
  /** CLM08 benefits assignment. */
  benefitsAssigned: boolean;
  /** CLM09 release of information: Y or I. */
  releaseOfInformation: 'Y' | 'I';
  relatedCauses?: { employment?: boolean; autoAccident?: boolean; otherAccident?: boolean; state?: string };

  /** ICD-10-CM, ordered. Position = pointer value. */
  diagnoses: string[];

  dates?: {
    onset?: string;
    /** Last menstrual period. CMS-1500 item 14 qualifier 484 / DTP*484. */
    lastMenstrualPeriod?: string;
    initialTreatment?: string;
    lastSeen?: string;
    accident?: string;
    /** DTP*455 — last x-ray. CMS-1500 item 15 qualifier 455. */
    lastXray?: string;
    /** DTP*090 / DTP*091 — assumed and relinquished care. Item 15 qualifiers 090/091. */
    assumedCare?: string;
    relinquishedCare?: string;
    hospitalizedFrom?: string;
    hospitalizedTo?: string;
    /** DTP*360 / DTP*361 — unable to work in current occupation. CMS-1500 item 16. */
    disabilityFrom?: string;
    disabilityTo?: string;
  };
  priorAuthorizationNumber?: string;
  referralNumber?: string;
  cliaNumber?: string;
  /**
   * CMS-1500 item 11b, "Other Claim ID (Designated by NUCC)". The only qualifier NUCC
   * currently designates is Y4, a property-casualty claim number. REF*Y4 in the 837.
   */
  otherClaimId?: { qualifier: string; value: string };
  /** CMS-1500 item 19, "Additional Claim Information (Designated by NUCC)". */
  additionalClaimInfo?: string;
  /**
   * CMS-1500 item 20. YES means the diagnostic work was performed by an outside lab and
   * is being billed by this provider — a purchased service, not work done in-house.
   */
  outsideLab?: { performed: boolean; chargesCents: number };
  /** CMS-1500 item 17 qualifier: DN referring, DK ordering, DQ supervising. */
  referringProviderRole?: 'DN' | 'DK' | 'DQ';
  /** Date the patient/insured signature was obtained. Items 12 and 31. */
  signatureDate?: string;
  /** NTE*ADD — free-text claim note; use sparingly, payers ignore most of it. */
  note?: string;

  billingProvider: Provider;
  payToProvider?: Provider;
  renderingProvider?: Provider;
  referringProvider?: Provider;
  supervisingProvider?: Provider;
  serviceFacility?: Provider;

  subscriber: Subscriber;
  /** Omit when the patient IS the subscriber. */
  patient?: Patient;
  payer: Payer;
  /** Which payer sequence THIS claim goes to. */
  payerSequence: 'P' | 'S' | 'T';

  /** Other payers on the claim, for COB. Present on secondary/tertiary claims. */
  otherSubscribers?: OtherSubscriber[];

  lines: ServiceLine[];
}

export interface SubmitterInfo {
  name: string;
  /** ETIN or clearinghouse-assigned submitter ID. */
  id: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface ReceiverInfo {
  name: string;
  id: string;
}

// ---------------------------------------------------------------------------
// 835 — Remittance advice
// ---------------------------------------------------------------------------

export interface Remittance835 {
  transactionControlNumber: string;
  paymentMethod: string;
  totalPaidCents: number;
  paymentDate: string;
  traceNumber: string;
  payerIdentifier: string;
  originatingCompanySupplemental?: string;
  productionDate?: string;
  payer: { name: string; address?: Address; identifiers: Array<{ qualifier: string; value: string }>; contact?: { name?: string; phone?: string } };
  payee: { name: string; npi?: string; taxId?: string; address?: Address };
  claims: RemittanceClaim[];
  providerAdjustments: ProviderLevelAdjustment[];
}

export interface RemittanceClaim {
  patientControlNumber: string;
  /** CLP02 */
  claimStatusCode: string;
  totalChargeCents: number;
  totalPaidCents: number;
  patientResponsibilityCents: number;
  claimFilingIndicator: string;
  payerClaimControlNumber: string;
  facilityTypeCode?: string;
  frequencyCode?: string;
  drgCode?: string;
  patient?: { person: Person; memberId?: string };
  subscriber?: { person: Person; memberId?: string };
  renderingProvider?: { name: string; npi?: string };
  /** NM1*TT — the payer forwarded the claim here (Medicare crossover etc.). */
  crossoverCarrier?: { name: string; id?: string };
  claimReceivedDate?: string;
  statementFrom?: string;
  statementTo?: string;
  adjustments: CasAdjustment[];
  remarkCodes: string[];
  references: Array<{ qualifier: string; value: string }>;
  amounts: Array<{ qualifier: string; cents: number }>;
  lines: RemittanceLine[];
}

export interface RemittanceLine {
  procedureCode: string;
  modifiers: string[];
  /** SVC06 — the procedure actually adjudicated, if the payer re-coded. */
  adjudicatedProcedureCode?: string;
  adjudicatedModifiers?: string[];
  chargeCents: number;
  paidCents: number;
  revenueCode?: string;
  unitsPaid?: number;
  unitsBilled?: number;
  serviceDate?: string;
  serviceDateThrough?: string;
  /** REF*6R — our line control number, if we sent one. */
  lineControlNumber?: string;
  /** AMT*B6 — allowed amount. */
  allowedCents?: number;
  adjustments: CasAdjustment[];
  remarkCodes: string[];
  references: Array<{ qualifier: string; value: string }>;
}

export interface ProviderLevelAdjustment {
  providerIdentifier: string;
  fiscalPeriodDate: string;
  adjustments: Array<{ reasonCode: string; referenceId?: string; amountCents: number }>;
}

// ---------------------------------------------------------------------------
// 270 / 271 — Eligibility
// ---------------------------------------------------------------------------

export interface EligibilityInquiry270 {
  payer: { name: string; id: string };
  provider: Provider;
  subscriber: {
    person: Person;
    memberId: string;
    dateOfBirth?: string;
    sex?: Sex;
  };
  /** When inquiring about a dependent rather than the subscriber. */
  dependent?: { person: Person; dateOfBirth: string; sex?: Sex; relationship?: string };
  serviceDate: string;
  serviceTypeCodes: string[];
  /** TRN02 — our trace number, echoed in the 271. */
  traceNumber: string;
}

export interface EligibilityBenefit {
  /** EB01 */
  code: string;
  /** EB02 IND | FAM | ESP | ... */
  coverageLevel?: string;
  /** EB03 — may be multiple via repetition. */
  serviceTypeCodes: string[];
  /** EB04 */
  insuranceType?: string;
  /** EB05 */
  planDescription?: string;
  /** EB06 */
  timePeriodQualifier?: string;
  /** EB07 */
  amountCents?: number;
  /** EB08 as basis points: 0.20 → 2000 */
  percentBps?: number;
  /** EB09 */
  quantityQualifier?: string;
  /** EB10 */
  quantity?: number;
  /** EB11 Y/N authorization or certification required */
  authorizationRequired?: boolean;
  /** EB12 Y/N in-plan network */
  inNetwork?: boolean;
  /** EB13 procedure identifier composite, when benefit is procedure-specific */
  procedure?: { qualifier: string; code: string; modifiers: string[] };
  dates: Array<{ qualifier: string; value: string }>;
  messages: string[];
  references: Array<{ qualifier: string; value: string }>;
}

export interface EligibilityRejection {
  /** AAA03 reject reason code. */
  reasonCode: string;
  /** AAA04 follow-up action code. */
  followUpActionCode: string;
  /** Which loop it appeared in. */
  scope: 'payer' | 'provider' | 'subscriber' | 'dependent';
}

export interface EligibilityResponse271 {
  transactionControlNumber: string;
  traceNumbers: string[];
  payer: { name: string; id?: string };
  subscriber: {
    person: Person;
    memberId?: string;
    dateOfBirth?: string;
    sex?: Sex;
    groupNumber?: string;
    planDates?: { begin?: string; end?: string };
    address?: Address;
  };
  dependent?: {
    person: Person;
    dateOfBirth?: string;
    sex?: Sex;
    relationship?: string;
  };
  /** Benefits for whichever entity was inquired about (subscriber or dependent). */
  benefits: EligibilityBenefit[];
  rejections: EligibilityRejection[];
  /** Derived: is there an EB01=1 active-coverage benefit for the health plan? */
  isActive: boolean;
}
