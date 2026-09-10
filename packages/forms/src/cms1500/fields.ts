import type { ProfessionalClaim } from '@grove/x12';

/**
 * CMS-1500 (02/12) field values, keyed by box number per the NUCC crosswalk.
 * This is the paper equivalent of the 837P and is derived from the same model, so a
 * paper claim and an electronic claim for the same encounter can never disagree.
 */
export interface Cms1500Fields {
  box1: 'medicare' | 'medicaid' | 'tricare' | 'champva' | 'group' | 'feca' | 'other';
  box1a: string;
  box2: string;
  box3_dob: string; // MM DD YYYY
  box3_sex: 'M' | 'F' | '';
  box4: string;
  box5_street: string;
  box5_city: string;
  box5_state: string;
  box5_zip: string;
  box5_phone: string;
  box6: 'self' | 'spouse' | 'child' | 'other';
  box7_street: string;
  box7_city: string;
  box7_state: string;
  box7_zip: string;
  box7_phone: string;
  box9: string;
  box9a: string;
  box9d: string;
  box10a: boolean;
  box10b: boolean;
  box10b_state: string;
  box10c: boolean;
  box11: string;
  box11a_dob: string;
  box11a_sex: 'M' | 'F' | '';
  box11b: string;
  box11b_qual: string;
  box11c: string;
  box11d: boolean;
  box12: 'SIGNATURE ON FILE' | '';
  box12_date: string;
  box13: 'SIGNATURE ON FILE' | '';
  box14: string;
  /** Item 14 accepts only 431 (onset) and 484 (LMP). */
  box14_qual: '431' | '484' | '';
  box15: string;
  box15_qual: string;
  box16_from: string;
  box16_to: string;
  box17: string;
  /** DN referring, DK ordering, DQ supervising. */
  box17_qual: string;
  box17a: string;
  box17a_qual: string;
  box17b: string;
  box18_from: string;
  box18_to: string;
  box19: string;
  box20: boolean;
  box20_charges: string;
  box21_icd: '0';
  box21: string[]; // up to 12, A–L
  box22_code: string;
  box22_ref: string;
  box23: string;
  box24: Array<{
    from: string; to: string; pos: string; emg: string; cpt: string; mods: string[]; pointer: string; charge: string; units: string; epsdt: string; renderingNpi: string;
    /** Shaded supplemental row — NDC for drug lines, per NUCC item 24 guidance. */
    supplemental: string;
  }>;
  box25: string;
  box25_type: 'SSN' | 'EIN';
  box26: string;
  box27: boolean;
  box28: string;
  box29: string;
  box31: string;
  box31_date: string;
  box32_name: string;
  box32_addr1: string;
  box32_addr2: string;
  box32a: string;
  box33_name: string;
  box33_addr1: string;
  box33_addr2: string;
  box33_phone: string;
  box33a: string;
}

const mmddyyyy = (iso?: string) => (iso ? `${iso.slice(5, 7)} ${iso.slice(8, 10)} ${iso.slice(0, 4)}` : '');
const mmddyy = (iso?: string) => (iso ? `${iso.slice(5, 7)} ${iso.slice(8, 10)} ${iso.slice(2, 4)}` : '');
const dollars = (cents: number) => `${Math.floor(cents / 100)} ${String(cents % 100).padStart(2, '0')}`;
const LETTERS = 'ABCDEFGHIJKL';

/**
 * Item 15 holds ONE "other date" with its qualifier. The claim may carry several, so
 * they are tried in the order a payer is most likely to need. Accident leads because
 * item 14 cannot hold it: NUCC restricts item 14 to 431 and 484.
 */
const OTHER_DATE_ORDER: Array<[keyof NonNullable<ProfessionalClaim['dates']>, string]> = [
  ['accident', '439'],
  ['initialTreatment', '454'],
  ['lastXray', '455'],
  ['lastSeen', '304'],
  ['assumedCare', '090'],
  ['relinquishedCare', '091'],
];

export function claimToCms1500(c: ProfessionalClaim, opts: { priorPaidCents?: number; phone?: string } = {}): Cms1500Fields {
  const cfi = c.payer.claimFilingIndicator;
  const box1: Cms1500Fields['box1'] = cfi === 'MB' || cfi === 'MA' ? 'medicare' : cfi === 'MC' ? 'medicaid' : cfi === 'CH' ? 'tricare' : cfi === 'VA' ? 'champva' : cfi === 'FI' ? 'feca' : cfi === 'CI' || cfi === 'BL' || cfi === 'HM' ? 'group' : 'other';
  const patient = c.patient ?? { person: c.subscriber.person, dateOfBirth: c.subscriber.dateOfBirth ?? '', sex: c.subscriber.sex ?? 'U', address: c.subscriber.address ?? { line1: '', city: '', state: '', postalCode: '' } };
  const rel = c.patient ? c.subscriber.relationshipToPatient : '18';
  const name = (p: { lastName: string; firstName: string; middleName?: string }) => [p.lastName, p.firstName, p.middleName?.charAt(0)].filter(Boolean).join(', ').replace(', ', ', ').replace(/, ([A-Z])$/, ' $1');
  const bill = c.billingProvider;
  const other = c.otherSubscribers?.[0];

  return {
    box1,
    box1a: c.subscriber.memberId,
    box2: name(patient.person),
    box3_dob: mmddyyyy(patient.dateOfBirth),
    box3_sex: patient.sex === 'M' || patient.sex === 'F' ? patient.sex : '',
    box4: rel === '18' ? 'SAME' : name(c.subscriber.person),
    box5_street: patient.address.line1,
    box5_city: patient.address.city,
    box5_state: patient.address.state,
    box5_zip: patient.address.postalCode,
    box5_phone: patient.phone ?? opts.phone ?? '',
    box6: rel === '18' ? 'self' : rel === '01' ? 'spouse' : rel === '19' ? 'child' : 'other',
    box7_street: rel === '18' ? 'SAME' : c.subscriber.address?.line1 ?? '',
    box7_city: rel === '18' ? '' : c.subscriber.address?.city ?? '',
    box7_state: rel === '18' ? '' : c.subscriber.address?.state ?? '',
    box7_zip: rel === '18' ? '' : c.subscriber.address?.postalCode ?? '',
    box7_phone: rel === '18' ? '' : c.subscriber.phone ?? '',
    box9: other ? name(other.person) : '',
    box9a: other?.groupNumber ?? '',
    box9d: other?.payer.name ?? '',
    box10a: Boolean(c.relatedCauses?.employment),
    box10b: Boolean(c.relatedCauses?.autoAccident),
    box10b_state: c.relatedCauses?.state ?? '',
    box10c: Boolean(c.relatedCauses?.otherAccident),
    box11: c.subscriber.groupNumber ?? 'NONE',
    box11a_dob: rel === '18' ? '' : mmddyyyy(c.subscriber.dateOfBirth),
    box11a_sex: rel === '18' ? '' : c.subscriber.sex === 'M' || c.subscriber.sex === 'F' ? c.subscriber.sex : '',
    box11b: c.otherClaimId?.value ?? '',
    box11b_qual: c.otherClaimId?.qualifier ?? '',
    box11c: c.subscriber.groupName ?? c.payer.name,
    box11d: Boolean(other),
    box12: c.releaseOfInformation === 'Y' || c.releaseOfInformation === 'I' ? 'SIGNATURE ON FILE' : '',
    box12_date: mmddyy(c.signatureDate),
    box13: c.benefitsAssigned ? 'SIGNATURE ON FILE' : '',
    // Item 14 takes the onset of the current illness, or the LMP for a pregnancy claim.
    // It accepts no other qualifier — an accident date belongs in item 15.
    box14: mmddyy(c.dates?.onset ?? c.dates?.lastMenstrualPeriod),
    box14_qual: c.dates?.onset ? '431' : c.dates?.lastMenstrualPeriod ? '484' : '',
    box15: mmddyy(otherDate(c)?.[0]),
    box15_qual: otherDate(c)?.[1] ?? '',
    box16_from: mmddyy(c.dates?.disabilityFrom),
    box16_to: mmddyy(c.dates?.disabilityTo),
    box17: referralSource(c)?.name ?? '',
    box17_qual: referralSource(c)?.qualifier ?? '',
    box17a: referralSource(c)?.otherId?.value ?? '',
    box17a_qual: referralSource(c)?.otherId?.qualifier ?? '',
    box17b: referralSource(c)?.npi ?? '',
    box18_from: mmddyy(c.dates?.hospitalizedFrom),
    box18_to: mmddyy(c.dates?.hospitalizedTo),
    box19: c.additionalClaimInfo ?? '',
    box20: Boolean(c.outsideLab?.performed),
    box20_charges: c.outsideLab?.performed ? dollars(c.outsideLab.chargesCents) : '',
    box21_icd: '0',
    // NUCC item 21: "Do not include the decimal point." The boxes have no position for
    // one, and OCR reads the extra character as part of the code.
    box21: c.diagnoses.slice(0, 12).map((d) => d.replace('.', '')),
    box22_code: c.frequencyCode === '7' ? '7' : c.frequencyCode === '8' ? '8' : '',
    box22_ref: c.originalPayerClaimControlNumber ?? '',
    box23: c.priorAuthorizationNumber ?? c.referralNumber ?? c.cliaNumber ?? '',
    // Every line is mapped. `renderCms1500` paginates them six to a sheet, because box
    // 28 is the whole claim: truncating here would print a total that disagrees with
    // the lines above it, and the payer would reject the claim for the mismatch.
    box24: c.lines.map((l) => ({
      from: mmddyy(l.serviceDate),
      to: mmddyy(l.serviceDateThrough ?? l.serviceDate),
      pos: l.placeOfService ?? c.placeOfService,
      emg: l.emergency ? 'Y' : '',
      cpt: l.procedureCode,
      mods: l.modifiers.slice(0, 4),
      // Box 24E takes LETTERS; the 837 takes numbers. The model stores numbers.
      // The box holds at most four, same as SV107.
      pointer: l.diagnosisPointers.slice(0, 4).map((p) => LETTERS[p - 1] ?? '').join(''),
      charge: dollars(l.chargeCents),
      units: String(l.units),
      epsdt: l.epsdt ? 'Y' : '',
      renderingNpi: l.renderingProvider?.npi ?? c.renderingProvider?.npi ?? bill.npi,
      // Shaded row above the line: NDC for drug lines, as N4 + code + quantity.
      supplemental: l.ndc ? `N4${l.ndc.code} ${l.ndc.unit}${l.ndc.quantity}` : '',
    })),
    box25: bill.taxId ?? '',
    box25_type: bill.taxIdType === 'SY' ? 'SSN' : 'EIN',
    box26: c.patientControlNumber,
    box27: c.assignmentCode === 'A',
    box28: dollars(c.totalChargeCents),
    box29: dollars(opts.priorPaidCents ?? other?.paidAmountCents ?? 0),
    box31: 'SIGNATURE ON FILE',
    box31_date: mmddyy(c.signatureDate),
    box32_name: c.serviceFacility?.organization?.name ?? bill.organization?.name ?? '',
    box32_addr1: c.serviceFacility?.address?.line1 ?? bill.address?.line1 ?? '',
    box32_addr2: cityLine(c.serviceFacility?.address ?? bill.address),
    box32a: c.serviceFacility?.npi ?? bill.npi,
    box33_name: bill.organization?.name ?? '',
    box33_addr1: bill.address?.line1 ?? '',
    box33_addr2: cityLine(bill.address),
    box33_phone: bill.contact?.phone ?? '',
    box33a: bill.npi,
  };
}

/** The first "other date" the claim carries, with the qualifier item 15 expects. */
function otherDate(c: ProfessionalClaim): [string, string] | undefined {
  const d = c.dates;
  if (!d) return undefined;
  for (const [key, qualifier] of OTHER_DATE_ORDER) {
    const value = d[key];
    if (typeof value === 'string' && value) return [value, qualifier];
  }
  return undefined;
}

/**
 * Item 17 names ONE source with a qualifier. A referring provider is reported ahead of a
 * supervising one, because that is what the payer adjudicates against; an explicit
 * `referringProviderRole` overrides the guess (DK, ordering, has no separate loop here).
 */
function referralSource(c: ProfessionalClaim) {
  const provider = c.referringProvider ?? c.supervisingProvider;
  if (!provider) return undefined;
  const qualifier = c.referringProviderRole ?? (c.referringProvider ? 'DN' : 'DQ');
  const secondary = provider.secondaryIds?.[0];
  return {
    name: provider.person ? `${provider.person.lastName}, ${provider.person.firstName}${provider.person.middleName ? ` ${provider.person.middleName.charAt(0)}` : ''}` : provider.organization?.name ?? '',
    qualifier,
    npi: provider.npi,
    otherId: secondary ? { qualifier: secondary.qualifier, value: secondary.value } : undefined,
  };
}

function cityLine(a?: { city: string; state: string; postalCode: string }): string {
  if (!a) return '';
  const zip = a.postalCode.length === 9 ? `${a.postalCode.slice(0, 5)}-${a.postalCode.slice(5)}` : a.postalCode;
  return `${a.city} ${a.state} ${zip}`;
}
