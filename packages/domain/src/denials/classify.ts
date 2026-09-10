/**
 * CARC → denial taxonomy, suggested action, and whether the fix is safe to automate.
 *
 * The taxonomy is what makes denial analytics steerable: raw CARC codes are too
 * granular to run a department by. `autoResolvable` is deliberately conservative —
 * NOTHING that changes a code, modifier or diagnosis is ever automated. That is
 * coding, coding is a compliance function, and an algorithm doing it unsupervised is
 * an OIG problem, not a feature.
 */
export type DenialCategory =
  | 'patient_responsibility'
  | 'contractual'
  | 'eligibility'
  | 'authorization'
  | 'coding'
  | 'bundling'
  | 'medical_necessity'
  | 'timely_filing'
  | 'duplicate'
  | 'coordination_of_benefits'
  | 'credentialing'
  | 'documentation'
  | 'non_covered'
  | 'benefit_limit'
  | 'other';

export type SuggestedAction = 'bill_patient' | 'write_off' | 'rebill' | 'corrected_claim' | 'appeal' | 'request_records' | 'verify_eligibility' | 'obtain_authorization' | 'close_duplicate' | 'review';

export interface Classification {
  category: DenialCategory;
  isDenial: boolean;
  suggestedAction: SuggestedAction;
  autoResolvable: boolean;
  preventable: boolean;
  description: string;
}

const T: Record<string, Classification> = {
  // Patient responsibility — the only group billable to the patient. Fully automatable.
  '1': { category: 'patient_responsibility', isDenial: false, suggestedAction: 'bill_patient', autoResolvable: true, preventable: false, description: 'Deductible' },
  '2': { category: 'patient_responsibility', isDenial: false, suggestedAction: 'bill_patient', autoResolvable: true, preventable: false, description: 'Coinsurance' },
  '3': { category: 'patient_responsibility', isDenial: false, suggestedAction: 'bill_patient', autoResolvable: true, preventable: false, description: 'Copayment' },
  // Contractual write-offs — not denials.
  '45': { category: 'contractual', isDenial: false, suggestedAction: 'write_off', autoResolvable: true, preventable: false, description: 'Charge exceeds fee schedule / maximum allowable' },
  '253': { category: 'contractual', isDenial: false, suggestedAction: 'write_off', autoResolvable: true, preventable: false, description: 'Sequestration reduction' },
  '59': { category: 'contractual', isDenial: false, suggestedAction: 'write_off', autoResolvable: true, preventable: false, description: 'Multiple procedure reduction' },
  // Eligibility
  '26': { category: 'eligibility', isDenial: true, suggestedAction: 'verify_eligibility', autoResolvable: false, preventable: true, description: 'Expenses incurred prior to coverage' },
  '27': { category: 'eligibility', isDenial: true, suggestedAction: 'verify_eligibility', autoResolvable: false, preventable: true, description: 'Expenses incurred after coverage terminated' },
  '31': { category: 'eligibility', isDenial: true, suggestedAction: 'verify_eligibility', autoResolvable: false, preventable: true, description: 'Patient cannot be identified as our insured' },
  '32': { category: 'eligibility', isDenial: true, suggestedAction: 'verify_eligibility', autoResolvable: false, preventable: true, description: 'Patient is not a dependent of the insured' },
  '109': { category: 'eligibility', isDenial: true, suggestedAction: 'rebill', autoResolvable: false, preventable: true, description: 'Claim not covered by this payer; send to correct payer' },
  '140': { category: 'eligibility', isDenial: true, suggestedAction: 'verify_eligibility', autoResolvable: false, preventable: true, description: 'Patient/insured identification mismatch' },
  '200': { category: 'eligibility', isDenial: true, suggestedAction: 'verify_eligibility', autoResolvable: false, preventable: true, description: 'Expenses incurred during lapse in coverage' },
  // Authorization
  '197': { category: 'authorization', isDenial: true, suggestedAction: 'appeal', autoResolvable: false, preventable: true, description: 'Precertification/authorization absent' },
  '198': { category: 'authorization', isDenial: true, suggestedAction: 'appeal', autoResolvable: false, preventable: true, description: 'Precertification/authorization exceeded' },
  '15': { category: 'authorization', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Authorization number missing, invalid, or does not apply' },
  // Coding
  '4': { category: 'coding', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Procedure code inconsistent with modifier' },
  '5': { category: 'coding', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Procedure code inconsistent with place of service' },
  '6': { category: 'coding', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Procedure/revenue code inconsistent with patient age' },
  '7': { category: 'coding', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Procedure/revenue code inconsistent with patient sex' },
  '11': { category: 'coding', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Diagnosis inconsistent with procedure' },
  '146': { category: 'coding', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Diagnosis invalid for date of service' },
  '181': { category: 'coding', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Procedure code invalid on date of service' },
  '182': { category: 'coding', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Procedure modifier invalid on date of service' },
  '151': { category: 'coding', isDenial: true, suggestedAction: 'appeal', autoResolvable: false, preventable: true, description: 'Units exceed the number supported' },
  // Bundling
  '97': { category: 'bundling', isDenial: true, suggestedAction: 'review', autoResolvable: false, preventable: true, description: 'Benefit included in payment for another service' },
  '236': { category: 'bundling', isDenial: true, suggestedAction: 'review', autoResolvable: false, preventable: true, description: 'Procedure combination not compatible (NCCI)' },
  'B15': { category: 'bundling', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Add-on requires a qualifying primary service' },
  // Medical necessity
  '50': { category: 'medical_necessity', isDenial: true, suggestedAction: 'appeal', autoResolvable: false, preventable: true, description: 'Not deemed a medical necessity' },
  '167': { category: 'medical_necessity', isDenial: true, suggestedAction: 'appeal', autoResolvable: false, preventable: true, description: 'Diagnosis not covered' },
  // Timely filing
  '29': { category: 'timely_filing', isDenial: true, suggestedAction: 'appeal', autoResolvable: false, preventable: true, description: 'Time limit for filing has expired' },
  // Duplicate
  '18': { category: 'duplicate', isDenial: true, suggestedAction: 'close_duplicate', autoResolvable: true, preventable: true, description: 'Exact duplicate claim/service' },
  // COB
  '22': { category: 'coordination_of_benefits', isDenial: true, suggestedAction: 'rebill', autoResolvable: false, preventable: true, description: 'May be covered by another payer per COB' },
  '23': { category: 'coordination_of_benefits', isDenial: false, suggestedAction: 'review', autoResolvable: false, preventable: false, description: 'Impact of prior payer adjudication' },
  // Credentialing
  '170': { category: 'credentialing', isDenial: true, suggestedAction: 'appeal', autoResolvable: false, preventable: true, description: 'Payment denied when performed by this provider type' },
  '242': { category: 'credentialing', isDenial: true, suggestedAction: 'review', autoResolvable: false, preventable: true, description: 'Services not provided by network/primary care providers' },
  'B7': { category: 'credentialing', isDenial: true, suggestedAction: 'appeal', autoResolvable: false, preventable: true, description: 'Provider not certified/eligible on this date' },
  // Documentation / missing information
  '16': { category: 'documentation', isDenial: true, suggestedAction: 'corrected_claim', autoResolvable: false, preventable: true, description: 'Claim lacks information or has billing errors' },
  '226': { category: 'documentation', isDenial: true, suggestedAction: 'request_records', autoResolvable: false, preventable: false, description: 'Information requested from the billing provider not received' },
  '227': { category: 'documentation', isDenial: true, suggestedAction: 'request_records', autoResolvable: false, preventable: false, description: 'Information requested from the patient not received' },
  '252': { category: 'documentation', isDenial: true, suggestedAction: 'request_records', autoResolvable: false, preventable: false, description: 'Attachment/documentation required' },
  // Non-covered
  '96': { category: 'non_covered', isDenial: true, suggestedAction: 'review', autoResolvable: false, preventable: false, description: 'Non-covered charge' },
  '204': { category: 'non_covered', isDenial: true, suggestedAction: 'bill_patient', autoResolvable: false, preventable: false, description: 'Not covered under the patient plan' },
  '49': { category: 'non_covered', isDenial: true, suggestedAction: 'review', autoResolvable: false, preventable: false, description: 'Routine/preventive exam or screening not covered' },
  // Benefit limits
  '119': { category: 'benefit_limit', isDenial: true, suggestedAction: 'bill_patient', autoResolvable: false, preventable: false, description: 'Benefit maximum reached' },
  '35': { category: 'benefit_limit', isDenial: true, suggestedAction: 'bill_patient', autoResolvable: false, preventable: false, description: 'Lifetime benefit maximum reached' },
};

export function classifyAdjustment(group: string, reasonCode: string): Classification {
  const known = T[reasonCode];
  if (known) {
    // PR-* on an unfamiliar reason is still patient responsibility by definition of the group.
    return known;
  }
  if (group === 'PR') {
    return { category: 'patient_responsibility', isDenial: false, suggestedAction: 'bill_patient', autoResolvable: false, preventable: false, description: `Patient responsibility (${reasonCode})` };
  }
  if (group === 'CO') {
    return { category: 'other', isDenial: true, suggestedAction: 'review', autoResolvable: false, preventable: false, description: `Contractual obligation ${reasonCode}` };
  }
  // OA / PI / CR: never safe to assume.
  return { category: 'other', isDenial: true, suggestedAction: 'review', autoResolvable: false, preventable: false, description: `${group}-${reasonCode}` };
}

/** True when this CAS group may be posted without a person looking at it. */
export function isAutoPostable(group: string, reasonCode: string): boolean {
  if (group === 'CR') return false;
  if (group === 'OA' || group === 'PI') return false;
  const c = classifyAdjustment(group, reasonCode);
  return !c.isDenial && c.autoResolvable;
}
