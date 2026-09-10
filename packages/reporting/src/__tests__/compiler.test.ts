import { describe, expect, it } from 'vitest';
import { compileReport, ReportValidationError, STANDARD_REPORTS } from '../compiler';

/** Render a Drizzle SQL object to text + params without a database. */
function render(q: ReturnType<typeof compileReport>['query']): { text: string; params: unknown[] } {
  const chunks = (q as unknown as { queryChunks: unknown[] }).queryChunks;
  const params: unknown[] = [];
  const walk = (c: unknown): string => {
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object') {
      const o = c as { value?: unknown; queryChunks?: unknown[]; encoder?: unknown };
      if (Array.isArray(o.queryChunks)) return o.queryChunks.map(walk).join('');
      if ('value' in o && Array.isArray(o.value)) return o.value.join('');
      if ('value' in o) {
        params.push(o.value);
        return `$${params.length}`;
      }
    }
    return String(c);
  };
  return { text: chunks.map(walk).join(''), params };
}

describe('report compiler', () => {
  it('compiles a grouped, filtered, sorted query with bound parameters only', () => {
    const c = compileReport({
      dataset: 'claims',
      measures: ['claim_count', 'balance'],
      dimensions: [{ key: 'payer_name' }, { key: 'service_date', grain: 'month' }],
      filters: [{ key: 'status', op: 'in', values: ['submitted', 'denied'] }, { key: 'service_date', op: 'between', values: ['2026-01-01', '2026-06-30'] }],
      sort: [{ key: 'balance', dir: 'desc' }],
      limit: 50,
    });
    const { text, params } = render(c.query);
    expect(text).toContain('left join payers p on p.id = c.payer_id');
    expect(text).toContain('c.org_id = app.current_org()');
    expect(text).toContain('group by 1, 2');
    expect(text).toContain('order by 4 desc nulls last');
    expect(params).toEqual(['month', ['submitted', 'denied'], '2026-01-01', '2026-06-30', 50]);
    expect(c.containsPhi).toBe(false);
    expect(c.columns.map((x) => x.key)).toEqual(['payer_name', 'service_date_month', 'claim_count', 'balance']);
  });

  it('cannot be injected through identifiers or values', () => {
    expect(() => compileReport({ dataset: 'claims; drop table claims', measures: [], dimensions: [{ key: 'status' }], filters: [] })).toThrow(ReportValidationError);
    expect(() => compileReport({ dataset: 'claims', measures: ['balance) from claims; --'], dimensions: [], filters: [] })).toThrow(ReportValidationError);
    expect(() => compileReport({ dataset: 'claims', measures: [], dimensions: [{ key: 'status' }], filters: [], sort: [{ key: 'c.id; drop', dir: 'asc' }] })).toThrow(ReportValidationError);

    const c = compileReport({ dataset: 'claims', measures: ['claim_count'], dimensions: [], filters: [{ key: 'payer_name', op: 'contains', values: ["'; drop table claims; --"] }] });
    const { text, params } = render(c.query);
    expect(text).not.toContain('drop table');
    expect(params[0]).toBe("%'; drop table claims; --%");
  });

  it('marks patient-grain reports as PHI', () => {
    const c = compileReport({ dataset: 'claims', measures: ['balance'], dimensions: [{ key: 'patient_name' }], filters: [] });
    expect(c.containsPhi).toBe(true);
  });

  it('rejects grains on non-date dimensions and clamps limits', () => {
    expect(() => compileReport({ dataset: 'claims', measures: [], dimensions: [{ key: 'status', grain: 'month' }], filters: [] })).toThrow(/grain/);
    const c = compileReport({ dataset: 'claims', measures: ['claim_count'], dimensions: [], filters: [], limit: 999_999 });
    expect(render(c.query).params.at(-1)).toBe(10_000);
  });

  it('ships standard reports that all compile', () => {
    for (const [name, q] of Object.entries(STANDARD_REPORTS)) {
      expect(() => compileReport(q), name).not.toThrow();
    }
  });
});
