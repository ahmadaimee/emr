/**
 * The facts a rule can see. This is a deliberately flat, JSON-shaped view of a claim
 * assembled by the domain layer — rules never touch the database directly, which is
 * what makes them backtestable against historical claims and safe to evaluate
 * synchronously on save.
 *
 * All money is integer cents. All dates are ISO YYYY-MM-DD.
 */

export interface LineFacts {
  lineNumber: number;
  procedureCode: string;
  modifiers: string[];
  units: number;
  chargeCents: number;
  /** 1-based positions into claim.diagnoses. */
  diagnosisPointers: number[];
  serviceDate: string;
  placeOfService: string;
  renderingProviderNpi?: string;
  abnObtained: boolean;
  ndcCode?: string;
  emergency: boolean;
}

export interface ClaimFacts {
  claim: {
    id: string;
    claimNumber: string;
    type: 'professional' | 'institutional';
    frequencyCode: '1' | '7' | '8';
    originalPayerClaimControlNumber?: string;
    placeOfService: string;
    totalChargeCents: number;
    serviceDateFrom: string;
    serviceDateThrough?: string;
    /** ICD-10-CM without decimals, ordered. */
    diagnoses: string[];
    priorAuthorizationNumber?: string;
    referralNumber?: string;
    payerSequence: 'P' | 'S' | 'T';
    relatedToAutoAccident: boolean;
    relatedToEmployment: boolean;
    accidentDate?: string;
  };
  lines: LineFacts[];
  patient: {
    id: string;
    dateOfBirth: string;
    sex: 'M' | 'F' | 'U';
    /** Years at date of service. */
    ageAtService: number;
    state?: string;
  };
  coverage: {
    memberId: string;
    groupNumber?: string;
    relationshipCode: string;
    effectiveDate?: string;
    terminationDate?: string;
    lastVerifiedAt?: string;
    lastVerifiedStatus?: string;
  };
  payer: {
    id: string;
    name: string;
    type: string;
    claimFilingIndicator?: string;
    timelyFilingDays?: number;
    supportsSecondaryElectronic: boolean;
  };
  billingProvider: {
    npi: string;
    taxId?: string;
    taxonomyCode?: string;
    postalCode?: string;
    enrollmentStatus?: string;
  };
  renderingProvider: {
    npi: string;
    taxonomyCode?: string;
    enrollmentStatus?: string;
  };
  location: {
    postalCode?: string;
    macJurisdiction?: string;
    state?: string;
  };
  /**
   * Other service lines billed for the same patient on the same date of service on
   * OTHER claims. Required for MUE MAI 2/3, which sum units across every claim.
   */
  sameDayLinesOnOtherClaims: Array<Pick<LineFacts, 'procedureCode' | 'units' | 'modifiers'>>;
  /** Evaluation date, injectable for backtesting. */
  today: string;
}

/**
 * Reference data the system rules consult. The domain layer implements this against
 * the `codes` tables; tests implement it in memory. Kept synchronous and pre-loaded
 * per evaluation so a scrub of a 40-line claim does not issue 400 queries.
 */
export interface ReferenceData {
  /** NCCI PTP edit for a code pair on a date, if one exists. */
  ncciPtp(columnOne: string, columnTwo: string, serviceDate: string): { modifierIndicator: '0' | '1' | '9' } | null;
  /** MUE for a code on a date. */
  mue(code: string, serviceDate: string): { maxUnits: number; mai: '1' | '2' | '3' } | null;
  /** Primary codes an add-on code requires; null when the code is not an add-on. */
  addOnPrimaries(code: string): { primaryCodes: string[]; addOnType: string } | null;
  /** Procedure metadata. */
  procedure(code: string): { isAddOn: boolean; allowedPlacesOfService?: string[]; globalDays?: string } | null;
  /** Diagnosis metadata. */
  diagnosis(code: string): { billable: boolean; sexRestriction?: string; ageMin?: number; ageMax?: number } | null;
  /** Whether a diagnosis supports medical necessity for a procedure under the jurisdiction's LCD/NCD. */
  medicalNecessity(procedureCode: string, diagnosisCode: string, macJurisdiction: string | undefined): 'supports' | 'does_not_support' | 'no_policy';
  /** Whether a POS pays at the facility rate. */
  placeOfService(code: string): { facilityRate: boolean } | null;
}
