import { sql, type SQL } from '@grove/db';
import { DATASETS, type DateGrain, type Dataset } from './model';

/**
 * A saved report. Every string here is either a registry KEY (resolved, never
 * interpolated) or a VALUE (always a bind parameter). There is no code path that puts
 * user text into an identifier position.
 */
export interface ReportQuery {
  dataset: string;
  measures: string[];
  dimensions: Array<{ key: string; grain?: DateGrain }>;
  filters: Array<{ key: string; op: FilterOp; values: Array<string | number | boolean> }>;
  sort?: Array<{ key: string; dir: 'asc' | 'desc' }>;
  limit?: number;
}

export type FilterOp = 'eq' | 'ne' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'is_null' | 'not_null' | 'contains';

export interface CompiledReport {
  query: SQL;
  columns: Array<{ key: string; label: string; kind: 'dimension' | 'measure'; format?: string }>;
  containsPhi: boolean;
}

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportValidationError';
  }
}

const MAX_LIMIT = 10_000;

export function compileReport(q: ReportQuery): CompiledReport {
  const ds = DATASETS[q.dataset];
  if (!ds) throw new ReportValidationError(`Unknown dataset "${q.dataset}"`);
  if (q.measures.length === 0 && q.dimensions.length === 0) throw new ReportValidationError('Select at least one dimension or measure');

  const required = new Set<string>();
  const selects: SQL[] = [];
  const groupBy: SQL[] = [];
  const columns: CompiledReport['columns'] = [];
  let containsPhi = false;

  for (const d of q.dimensions) {
    const dim = ds.dimensions[d.key];
    if (!dim) throw new ReportValidationError(`Unknown dimension "${d.key}" in ${ds.key}`);
    dim.requires?.forEach((j) => required.add(j));
    if (dim.phi) containsPhi = true;
    let expr = dim.sql;
    if (d.grain) {
      if (dim.type !== 'date' || !dim.grains?.includes(d.grain)) throw new ReportValidationError(`Dimension "${d.key}" does not support grain ${d.grain}`);
      expr = sql`date_trunc(${d.grain}, ${dim.sql})::date`;
    }
    const alias = sql.identifier(d.grain ? `${d.key}_${d.grain}` : d.key);
    selects.push(sql`${expr} as ${alias}`);
    groupBy.push(sql`${selects.length}`);
    columns.push({ key: d.grain ? `${d.key}_${d.grain}` : d.key, label: dim.label, kind: 'dimension' });
  }
  for (const m of q.measures) {
    const measure = ds.measures[m];
    if (!measure) throw new ReportValidationError(`Unknown measure "${m}" in ${ds.key}`);
    measure.requires?.forEach((j) => required.add(j));
    selects.push(sql`${measure.sql} as ${sql.identifier(m)}`);
    columns.push({ key: m, label: measure.label, kind: 'measure', format: measure.format });
  }

  const where: SQL[] = [ds.baseFilter];
  for (const f of q.filters) {
    const dim = ds.dimensions[f.key];
    if (!dim) throw new ReportValidationError(`Unknown filter dimension "${f.key}"`);
    dim.requires?.forEach((j) => required.add(j));
    where.push(compileFilter(dim.sql, f.op, f.values));
  }

  // Joins are derived from what was selected, never user-specified.
  const joins: SQL[] = [];
  for (const j of required) {
    const join = ds.joins[j];
    if (!join) throw new ReportValidationError(`Dataset ${ds.key} has no join "${j}"`);
    joins.push(sql`left join ${join.to} on ${join.on}`);
  }

  const orderBy: SQL[] = [];
  for (const s of q.sort ?? []) {
    const idx = columns.findIndex((c) => c.key === s.key);
    if (idx < 0) throw new ReportValidationError(`Cannot sort by "${s.key}"; it is not a selected column`);
    orderBy.push(sql`${idx + 1} ${s.dir === 'desc' ? sql`desc` : sql`asc`} nulls last`);
  }

  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.trunc(q.limit ?? 1000)));

  const query = sql`select ${sql.join(selects, sql`, `)} from ${ds.from} ${sql.join(joins, sql` `)} where ${sql.join(where, sql` and `)}${groupBy.length && q.measures.length ? sql` group by ${sql.join(groupBy, sql`, `)}` : sql``}${orderBy.length ? sql` order by ${sql.join(orderBy, sql`, `)}` : sql``} limit ${limit}`;

  return { query, columns, containsPhi };
}

function compileFilter(expr: SQL, op: FilterOp, values: Array<string | number | boolean>): SQL {
  const [a, b] = values;
  switch (op) {
    case 'eq': return sql`${expr} = ${a}`;
    case 'ne': return sql`${expr} <> ${a}`;
    case 'gt': return sql`${expr} > ${a}`;
    case 'gte': return sql`${expr} >= ${a}`;
    case 'lt': return sql`${expr} < ${a}`;
    case 'lte': return sql`${expr} <= ${a}`;
    case 'between':
      if (values.length !== 2) throw new ReportValidationError('between requires exactly two values');
      return sql`${expr} between ${a} and ${b}`;
    case 'in':
      if (values.length === 0) throw new ReportValidationError('in requires at least one value');
      return sql`${expr} = any(${values})`;
    case 'not_in':
      if (values.length === 0) throw new ReportValidationError('not_in requires at least one value');
      return sql`not (${expr} = any(${values}))`;
    case 'is_null': return sql`${expr} is null`;
    case 'not_null': return sql`${expr} is not null`;
    case 'contains':
      if (typeof a !== 'string') throw new ReportValidationError('contains requires a string');
      return sql`${expr} ilike ${'%' + a.replace(/[%_\\]/g, (c) => '\\' + c) + '%'}`;
  }
}

/** Standard reports every practice manager asks for on day one. */
export const STANDARD_REPORTS: Record<string, ReportQuery> = {
  ar_aging_by_payer: { dataset: 'claims', measures: ['claim_count', 'balance'], dimensions: [{ key: 'payer_name' }, { key: 'aging_bucket' }], filters: [{ key: 'status', op: 'not_in', values: ['paid', 'closed', 'voided'] }], sort: [{ key: 'balance', dir: 'desc' }] },
  denials_by_category: { dataset: 'denials', measures: ['denial_count', 'denied_amount', 'recovered_amount', 'overturn_rate'], dimensions: [{ key: 'category' }], filters: [], sort: [{ key: 'denied_amount', dir: 'desc' }] },
  denials_by_payer_month: { dataset: 'denials', measures: ['denial_count', 'denied_amount'], dimensions: [{ key: 'payer_name' }, { key: 'denied_date', grain: 'month' }], filters: [], sort: [{ key: 'denied_date_month', dir: 'desc' }] },
  collections_by_month: { dataset: 'ledger', measures: ['charges', 'insurance_payments', 'patient_payments', 'contractual', 'net_collection_rate'], dimensions: [{ key: 'posting_date', grain: 'month' }], filters: [], sort: [{ key: 'posting_date_month', dir: 'desc' }] },
  payer_performance: { dataset: 'claims', measures: ['claim_count', 'charged', 'paid', 'denial_rate', 'first_pass_rate', 'avg_days_to_pay'], dimensions: [{ key: 'payer_name' }], filters: [{ key: 'submitted_date', op: 'not_null', values: [] }], sort: [{ key: 'charged', dir: 'desc' }] },
  timely_filing_risk: { dataset: 'claims', measures: ['claim_count', 'balance'], dimensions: [{ key: 'practice_name' }, { key: 'payer_name' }], filters: [{ key: 'timely_filing_at_risk', op: 'eq', values: [true] }], sort: [{ key: 'balance', dir: 'desc' }] },
  eligibility_exceptions: { dataset: 'eligibility', measures: ['check_count', 'inactive_rate'], dimensions: [{ key: 'payer_name' }, { key: 'trigger' }], filters: [], sort: [{ key: 'inactive_rate', dir: 'desc' }] },
};
