import { describe, expect, it } from 'vitest';
import { generate837P, type ProfessionalClaim, type Provider, type ServiceLine } from '@grove/x12';
import { claimToCms1500 } from '../cms1500/fields';
import { renderCms1500 } from '../cms1500/render';
import { CMS1500_MAX_LINES } from '../cms1500/layout';

/**
 * A ten-line professional claim, exercising modifiers and diagnosis pointers across
 * more service lines than one CMS-1500 can hold. Ten lines is ordinary for an
 * orthopaedic visit bundled with lab and an injection, and it is the case where the
 * paper form and the 837P must NOT diverge: the 837 carries all ten, the paper form
 * paginates onto a continuation sheet.
 */

const billingProvider: Provider = {
  isPerson: false,
  organization: { name: 'ORCHARD HEALTH SYSTEMS LLC' },
  npi: '1982736450',
  taxId: '364928190',
  taxIdType: 'EI',
  address: { line1: '1200 ORCHARD PKWY STE 400', city: 'AUSTIN', state: 'TX', postalCode: '787591842' },
  contact: { name: 'BILLING', phone: '5125550142' },
  taxonomyCode: '207X00000X',
};

const renderingProvider: Provider = {
  isPerson: true,
  person: { lastName: 'REYES', firstName: 'MARISOL', middleName: 'A' },
  npi: '1548392012',
  taxonomyCode: '207XS0117X',
};

/** ICD-10-CM, ordered. Position in this array is the pointer value (1 = A). */
const diagnoses = [
  'M25561', // A  Pain in right knee
  'M1711', // B  Unilateral primary osteoarthritis, right knee
  'E119', // C  Type 2 diabetes mellitus without complications
  'I10', // D  Essential (primary) hypertension
  'Z794', // E  Long term (current) use of insulin
  'M5450', // F  Low back pain, unspecified
];

const DOS = '2026-08-14';

const line = (
  n: number,
  procedureCode: string,
  modifiers: string[],
  chargeCents: number,
  diagnosisPointers: number[],
  units = 1,
): ServiceLine => ({
  lineNumber: n,
  procedureCode,
  modifiers,
  chargeCents,
  units,
  unitType: 'UN',
  diagnosisPointers,
  serviceDate: DOS,
  placeOfService: '11',
  lineControlNumber: `LN${String(n).padStart(3, '0')}`,
  renderingProvider,
});

const lines: ServiceLine[] = [
  line(1, '99214', ['25'], 17500, [1, 2]), //  E/M, separately identifiable
  line(2, '20610', ['RT'], 14500, [1, 2]), //  Arthrocentesis, major joint, right
  line(3, '73562', ['RT'], 8500, [1, 2]), //   X-ray knee, 3 views, right
  line(4, '96372', [], 3200, [3]), //          Therapeutic injection, SC/IM
  line(5, 'J1040', [], 1850, [1, 2]), //       Methylprednisolone acetate 80 mg
  line(6, '36415', [], 1200, [3, 4]), //       Venipuncture
  line(7, '80053', [], 4700, [3, 4]), //       Comprehensive metabolic panel
  line(8, '83036', [], 2800, [3, 5]), //       Hemoglobin A1c
  line(9, '93000', [], 5500, [4]), //          ECG, 12-lead with interpretation
  line(10, '97110', ['59', 'GP'], 6500, [6], 2), // Therapeutic exercise, 2 units
];

const totalChargeCents = lines.reduce((s, l) => s + l.chargeCents, 0);

export const tenLineClaim: ProfessionalClaim = {
  patientControlNumber: 'CLM-2026-0442',
  totalChargeCents,
  placeOfService: '11',
  frequencyCode: '1',
  providerSignatureOnFile: true,
  assignmentCode: 'A',
  benefitsAssigned: true,
  releaseOfInformation: 'Y',
  diagnoses,
  dates: { onset: '2026-07-02' },
  priorAuthorizationNumber: 'AUTH-99312',
  billingProvider,
  renderingProvider,
  subscriber: {
    person: { lastName: 'NGUYEN', firstName: 'THAO', middleName: 'B' },
    memberId: 'BCX884120773',
    groupNumber: 'GRP-77120',
    groupName: 'BLUE CHOICE PPO',
    dateOfBirth: '1978-03-22',
    sex: 'F',
    address: { line1: '4417 SHOAL CREEK BLVD', city: 'AUSTIN', state: 'TX', postalCode: '787563311' },
    relationshipToPatient: '18',
  },
  payer: { name: 'BLUE CROSS BLUE SHIELD OF TEXAS', payerId: '84980', claimFilingIndicator: 'BL' },
  payerSequence: 'P',
  lines,
};

describe('ten-line professional claim', () => {
  it('totals the ten lines to $662.50', () => {
    expect(lines).toHaveLength(10);
    expect(totalChargeCents).toBe(66250);
  });

  it('carries all ten lines, their modifiers and pointers into the 837P', () => {
    const segs = generate837P([tenLineClaim], {
      submitter: { name: 'ORCHARD HEALTH', id: 'ETIN1234', contactName: 'BILLING', contactPhone: '5125550142' },
      receiver: { name: 'CLEARINGHOUSE', id: '84980' },
      batchReference: 'BATCH-0442',
      timestamp: new Date('2026-08-20T09:30:00Z'),
    });

    const lx = segs.filter((s) => s.id === 'LX');
    const sv1 = segs.filter((s) => s.id === 'SV1');
    expect(lx).toHaveLength(10);
    expect(sv1).toHaveLength(10);

    // SV101 is a composite: HC:code:mod1:mod2:mod3:mod4 — check the ones with modifiers.
    const composites = sv1.map((s) => s.elements[0]);
    expect(composites[0]).toBe('HC:99214:25');
    expect(composites[1]).toBe('HC:20610:RT');
    expect(composites[9]).toBe('HC:97110:59:GP');

    // SV107 is the diagnosis pointer composite, NUMERIC in the 837.
    expect(sv1[0]!.elements[6]).toBe('1:2');
    expect(sv1[7]!.elements[6]).toBe('3:5');
    expect(sv1[9]!.elements[6]).toBe('6');

    // HI carries all six diagnoses: ABK for the principal, ABF for each additional.
    const hi = segs.find((s) => s.id === 'HI');
    expect(hi!.elements).toHaveLength(6);
    expect(hi!.elements[0]).toBe('ABK:M25561');
    expect(hi!.elements[5]).toBe('ABF:M5450');

    // CLM02 must equal the sum of the SV102s, or the payer rejects the claim.
    const clm = segs.find((s) => s.id === 'CLM');
    const svSum = sv1.reduce((s, x) => s + Math.round(Number(x.elements[1]) * 100), 0);
    expect(Number(clm!.elements[1])).toBeCloseTo(662.5, 2);
    expect(svSum).toBe(66250);
  });

  it('paginates the CMS-1500 onto a continuation sheet instead of dropping lines', async () => {
    const fields = claimToCms1500(tenLineClaim);

    // All ten lines must survive the mapping, or the paper claim understates the charge.
    expect(fields.box24).toHaveLength(10);

    // Box 24E takes LETTERS on paper, numbers in the 837.
    expect(fields.box24[0]!.pointer).toBe('AB');
    expect(fields.box24[7]!.pointer).toBe('CE');
    expect(fields.box24[9]!.pointer).toBe('F');
    expect(fields.box24[9]!.mods).toEqual(['59', 'GP']);

    // Box 28 is the whole claim, so it can only agree with 24F if every line is present.
    expect(fields.box28).toBe('662 50');
    const paperSum = fields.box24.reduce((s, l) => s + Math.round(Number(l.charge.replace(' ', '.')) * 100), 0);
    expect(paperSum).toBe(66250);

    const { pages, placements } = await renderCms1500(fields);
    expect(pages).toBe(Math.ceil(10 / CMS1500_MAX_LINES)); // 2
    expect(placements.filter((p) => p.field.startsWith('24D_cpt_'))).toHaveLength(10);
    // The non-final page must say CONTINUED rather than a partial total.
    expect(placements.filter((p) => p.field === 'box28').map((p) => p.text)).toEqual(['CONTINUED', '662 50']);
  });
});
