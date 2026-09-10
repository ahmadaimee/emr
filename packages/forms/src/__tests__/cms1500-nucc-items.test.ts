import { describe, expect, it } from 'vitest';
import type { ProfessionalClaim } from '@grove/x12';
import { claimToCms1500 } from '../cms1500/fields';
import { renderCms1500 } from '../cms1500/render';

/**
 * The items that a straightforward office-visit claim never populates: the other-date
 * row, disability dates, the referral source, outside lab, and the NUCC-designated
 * free-text boxes. A workers' compensation claim exercises most of them at once.
 */
const base: ProfessionalClaim = {
  patientControlNumber: 'GRV-20099',
  totalChargeCents: 42000,
  placeOfService: '11',
  frequencyCode: '1',
  providerSignatureOnFile: true,
  assignmentCode: 'A',
  benefitsAssigned: true,
  releaseOfInformation: 'Y',
  signatureDate: '2026-08-21',
  diagnoses: ['S8351XA', 'M25561', 'E119'],
  relatedCauses: { employment: true, autoAccident: false, otherAccident: false },
  dates: {
    accident: '2026-08-02',
    initialTreatment: '2026-08-03',
    disabilityFrom: '2026-08-03',
    disabilityTo: '2026-09-14',
    hospitalizedFrom: '2026-08-02',
    hospitalizedTo: '2026-08-04',
  },
  otherClaimId: { qualifier: 'Y4', value: 'WC-2026-55120' },
  additionalClaimInfo: 'WORKERS COMP CLAIM - EMPLOYER NOTIFIED 08/02/2026',
  outsideLab: { performed: true, chargesCents: 6500 },
  referringProvider: {
    isPerson: true,
    person: { lastName: 'OKONKWO', firstName: 'DANIEL', middleName: 'R' },
    npi: '1234567893',
    secondaryIds: [{ qualifier: 'G2', value: 'BCBS-44120' }],
  },
  billingProvider: {
    isPerson: false,
    organization: { name: 'NORTHSIDE FAMILY MEDICINE' },
    npi: '1982736450',
    taxId: '123456789',
    taxIdType: 'EI',
    address: { line1: '100 MAIN ST', city: 'SPRINGFIELD', state: 'IL', postalCode: '627011234' },
  },
  subscriber: {
    person: { lastName: 'ALPHA', firstName: 'ALICE', middleName: 'M' },
    memberId: 'ABC123456789',
    groupNumber: 'GRP5550',
    dateOfBirth: '1980-01-01',
    sex: 'F',
    phone: '2175551212',
    address: { line1: '12 OAK LANE', city: 'SPRINGFIELD', state: 'IL', postalCode: '62701' },
    relationshipToPatient: '01',
  },
  patient: {
    person: { lastName: 'ALPHA', firstName: 'ANDREW' },
    dateOfBirth: '1982-05-09',
    sex: 'M',
    phone: '2175559090',
    address: { line1: '12 OAK LANE', city: 'SPRINGFIELD', state: 'IL', postalCode: '62701' },
  },
  payer: { name: 'STATE FUND', payerId: 'SF001', claimFilingIndicator: 'WC' },
  payerSequence: 'P',
  lines: [
    {
      lineNumber: 1,
      procedureCode: '99213',
      modifiers: [],
      chargeCents: 15000,
      units: 1,
      diagnosisPointers: [1, 2, 3],
      serviceDate: '2026-08-20',
    },
    {
      lineNumber: 2,
      procedureCode: 'J1040',
      modifiers: [],
      chargeCents: 27000,
      units: 1,
      diagnosisPointers: [1],
      serviceDate: '2026-08-20',
      ndc: { code: '00009028002', quantity: 1, unit: 'ML' },
    },
  ],
};

describe('CMS-1500 items a simple claim never fills', () => {
  const f = claimToCms1500(base);

  it('puts the accident date in item 15, not item 14', () => {
    // NUCC restricts item 14 to 431 (onset) and 484 (LMP). An accident date is 439,
    // which belongs in the other-date row.
    expect(f.box14).toBe('');
    expect(f.box14_qual).toBe('');
    expect(f.box15).toBe('08 02 26');
    expect(f.box15_qual).toBe('439');
  });

  it('uses 484 in item 14 for a pregnancy claim', () => {
    const lmp = claimToCms1500({ ...base, dates: { lastMenstrualPeriod: '2026-06-01' } });
    expect(lmp.box14).toBe('06 01 26');
    expect(lmp.box14_qual).toBe('484');
  });

  it('falls back through the other-date order when there is no accident', () => {
    const g = claimToCms1500({ ...base, dates: { initialTreatment: '2026-08-03', lastSeen: '2026-08-18' } });
    expect(f.box15_qual).toBe('439');
    expect(g.box15_qual).toBe('454');
    expect(g.box15).toBe('08 03 26');
  });

  it('fills item 16 with the dates unable to work', () => {
    expect(f.box16_from).toBe('08 03 26');
    expect(f.box16_to).toBe('09 14 26');
  });

  it('names the referral source in item 17 with a qualifier and both IDs', () => {
    expect(f.box17).toBe('OKONKWO, DANIEL R');
    expect(f.box17_qual).toBe('DN');
    expect(f.box17b).toBe('1234567893');
    expect(f.box17a).toBe('BCBS-44120');
    expect(f.box17a_qual).toBe('G2');
  });

  it('reports a supervising provider as DQ when there is no referring provider', () => {
    const { referringProvider: _dropped, ...rest } = base;
    const sup = claimToCms1500({
      ...rest,
      supervisingProvider: { isPerson: true, person: { lastName: 'REYES', firstName: 'MARISOL' }, npi: '1548392012' },
    });
    expect(sup.box17_qual).toBe('DQ');
    expect(sup.box17).toBe('REYES, MARISOL');
  });

  it('carries items 11b, 19 and 20', () => {
    expect(f.box11b).toBe('WC-2026-55120');
    expect(f.box11b_qual).toBe('Y4');
    expect(f.box19).toBe('WORKERS COMP CLAIM - EMPLOYER NOTIFIED 08/02/2026');
    expect(f.box20).toBe(true);
    expect(f.box20_charges).toBe('65 00');
  });

  it('leaves item 20 blank when no outside lab was used', () => {
    const { outsideLab: _none, ...rest } = base;
    const g = claimToCms1500(rest);
    expect(g.box20).toBe(false);
    expect(g.box20_charges).toBe('');
  });

  it('fills the patient and insured telephone boxes', () => {
    expect(f.box5_phone).toBe('2175559090');
    expect(f.box7_phone).toBe('2175551212');
    expect(f.box6).toBe('spouse');
  });

  it('caps item 24E at four pointers and carries the NDC in the shaded row', () => {
    const many = claimToCms1500({
      ...base,
      diagnoses: ['A', 'B', 'C', 'D', 'E'],
      lines: [{ ...base.lines[0]!, diagnosisPointers: [1, 2, 3, 4, 5] }],
    });
    expect(many.box24[0]!.pointer).toBe('ABCD');
    expect(f.box24[1]!.supplemental).toBe('N400009028002 ML1');
  });

  it('stamps the signature dates in items 12 and 31', () => {
    expect(f.box12).toBe('SIGNATURE ON FILE');
    expect(f.box12_date).toBe('08 21 26');
    expect(f.box31_date).toBe('08 21 26');
  });

  it('places every newly mapped box on the rendered form', async () => {
    const { placements } = await renderCms1500(f);
    const placed = new Set(placements.map((p) => p.field));
    for (const field of [
      'box11b',
      'box12_date',
      'box15',
      'box15_qual',
      'box16_from',
      'box16_to',
      'box17a',
      'box19',
      'box20',
      'box20_charges',
      'box31_date',
      'box7_phone',
      '24_supplemental_1',
    ]) {
      expect(placed, `${field} should be drawn`).toContain(field);
    }
  });
});
