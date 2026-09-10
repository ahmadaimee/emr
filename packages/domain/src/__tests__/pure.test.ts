import { describe, expect, it } from 'vitest';
import { yearsBetween } from '../claims/assembly';
import { addDays } from '../claims/create';
import { classifyAdjustment, isAutoPostable } from '../denials/classify';
import { diffBenefits } from '../eligibility/diff';

describe('denial classification', () => {
  it('routes patient responsibility to the patient and automates it', () => {
    expect(classifyAdjustment('PR', '1')).toMatchObject({ category: 'patient_responsibility', suggestedAction: 'bill_patient', autoResolvable: true, isDenial: false });
    expect(isAutoPostable('PR', '1')).toBe(true);
  });

  it('treats CO-45 as a contractual write-off, not a denial', () => {
    expect(classifyAdjustment('CO', '45').isDenial).toBe(false);
    expect(isAutoPostable('CO', '45')).toBe(true);
  });

  it('never auto-posts OA or PI, whatever the reason code', () => {
    expect(isAutoPostable('OA', '45')).toBe(false);
    expect(isAutoPostable('PI', '1')).toBe(false);
    expect(isAutoPostable('CR', '45')).toBe(false);
  });

  it('never marks a coding fix as automatable', () => {
    for (const code of ['4', '11', '16', '181', '182', '236']) {
      expect(classifyAdjustment('CO', code).autoResolvable).toBe(false);
    }
  });

  it('classifies the big buckets', () => {
    expect(classifyAdjustment('CO', '197').category).toBe('authorization');
    expect(classifyAdjustment('CO', '29').category).toBe('timely_filing');
    expect(classifyAdjustment('CO', '18')).toMatchObject({ category: 'duplicate', suggestedAction: 'close_duplicate', autoResolvable: true });
    expect(classifyAdjustment('CO', '22').category).toBe('coordination_of_benefits');
    expect(classifyAdjustment('CO', '50').category).toBe('medical_necessity');
    expect(classifyAdjustment('CO', '9999')).toMatchObject({ category: 'other', suggestedAction: 'review' });
  });
});

describe('benefit diff', () => {
  const base = { active: true, planDescription: 'PPO GOLD', copayCents: 2500, coinsuranceBps: 2000, deductibleTotalCents: 150000, deductibleRemainingCents: 115000, outOfPocketMaxCents: 500000, planBegin: '2026-01-01' };

  it('reports nothing on first verification', () => {
    expect(diffBenefits(null, base)).toEqual([]);
  });

  it('flags termination as critical and puts it first', () => {
    const changes = diffBenefits(base, { ...base, active: false, planEnd: '2026-08-31', copayCents: 3000 });
    expect(changes[0]).toMatchObject({ field: 'active', materiality: 'critical' });
    expect(changes.map((c) => c.field)).toEqual(['active', 'planEnd', 'copayCents']);
  });

  it('ignores ordinary deductible consumption but flags a reset', () => {
    expect(diffBenefits(base, { ...base, deductibleRemainingCents: 90000 })).toEqual([]);
    const reset = diffBenefits({ ...base, deductibleRemainingCents: 20000 }, { ...base, deductibleRemainingCents: 150000 });
    expect(reset).toHaveLength(1);
    expect(reset[0]?.label).toMatch(/Deductible reset/);
  });

  it('describes copay changes in dollars', () => {
    expect(diffBenefits(base, { ...base, copayCents: 4000 })[0]?.label).toBe('Copay changed from $25.00 to $40.00');
  });
});

describe('date helpers', () => {
  it('computes age at date of service correctly around birthdays', () => {
    expect(yearsBetween('1980-06-15', '2026-06-14')).toBe(45);
    expect(yearsBetween('1980-06-15', '2026-06-15')).toBe(46);
    expect(yearsBetween('2015-03-08', '2026-08-20')).toBe(11);
  });
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-25', 10)).toBe('2027-01-04');
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });
});
