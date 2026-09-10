import { describe, expect, it } from 'vitest';
import { parseCsv, parseIcd10Order, parseMue, parseNcciPtp, parseReasonCodes } from '../parsers';

describe('ICD-10-CM order file', () => {
  it('reads fixed-width rows and the billable flag', () => {
    const line1 = `00001 A00     0 Cholera                                                      Cholera`;
    const line2 = `00002 A000    1 Cholera due to Vibrio cholerae 01, biovar cholerae             Cholera due to Vibrio cholerae 01, biovar cholerae`;
    const rows = parseIcd10Order(`${line1}\n${line2}\n`);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: 'A00', billable: false, shortDescription: 'Cholera' });
    expect(rows[1]).toMatchObject({ code: 'A000', billable: true });
    expect(rows[1]?.description).toBe('Cholera due to Vibrio cholerae 01, biovar cholerae');
  });
});

describe('NCCI PTP', () => {
  it('parses code pairs with modifier indicators and dates', () => {
    const csv = 'Column 1,Column 2,*,Effective Date,Deletion Date,Modifier,Rationale\n99214,36415,,20200101,*,1,Standard preparation\n99214,99213,,20200101,*,0,Mutually exclusive\n10021,10004,,20190101,20191231,9,\n';
    const rows = parseNcciPtp(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ columnOneCode: '99214', columnTwoCode: '36415', modifierIndicator: '1', effectiveDate: '2020-01-01', deletionDate: null });
    expect(rows[2]).toMatchObject({ modifierIndicator: '9', deletionDate: '2019-12-31' });
  });
});

describe('MUE', () => {
  it('reads the adjudication indicator from its leading digit', () => {
    const csv = 'HCPCS/CPT Code,Practitioner Services MUE Values,MUE Adjudication Indicator,MUE Rationale\n36415,1,"3 Date of Service Edit: Clinical",Clinical: Data\nJ3490,2,"1 Line Edit",Anatomic\n';
    const rows = parseMue(csv);
    expect(rows).toEqual([
      { code: '36415', maxUnits: 1, mai: '3', rationale: 'Clinical: Data' },
      { code: 'J3490', maxUnits: 2, mai: '1', rationale: 'Anatomic' },
    ]);
  });
});

describe('CARC', () => {
  it('handles quoted descriptions with commas and mixed date formats', () => {
    const csv = 'Code,Description,Start Date,Last Modified,Stop Date,Notes\n45,"Charge exceeds fee schedule/maximum allowable or contracted/legislated fee arrangement. (Use only with Group Codes PR or CO, depending on liability)",01/01/1995,07/01/2023,,\n';
    const rows = parseReasonCodes(csv, 'CARC');
    expect(rows[0]?.code).toBe('45');
    expect(rows[0]?.description).toMatch(/depending on liability/);
    expect(rows[0]?.effectiveDate).toBe('1995-01-01');
    expect(rows[0]?.deactivatedDate).toBeNull();
  });
});

describe('CSV', () => {
  it('handles doubled quotes and CRLF', () => {
    expect(parseCsv('a,"b ""c""",d\r\n1,2,3\r\n')).toEqual([['a', 'b "c"', 'd'], ['1', '2', '3']]);
  });
});
