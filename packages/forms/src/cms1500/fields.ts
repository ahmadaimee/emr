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
  box11c: string;
  box11d: boolean;
  box12: 'SIGNATURE ON FILE' | '';
  box13: 'SIGNATURE ON FILE' | '';
  box14: string;
  box14_qual: string;
  box17: string;
  box17_qual: string;
  box17b: string;
  box18_from: string;
  box18_to: string;
  box21_icd: '0';
  box21: string[]; // up to 12, A–L
  box22_code: string;
  box22_ref: string;
  box23: string;
  box24: Array<{
    from: string; to: string; pos: string; emg: string; cpt: string; mods: string[]; pointer: string; charge: string; units: string; epsdt: string; renderingNpi: string;
  }>;
  box25: string;
  box25_type: 'SSN' | 'EIN';
  box26: string;
  box27: boolean;
  box28: string;
  box29: string;
  box31: string;
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
    box5_phone: opts.phone ?? '',
    box6: rel === '18' ? 'self' : rel === '01' ? 'spouse' : rel === '19' ? 'child' : 'other',
    box7_street: rel === '18' ? 'SAME' : c.subscriber.address?.line1 ?? '',
    box7_city: rel === '18' ? '' : c.subscriber.address?.city ?? '',
    box7_state: rel === '18' ? '' : c.subscriber.address?.state ?? '',
    box7_zip: rel === '18' ? '' : c.subscriber.address?.postalCode ?? '',
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
    box11c: c.subscriber.groupName ?? c.payer.name,
    box11d: Boolean(other),
    box12: c.releaseOfInformation === 'Y' || c.releaseOfInformation === 'I' ? 'SIGNATURE ON FILE' : '',
    box13: c.benefitsAssigned ? 'SIGNATURE ON FILE' : '',
    box14: mmddyy(c.dates?.onset ?? c.dates?.accident),
    box14_qual: c.dates?.onset ? '431' : c.dates?.accident ? '439' : '',
    box17: c.referringProvider?.person ? `${c.referringProvider.person.firstName} ${c.referringProvider.person.lastName}` : '',
    box17_qual: c.referringProvider ? 'DN' : '',
    box17b: c.referringProvider?.npi ?? '',
    box18_from: mmddyy(c.dates?.hospitalizedFrom),
    box18_to: mmddyy(c.dates?.hospitalizedTo),
    box21_icd: '0',
    box21: c.diagnoses.slice(0, 12).map((d) => (d.length > 3 ? `${d.slice(0, 3)}.${d.slice(3)}` : d)),
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
      pointer: l.diagnosisPointers.map((p) => LETTERS[p - 1] ?? '').join(''),
      charge: dollars(l.chargeCents),
      units: String(l.units),
      epsdt: l.epsdt ? 'Y' : '',
      renderingNpi: l.renderingProvider?.npi ?? c.renderingProvider?.npi ?? bill.npi,
    })),
    box25: bill.taxId ?? '',
    box25_type: bill.taxIdType === 'SY' ? 'SSN' : 'EIN',
    box26: c.patientControlNumber,
    box27: c.assignmentCode === 'A',
    box28: dollars(c.totalChargeCents),
    box29: dollars(opts.priorPaidCents ?? other?.paidAmountCents ?? 0),
    box31: 'SIGNATURE ON FILE',
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

function cityLine(a?: { city: string; state: string; postalCode: string }): string {
  if (!a) return '';
  const zip = a.postalCode.length === 9 ? `${a.postalCode.slice(0, 5)}-${a.postalCode.slice(5)}` : a.postalCode;
  return `${a.city} ${a.state} ${zip}`;
}
