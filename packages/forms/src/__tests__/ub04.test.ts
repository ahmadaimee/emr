import { describe, expect, it } from 'vitest';
import type { InstitutionalClaim, RevenueLine } from '@grove/x12';
import { claimToUb04, UB04_LINES_PER_PAGE } from '../ub04/fields';
import { renderUb04 } from '../ub04/render';

const rev = (n: number, revenueCode: string, description: string, chargeCents: number, units = 1, hcpcs?: string, modifiers: string[] = []): RevenueLine => ({
  lineNumber: n,
  revenueCode,
  description,
  hcpcs,
  modifiers,
  units,
  chargeCents,
  serviceDate: '2026-07-14',
});

/** A three-day inpatient stay: room and board, pharmacy, lab, imaging, OR. */
const lines: RevenueLine[] = [
  rev(1, '0120', 'ROOM-BOARD/SEMI', 420000, 3),
  rev(2, '0250', 'PHARMACY', 86400),
  rev(3, '0270', 'MED-SUR SUPPLIES', 41200),
  rev(4, '0300', 'LABORATORY', 31800, 6, '80053'),
  rev(5, '0301', 'LAB/CHEMISTRY', 14500, 2, '82947'),
  rev(6, '0320', 'DX X-RAY', 52000, 1, '71046'),
  rev(7, '0350', 'CT SCAN', 118000, 1, '74177'),
  rev(8, '0360', 'OR SERVICES', 264000, 1, '47562'),
  rev(9, '0370', 'ANESTHESIA', 96000, 1, '00790'),
  rev(10, '0710', 'RECOVERY ROOM', 58000, 1),
  rev(11, '0730', 'EKG/ECG', 22000, 1, '93000'),
  rev(12, '0272', 'STERILE SUPPLY', 18400),
  rev(13, '0258', 'IV SOLUTIONS', 12600),
  rev(14, '0305', 'LAB/HEMATOLOGY', 9800, 2, '85025'),
  rev(15, '0410', 'RESPIRATORY SVC', 26500, 2),
  rev(16, '0420', 'PHYSICAL THERP', 34000, 2, '97110', ['GP']),
  rev(17, '0450', 'EMERGENCY ROOM', 92000, 1, '99284'),
  rev(18, '0636', 'DRUGS/DETAIL CODE', 44200, 1, 'J1040'),
  rev(19, '0278', 'SUPPLY/IMPLANTS', 310000, 1),
  rev(20, '0331', 'CHEMOTHERAPY', 78000, 1),
  rev(21, '0460', 'PULMONARY FUNC', 21000, 1, '94010'),
  rev(22, '0940', 'OTHER THERAPY', 15500, 1),
  // Line 23 pushes the claim onto a second sheet.
  rev(23, '0921', 'PERIPHERAL VASCULAR LAB', 27500, 1, '93922'),
  rev(24, '0762', 'OBSERVATION HOURS', 46000, 4),
];

const totalChargeCents = lines.reduce((s, l) => s + l.chargeCents, 0);

const claim: InstitutionalClaim = {
  patientControlNumber: 'GRV-INP-77120',
  medicalRecordNumber: 'MR-4482910',
  // 0111 — hospital (1), inpatient (1), admit-through-discharge (1).
  typeOfBill: '0111',
  federalTaxNumber: '364928190',
  statementFrom: '2026-07-12',
  statementThrough: '2026-07-15',
  billingProvider: {
    isPerson: false,
    organization: { name: 'ORCHARD REGIONAL MEDICAL CENTER' },
    npi: '1982736450',
    address: { line1: '2400 HOSPITAL WAY', city: 'SPRINGFIELD', state: 'IL', postalCode: '627049921' },
    contact: { name: 'PATIENT ACCOUNTS', phone: '2175554100' },
    secondaryIds: [{ qualifier: 'G2', value: 'IL-MCD-88213' }],
  },
  patient: {
    patientId: 'PT-99120',
    person: { lastName: 'OKAFOR', firstName: 'CHIDI', middleName: 'N' },
    dateOfBirth: '1958-11-03',
    sex: 'M',
    address: { line1: '88 LAKESHORE DR', city: 'SPRINGFIELD', state: 'IL', postalCode: '627011188', countryCode: 'US' },
  },
  admission: { date: '2026-07-12', hour: '14', priority: '1', pointOfOrigin: '7' },
  dischargeHour: '11',
  patientStatus: '01',
  conditionCodes: ['A1', '05'],
  accidentState: '',
  occurrenceCodes: [
    { code: '11', date: '2026-07-10' },
    { code: '24', date: '2026-07-11' },
  ],
  occurrenceSpans: [{ code: '70', from: '2026-07-12', through: '2026-07-15' }],
  responsibleParty: { name: 'OKAFOR, CHIDI N', address: { line1: '88 LAKESHORE DR', city: 'SPRINGFIELD', state: 'IL', postalCode: '62701' } },
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
      priorPaymentsCents: 0,
      estimatedDueCents: totalChargeCents,
      insuredName: 'OKAFOR, CHIDI N',
      relationship: '18',
      insuredId: '1EG4TE5MK73',
      groupName: 'MEDICARE',
      treatmentAuthCode: 'AUTH-5521',
      employerName: '',
    },
    {
      name: 'BLUE CROSS MEDIGAP',
      healthPlanId: '84980',
      releaseOfInformation: 'Y',
      benefitsAssigned: true,
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
    { code: 'I10', presentOnAdmission: 'Y' },
    { code: 'N17.9', presentOnAdmission: 'N' },
  ],
  admittingDiagnosis: 'R10.11',
  reasonForVisit: ['R10.9'],
  ppsCode: '',
  externalCauseCodes: [],
  principalProcedure: { code: '0FT44ZZ', date: '2026-07-13' },
  otherProcedures: [{ code: 'BF10ZZZ', date: '2026-07-12' }],
  attendingProvider: {
    npi: '1487654323',
    person: { lastName: 'VANCE', firstName: 'MARCUS' },
    qualifier: '0B',
    otherId: 'IL-036-99214',
  },
  operatingProvider: { npi: '1548392012', person: { lastName: 'REYES', firstName: 'MARISOL' } },
  otherProviders: [{ npi: '1346798527', person: { lastName: 'ROSTOVA', firstName: 'ELENA' }, role: 'referring' }],
  remarks: 'INPATIENT ADMIT VIA ED - CHOLECYSTECTOMY',
  codeCode: [{ qualifier: 'B3', code: '282N00000X' }],
};

describe('UB-04 mapping', () => {
  const f = claimToUb04(claim, { creationDate: '2026-07-16' });

  it('maps the header locators', () => {
    expect(f.fl1_name).toBe('ORCHARD REGIONAL MEDICAL CENTER');
    expect(f.fl3a).toBe('GRV-INP-77120');
    expect(f.fl3b).toBe('MR-4482910');
    expect(f.fl4).toBe('0111');
    expect(f.fl5).toBe('364928190');
    expect(f.fl6_from).toBe('071226');
    expect(f.fl6_through).toBe('071526');
    expect(f.fl56).toBe('1982736450');
  });

  it('maps patient identity, admission and discharge', () => {
    expect(f.fl8b).toBe('OKAFOR, CHIDI, N');
    expect(f.fl9d).toBe('627011188');
    expect(f.fl10).toBe('110358');
    expect(f.fl11).toBe('M');
    expect(f.fl12).toBe('071226');
    expect(f.fl13).toBe('14');
    expect(f.fl14).toBe('1');
    expect(f.fl15).toBe('7');
    expect(f.fl17).toBe('01');
  });

  it('pads the fixed-width code blocks so the boxes line up', () => {
    // Eleven condition-code boxes, four occurrence slots, twelve value slots — the
    // form has that many boxes whether or not the claim fills them.
    expect(f.fl18_28).toHaveLength(11);
    expect(f.fl18_28[0]).toBe('A1');
    expect(f.fl18_28[2]).toBe('');
    expect(f.fl31_34).toHaveLength(4);
    expect(f.fl31_34[0]).toEqual({ code: '11', date: '071026' });
    expect(f.fl35_36).toHaveLength(2);
    expect(f.fl35_36[0]).toEqual({ code: '70', from: '071226', through: '071526' });
    expect(f.fl39_41).toHaveLength(12);
    expect(f.fl39_41[1]).toEqual({ code: 'A1', amount: '1500 00' });
    expect(f.fl67_other).toHaveLength(17);
    expect(f.fl74_other).toHaveLength(5);
  });

  it('strips decimals from diagnosis codes and keeps the POA indicators', () => {
    expect(f.fl66).toBe('0');
    expect(f.fl67).toBe('K8020');
    expect(f.fl67_poa).toBe('Y');
    expect(f.fl67_other[0]).toEqual({ code: 'E119', poa: 'Y' });
    expect(f.fl67_other[2]).toEqual({ code: 'N179', poa: 'N' });
    expect(f.fl69).toBe('R1011');
    expect(f.fl70[0]).toBe('R109');
  });

  it('carries both payers across the FL 50–65 rows', () => {
    expect(f.payers).toHaveLength(2);
    expect(f.payers[0]!.fl50).toBe('MEDICARE PART A');
    expect(f.payers[0]!.fl51).toBe('00953');
    expect(f.payers[0]!.fl52).toBe('Y');
    expect(f.payers[0]!.fl53).toBe('Y');
    expect(f.payers[0]!.fl60).toBe('1EG4TE5MK73');
    expect(f.payers[0]!.fl63).toBe('AUTH-5521');
    expect(f.payers[1]!.fl62).toBe('GRP-77120');
  });

  it('maps the attending, operating and other providers', () => {
    expect(f.fl76).toEqual({ npi: '1487654323', qual: '0B', id: 'IL-036-99214', last: 'VANCE', first: 'MARCUS' });
    expect(f.fl77.npi).toBe('1548392012');
    expect(f.fl78.last).toBe('ROSTOVA');
    expect(f.fl79).toEqual({ npi: '', qual: '', id: '', last: '', first: '' });
    expect(f.fl81[0]).toEqual({ qualifier: 'B3', code: '282N00000X' });
  });

  it('puts the HCPCS and its modifiers together in FL 44', () => {
    expect(f.lines[15]!.fl42).toBe('0420');
    expect(f.lines[15]!.fl44).toBe('97110 GP');
    expect(f.lines[0]!.fl46).toBe('3');
    expect(f.lines[0]!.fl47).toBe('4200 00');
  });

  it('totals the claim, not the page', () => {
    expect(totalChargeCents).toBe(1939400);
    expect(f.totals.fl42).toBe('0001');
    expect(f.totals.fl47).toBe('19394 00');
    const sum = f.lines.reduce((s, l) => s + Math.round(Number(l.fl47.replace(' ', '.')) * 100), 0);
    expect(sum).toBe(totalChargeCents);
  });
});

describe('UB-04 rendering', () => {
  const f = claimToUb04(claim, { creationDate: '2026-07-16' });

  it('continues past 22 revenue lines onto a second sheet', async () => {
    const { pages, placements } = await renderUb04(f);
    expect(f.lines).toHaveLength(24);
    expect(pages).toBe(2);

    // Every line is drawn across the two sheets, 22 then 2.
    const drawn = placements.filter((p) => /^fl42_\d+$/.test(p.field));
    expect(drawn).toHaveLength(24);
    expect(placements.filter((p) => p.field === 'fl42_0')).toHaveLength(2); // one per page

    const pageLabels = placements.filter((p) => p.field === 'pageOf').map((p) => p.text);
    expect(pageLabels).toEqual(['PAGE 1 OF 2', 'PAGE 2 OF 2']);
  });

  it('prints the totals line once, on the last sheet, for the whole claim', async () => {
    const { placements } = await renderUb04(f);
    const totals = placements.filter((p) => p.field === 'totals_fl47');
    expect(totals).toHaveLength(1);
    expect(totals[0]!.text).toBe('19394 00');
  });

  it('fits a short claim on one page with its totals', async () => {
    const short = claimToUb04({ ...claim, lines: lines.slice(0, 5), totalChargeCents: 593900 });
    const { pages, placements } = await renderUb04(short);
    expect(pages).toBe(1);
    expect(short.lines.length).toBeLessThanOrEqual(UB04_LINES_PER_PAGE);
    expect(placements.find((p) => p.field === 'totals_fl47')?.text).toBe('5939 00');
  });

  it('applies a printer calibration offset', async () => {
    const plain = await renderUb04(f);
    const shifted = await renderUb04(f, { offset: { x: 4, y: -3 } });
    const a = plain.placements.find((p) => p.field === 'fl3a')!;
    const b = shifted.placements.find((p) => p.field === 'fl3a')!;
    expect(b.x - a.x).toBe(4);
    expect(b.y - a.y).toBe(-3);
  });
});
