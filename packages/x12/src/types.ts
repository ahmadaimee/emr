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
// 837I / UB-04 — Institutional claim
// ---------------------------------------------------------------------------

/**
 * One revenue line — form locators 42 through 48. An institutional claim bills by
 * revenue code; the HCPCS in FL 44 is additional detail, not the primary key, which is
 * the main way this differs from a professional service line.
 */
export interface RevenueLine {
  lineNumber: number;
  /** FL 42 — four-digit revenue code. */
  revenueCode: string;
  /** FL 43 — description, or the IDE number for an investigational device. */
  description?: string;
  /** FL 44 — HCPCS, accommodation rate, or HIPPS rate code. */
  hcpcs?: string;
  modifiers: string[];
  /** FL 45 — service date. Required on outpatient claims. */
  serviceDate?: string;
  /** FL 46 — units of service. */
  units: number;
  /** FL 47 — total charges. */
  chargeCents: number;
  /** FL 48 — non-covered charges. */
  nonCoveredCents?: number;
  /** Our line identifier, echoed back in the 835 as REF*6R. */
  lineControlNumber?: string;
  /** Loop 2430: what a prior payer did with this line, on a secondary bill. */
  priorAdjudications?: PriorLineAdjudication[];
}

/** A diagnosis with its present-on-admission indicator (FL 67, 72). */
export interface UbDiagnosis {
  code: string;
  /** Y yes, N no, U insufficient documentation, W clinically undetermined, 1 exempt. */
  presentOnAdmission?: 'Y' | 'N' | 'U' | 'W' | '1';
}

/** FL 74 — an ICD-10-PCS procedure and the date it was performed. */
export interface UbProcedure {
  code: string;
  date: string;
}

/** FL 31–34. */
export interface OccurrenceCode {
  code: string;
  date: string;
}

/** FL 35–36. */
export interface OccurrenceSpan {
  code: string;
  from: string;
  through: string;
}

/** FL 39–41. Amounts are cents like everything else, even where the code is a count. */
export interface ValueCode {
  code: string;
  amountCents: number;
}

/** FL 76–79 — attending, operating and other providers. */
export interface UbProvider {
  npi: string;
  person: Person;
  /** PRV*AT — taxonomy, reported on the attending provider. */
  taxonomyCode?: string;
  /** FL 76b qualifier and ID, when a secondary identifier is reported. */
  qualifier?: string;
  otherId?: string;
  /** FL 78/79 only: what kind of "other" provider this is (e.g. referring, rendering). */
  role?: string;
}

/** One payer line across FL 50–65. A UB-04 carries up to three, A/B/C. */
export interface InstitutionalPayer {
  /** FL 50 — payer name. */
  name: string;
  /** FL 51 — health plan identifier. */
  healthPlanId: string;
  /** FL 52 — release of information. */
  releaseOfInformation: 'Y' | 'I' | 'N';
  /** FL 53 — assignment of benefits. */
  benefitsAssigned: boolean;
  /** FL 54 — prior payments already received from this payer. */
  priorPaymentsCents?: number;
  /** FL 55 — estimated amount due. */
  estimatedDueCents?: number;
  /** FL 58 — insured's name. */
  insuredName: string;
  /** FL 59 — patient's relationship to the insured (01 spouse, 18 self, 19 child…). */
  relationship: string;
  /** FL 60 — insured's unique identifier. */
  insuredId: string;
  /** FL 61 / 62 — group name and number. */
  groupName?: string;
  groupNumber?: string;
  /** FL 63 — treatment authorisation code. */
  treatmentAuthCode?: string;
  /** FL 64 — the payer's control number for the claim being replaced or voided. */
  documentControlNumber?: string;
  /** FL 65 — employer name. */
  employerName?: string;
}

export interface InstitutionalClaim {
  /** FL 3a. */
  patientControlNumber: string;
  /** FL 3b. */
  medicalRecordNumber?: string;
  /**
   * FL 4 — Type of Bill, four digits: a leading zero, facility type, bill
   * classification, and frequency. The fourth digit is the frequency, so 0131 is an
   * original outpatient hospital claim and 0137 replaces one.
   */
  typeOfBill: string;
  /** FL 5. */
  federalTaxNumber: string;
  /** FL 6 — the period this bill covers. */
  statementFrom: string;
  statementThrough: string;

  /** FL 1 and FL 56. */
  billingProvider: Provider;
  /** FL 2 — only when payment goes somewhere other than the billing address. */
  payToProvider?: Provider;

  /** FL 8–11. */
  patient: Patient & { patientId?: string };

  /** FL 12–15. Absent on a non-admitted outpatient claim. */
  admission?: {
    date: string;
    /** FL 13 — two-digit hour, 00–23. */
    hour?: string;
    /** FL 14 — priority/type of admission or visit. */
    priority?: string;
    /** FL 15 — point of origin. */
    pointOfOrigin?: string;
  };
  /** FL 16. */
  dischargeHour?: string;
  /** FL 17 — patient discharge status. 01 home, 20 expired, 30 still a patient… */
  patientStatus: string;

  /** FL 18–28, up to eleven. */
  conditionCodes: string[];
  /** FL 29. */
  accidentState?: string;
  /** FL 31–34, up to four. */
  occurrenceCodes: OccurrenceCode[];
  /** FL 35–36, up to two. */
  occurrenceSpans: OccurrenceSpan[];
  /** FL 38 — responsible party, printed in the window envelope area. */
  responsibleParty?: { name: string; address?: Address };
  /** FL 39–41, up to twelve. */
  valueCodes: ValueCode[];

  /** FL 42–48. */
  lines: RevenueLine[];
  totalChargeCents: number;

  /** FL 50–65, up to three. The first is the payer this claim goes to. */
  payers: InstitutionalPayer[];

  /** FL 66 — 0 for ICD-10-CM, 9 for ICD-9-CM. */
  icdVersion: '0' | '9';
  /** FL 67. */
  principalDiagnosis: UbDiagnosis;
  /** FL 67 A–Q, up to seventeen. */
  otherDiagnoses: UbDiagnosis[];
  /** FL 69. */
  admittingDiagnosis?: string;
  /** FL 70 a–c. */
  reasonForVisit: string[];
  /** FL 71. */
  ppsCode?: string;
  /** FL 72 a–c — external cause of injury. */
  externalCauseCodes: UbDiagnosis[];
  /** FL 74. */
  principalProcedure?: UbProcedure;
  /** FL 74 a–e, up to five. */
  otherProcedures: UbProcedure[];

  /** FL 76. */
  attendingProvider: UbProvider;
  /** FL 77. */
  operatingProvider?: UbProvider;
  /** FL 78–79, up to two. */
  otherProviders: UbProvider[];

  /** FL 80. */
  remarks?: string;
  /** FL 81 a–d — code-code, most often the billing taxonomy under qualifier B3. */
  codeCode: Array<{ qualifier: string; code: string }>;
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
