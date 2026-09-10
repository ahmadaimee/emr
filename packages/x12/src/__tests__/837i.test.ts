import { describe, expect, it } from 'vitest';
import { generate837I } from '../generators/837i';
import type { InstitutionalClaim, RevenueLine } from '../types';

const rev = (n: number, revenueCode: string, chargeCents: number, units = 1, hcpcs?: string, modifiers: string[] = []): RevenueLine => ({
  lineNumber: n,
  revenueCode,
  modifiers,
  units,
  chargeCents,
  hcpcs,
  serviceDate: '2026-07-14',
  lineControlNumber: `LN${String(n).padStart(3, '0')}`,
});

const lines: RevenueLine[] = [
  rev(1, '0120', 420000, 3),
  rev(2, '0250', 86400),
  rev(3, '0300', 31800, 6, '80053'),
  rev(4, '0360', 264000, 1, '47562'),
  rev(5, '0420', 34000, 2, '97110', ['GP']),
];

const totalChargeCents = lines.reduce((s, l) => s + l.chargeCents, 0);

/** The same three-day inpatient stay the UB-04 renderer is tested against. */
const claim: InstitutionalClaim = {
  patientControlNumber: 'GRV-INP-77120',
  medicalRecordNumber: 'MR-4482910',
  typeOfBill: '0111',
  federalTaxNumber: '36-4928190',
  statementFrom: '2026-07-12',
  statementThrough: '2026-07-15',
  billingProvider: {
    isPerson: false,
    organization: { name: 'ORCHARD REGIONAL MEDICAL CENTER' },
    npi: '1982736450',
    taxIdType: 'EI',
    taxonomyCode: '282N00000X',
    address: { line1: '2400 HOSPITAL WAY', city: 'SPRINGFIELD', state: 'IL', postalCode: '627049921' },
    contact: { name: 'PATIENT ACCOUNTS', phone: '2175554100' },
  },
  patient: {
    person: { lastName: 'OKAFOR', firstName: 'CHIDI', middleName: 'N' },
    dateOfBirth: '1958-11-03',
    sex: 'M',
    address: { line1: '88 LAKESHORE DR', city: 'SPRINGFIELD', state: 'IL', postalCode: '627011188' },
  },
  admission: { date: '2026-07-12', hour: '14', priority: '1', pointOfOrigin: '7' },
  dischargeHour: '11',
  patientStatus: '01',
  conditionCodes: ['A1', '05'],
  occurrenceCodes: [{ code: '11', date: '2026-07-10' }],
  occurrenceSpans: [{ code: '70', from: '2026-07-12', through: '2026-07-15' }],
  valueCodes: [
    { code: '80', amountCents: 300 },
    { code: 'A1', amountCents: 150000 },
  ],
  lines,
  totalChargeCents,
  payers: [
    {
      name: 'MEDICARE PART A',
      healthPlanId: '00953',
      releaseOfInformation: 'Y',
      benefitsAssigned: true,
      insuredName: 'OKAFOR, CHIDI N',
      relationship: '18',
      insuredId: '1EG4TE5MK73',
      treatmentAuthCode: 'AUTH-5521',
    },
    {
      name: 'BLUE CROSS MEDIGAP',
      healthPlanId: '84980',
      releaseOfInformation: 'Y',
      benefitsAssigned: true,
      priorPaymentsCents: 25000,
      insuredName: 'OKAFOR, CHIDI N',
      relationship: '18',
      insuredId: 'BCX884120773',
      groupNumber: 'GRP-77120',
    },
  ],
  icdVersion: '0',
  principalDiagnosis: { code: 'K80.20', presentOnAdmission: 'Y' },
  otherDiagnoses: [
    { code: 'E11.9', presentOnAdmission: 'Y' },
    { code: 'N17.9', presentOnAdmission: 'N' },
  ],
  admittingDiagnosis: 'R10.11',
  reasonForVisit: ['R10.9'],
  externalCauseCodes: [],
  principalProcedure: { code: '0FT44ZZ', date: '2026-07-13' },
  otherProcedures: [{ code: 'BF10ZZZ', date: '2026-07-12' }],
  attendingProvider: {
    npi: '1487654323',
    person: { lastName: 'VANCE', firstName: 'MARCUS' },
    taxonomyCode: '207Q00000X',
    qualifier: '0B',
    otherId: 'IL-036-99214',
  },
  operatingProvider: { npi: '1548392012', person: { lastName: 'REYES', firstName: 'MARISOL' } },
  otherProviders: [],
  remarks: 'INPATIENT ADMIT VIA ED',
  codeCode: [{ qualifier: 'B3', code: '282N00000X' }],
};

const opts = {
  submitter: { name: 'ORCHARD HEALTH', id: 'ETIN1234', contactName: 'BILLING', contactPhone: '2175554100' },
  receiver: { name: 'CLEARINGHOUSE', id: '00953' },
  batchReference: 'BATCH-INP-1',
  timestamp: new Date('2026-07-16T09:30:00Z'),
};

const build = (c: InstitutionalClaim = claim) => generate837I([c], opts);
const find = (segs: ReturnType<typeof build>, id: string) => segs.filter((s) => s.id === id);

describe('837I generator', () => {
  const segs = build();

  it('derives CLM05 from the type of bill', () => {
    // 0111 → facility code 11, frequency 1. The frequency is the type of bill's last
    // digit, not a separate field.
    const clm = find(segs, 'CLM')[0]!;
    expect(clm.el(1)).toBe('GRV-INP-77120');
    expect(Number(clm.el(2))).toBeCloseTo(8362, 2);
    expect(clm.el(5)).toBe('11:A:1');
    expect(clm.el(8)).toBe('Y');
    expect(clm.el(9)).toBe('Y');
  });

  it('sends the statement period as a range and the admission as a date-time', () => {
    const dtp = find(segs, 'DTP');
    const statement = dtp.find((s) => s.el(1) === '434')!;
    expect(statement.el(2)).toBe('RD8');
    expect(statement.el(3)).toBe('20260712-20260715');

    const admission = dtp.find((s) => s.el(1) === '435')!;
    expect(admission.el(2)).toBe('DT');
    expect(admission.el(3)).toBe('202607121400');

    expect(dtp.find((s) => s.el(1) === '096')!.el(3)).toBe('1100');
  });

  it('reports admission type, source and patient status in CL1', () => {
    const cl1 = find(segs, 'CL1')[0]!;
    expect([cl1.el(1), cl1.el(2), cl1.el(3)]).toEqual(['1', '7', '01']);
  });

  it('puts the POA indicator in the ninth component of the diagnosis', () => {
    const hi = find(segs, 'HI');
    const principal = hi.find((s) => s.el(1).startsWith('ABK'))!;
    // Qualifier, code, then seven unused components, then the POA flag.
    expect(principal.el(1)).toBe('ABK:K8020:::::::Y');
    expect(principal.comp(1, 2)).toBe('K8020');
    expect(principal.comp(1, 9)).toBe('Y');

    const other = hi.find((s) => s.el(1).startsWith('ABF'))!;
    expect(other.comp(1, 9)).toBe('Y');
    expect(other.comp(2, 2)).toBe('N179');
    expect(other.comp(2, 9)).toBe('N');
  });

  it('carries the UB-04 code boxes as HI segments', () => {
    const hi = find(segs, 'HI');
    const byQualifier = (q: string) => hi.find((s) => s.el(1).startsWith(`${q}:`));

    expect(byQualifier('ABJ')!.el(1)).toBe('ABJ:R1011');
    expect(byQualifier('APR')!.el(1)).toBe('APR:R109');
    // Procedures carry their date in components 3 and 4.
    expect(byQualifier('BBR')!.el(1)).toBe('BBR:0FT44ZZ:D8:20260713');
    expect(byQualifier('BBQ')!.el(1)).toBe('BBQ:BF10ZZZ:D8:20260712');
    // Condition, occurrence, span and value codes.
    expect(byQualifier('BG')!.comps(1)).toEqual(['BG', 'A1']);
    expect(byQualifier('BG')!.comps(2)).toEqual(['BG', '05']);
    expect(byQualifier('BH')!.el(1)).toBe('BH:11:D8:20260710');
    expect(byQualifier('BI')!.el(1)).toBe('BI:70:RD8:20260712-20260715');
    // A value code's amount is the fifth component.
    expect(byQualifier('BE')!.comps(1)).toEqual(['BE', '80', '', '', '3']);
    expect(byQualifier('BE')!.comp(2, 5)).toBe('1500');
  });

  it('bills each line as SV2 keyed on the revenue code', () => {
    const sv2 = find(segs, 'SV2');
    expect(sv2).toHaveLength(5);
    expect(find(segs, 'LX')).toHaveLength(5);

    // Room and board has no HCPCS — the revenue code is the whole story.
    expect(sv2[0]!.el(1)).toBe('0120');
    expect(sv2[0]!.el(2)).toBe('');
    expect(sv2[0]!.el(3)).toBe('4200');
    expect(sv2[0]!.el(5)).toBe('3');

    // A HCPCS line carries it as supporting detail, with its modifiers.
    expect(sv2[4]!.el(1)).toBe('0420');
    expect(sv2[4]!.el(2)).toBe('HC:97110:GP');

    // CLM02 must equal the sum of the SV203s or the payer rejects the bill.
    const sum = sv2.reduce((s, x) => s + Math.round(Number(x.el(3)) * 100), 0);
    expect(sum).toBe(totalChargeCents);
  });

  it('names the attending provider, with taxonomy and secondary id', () => {
    const attending = find(segs, 'NM1').find((s) => s.el(1) === '71')!;
    expect(attending.el(4)).toBe('MARCUS');
    expect(attending.el(9)).toBe('1487654323');
    expect(find(segs, 'PRV').some((s) => s.el(1) === 'AT' && s.el(3) === '207Q00000X')).toBe(true);
    expect(find(segs, 'REF').some((s) => s.el(1) === '0B' && s.el(2) === 'IL-036-99214')).toBe(true);
    // Operating physician is 72.
    expect(find(segs, 'NM1').some((s) => s.el(1) === '72')).toBe(true);
  });

  it('opens a 2320 loop for the secondary payer', () => {
    const sbr = find(segs, 'SBR');
    expect(sbr).toHaveLength(2);
    expect(sbr[0]!.el(1)).toBe('P');
    expect(sbr[0]!.el(9)).toBe('MA'); // Medicare Part A
    expect(sbr[1]!.el(1)).toBe('S');
    expect(find(segs, 'AMT').some((s) => s.el(1) === 'D' && s.el(2) === '250')).toBe(true);
    expect(find(segs, 'OI')).toHaveLength(1);
  });

  it('refuses a replacement bill with no document control number', () => {
    // Type of bill 0117 replaces a prior claim. Without the payer's control number the
    // payer treats it as a new original and denies it as a duplicate.
    expect(() => build({ ...claim, typeOfBill: '0117' })).toThrow(/document control number/i);

    const ok = build({
      ...claim,
      typeOfBill: '0117',
      payers: [{ ...claim.payers[0]!, documentControlNumber: '2026243000123' }, claim.payers[1]!],
    });
    expect(find(ok, 'CLM')[0]!.el(5)).toBe('11:A:7');
    expect(find(ok, 'REF').some((s) => s.el(1) === 'F8' && s.el(2) === '2026243000123')).toBe(true);
  });

  it('rejects a malformed revenue code', () => {
    expect(() => build({ ...claim, lines: [{ ...lines[0]!, revenueCode: '120' }] })).toThrow(/four digits/i);
  });

  it('requires a payer', () => {
    expect(() => build({ ...claim, payers: [] })).toThrow(/at least one payer/i);
  });
});
