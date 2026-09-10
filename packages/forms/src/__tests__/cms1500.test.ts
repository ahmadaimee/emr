import { describe, expect, it } from 'vitest';
import type { ProfessionalClaim } from '@grove/x12';
import { claimToCms1500 } from '../cms1500/fields';
import { renderCms1500 } from '../cms1500/render';

const claim: ProfessionalClaim = {
  patientControlNumber: 'GRV-10041',
  totalChargeCents: 35000,
  placeOfService: '11',
  frequencyCode: '1',
  providerSignatureOnFile: true,
  assignmentCode: 'A',
  benefitsAssigned: true,
  releaseOfInformation: 'Y',
  diagnoses: ['E119', 'I10'],
  billingProvider: { isPerson: false, organization: { name: 'NORTHSIDE FAMILY MEDICINE' }, npi: '1234567893', taxId: '123456789', taxIdType: 'EI', address: { line1: '100 MAIN ST', city: 'SPRINGFIELD', state: 'IL', postalCode: '627011234' } },
  renderingProvider: { isPerson: true, person: { lastName: 'SMITH', firstName: 'JANE' }, npi: '1987654321' },
  subscriber: { person: { lastName: 'ALPHA', firstName: 'ALICE', middleName: 'M' }, memberId: 'ABC123456789', groupNumber: 'GRP5550', dateOfBirth: '1980-01-01', sex: 'F', address: { line1: '12 OAK LANE', city: 'SPRINGFIELD', state: 'IL', postalCode: '62701' }, relationshipToPatient: '18' },
  payer: { name: 'SAMPLE HEALTH PLAN', payerId: 'SHP001', claimFilingIndicator: 'CI' },
  payerSequence: 'P',
  lines: [
    { lineNumber: 1, procedureCode: '99214', modifiers: ['25'], chargeCents: 25000, units: 1, diagnosisPointers: [1, 2], serviceDate: '2026-08-20' },
    { lineNumber: 2, procedureCode: '36415', modifiers: [], chargeCents: 10000, units: 1, diagnosisPointers: [1], serviceDate: '2026-08-20' },
  ],
};

describe('CMS-1500 mapping', () => {
  const f = claimToCms1500(claim);

  it('maps the NUCC crosswalk', () => {
    expect(f.box1).toBe('group');
    expect(f.box1a).toBe('ABC123456789');
    expect(f.box2).toBe('ALPHA, ALICE M');
    expect(f.box3_dob).toBe('01 01 1980');
    expect(f.box4).toBe('SAME');
    expect(f.box6).toBe('self');
    expect(f.box21).toEqual(['E11.9', 'I10']);
    expect(f.box25).toBe('123456789');
    expect(f.box25_type).toBe('EIN');
    expect(f.box26).toBe('GRV-10041');
    expect(f.box28).toBe('350 00');
    expect(f.box33a).toBe('1234567893');
  });

  it('converts numeric diagnosis pointers to box 24E letters', () => {
    expect(f.box24[0]?.pointer).toBe('AB');
    expect(f.box24[1]?.pointer).toBe('A');
    expect(f.box24[0]?.charge).toBe('250 00');
    expect(f.box24[0]?.from).toBe('08 20 26');
  });

  it('carries the original claim number for corrected claims', () => {
    const corrected = claimToCms1500({ ...claim, frequencyCode: '7', originalPayerClaimControlNumber: '2026243000123' });
    expect(corrected.box22_code).toBe('7');
    expect(corrected.box22_ref).toBe('2026243000123');
  });
});

describe('CMS-1500 rendering', () => {
  it('renders a single page with every populated field placed', async () => {
    const result = await renderCms1500(claimToCms1500(claim));
    expect(result.pages).toBe(1);
    expect(result.pdf.byteLength).toBeGreaterThan(1000);
    const byField = new Map(result.placements.map((p) => [p.field, p.text]));
    expect(byField.get('box1a')).toBe('ABC123456789');
    expect(byField.get('24E_0')).toBe('AB');
    expect(byField.get('box28')).toBe('350 00');
  });

  it('paginates claims with more than six lines and marks box 28 CONTINUED', async () => {
    const many: ProfessionalClaim = { ...claim, lines: Array.from({ length: 8 }, (_, i) => ({ ...claim.lines[1]!, lineNumber: i + 1 })) };
    const result = await renderCms1500(claimToCms1500(many));
    expect(result.pages).toBe(2);
    const box28 = result.placements.filter((p) => p.field === 'box28').map((p) => p.text);
    expect(box28).toEqual(['CONTINUED', '350 00']);
    expect(result.placements.filter((p) => p.field.startsWith('24D_cpt'))).toHaveLength(8);
  });

  it('applies a printer calibration offset', async () => {
    const a = await renderCms1500(claimToCms1500(claim));
    const b = await renderCms1500(claimToCms1500(claim), { offset: { x: 3, y: -2 } });
    const pa = a.placements.find((p) => p.field === 'box2')!;
    const pb = b.placements.find((p) => p.field === 'box2')!;
    expect(pb.x - pa.x).toBe(3);
    expect(pb.y - pa.y).toBe(-2);
  });
});
