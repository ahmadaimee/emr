import { sql, type SQL } from '@grove/db';

/**
 * The semantic layer. Datasets, dimensions and measures are CODE — reviewed, typed,
 * version-controlled. Users compose queries over them; they never define models. That
 * is the whole security argument: every identifier in a user's report is a lookup into
 * this registry, and every value is a bind parameter.
 */

export type DimensionType = 'string' | 'date' | 'number' | 'boolean';
export type DateGrain = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface Dimension {
  sql: SQL;
  type: DimensionType;
  label: string;
  requires?: string[];
  grains?: DateGrain[];
  /** True when selecting this dimension makes the result patient-identifiable. */
  phi?: boolean;
}

export interface Measure {
  sql: SQL;
  label: string;
  format: 'integer' | 'currency' | 'percent' | 'days';
  requires?: string[];
  description?: string;
}

export interface Join {
  to: SQL;
  on: SQL;
}

export interface Dataset {
  key: string;
  label: string;
  from: SQL;
  joins: Record<string, Join>;
  dimensions: Record<string, Dimension>;
  measures: Record<string, Measure>;
  /** Always applied. RLS applies too; this is belt-and-braces and helps the planner. */
  baseFilter: SQL;
}

const money = (expr: SQL): SQL => sql`coalesce(${expr}, 0)::bigint`;

export const claims: Dataset = {
  key: 'claims',
  label: 'Claims',
  from: sql`claims c`,
  joins: {
    payer: { to: sql`payers p`, on: sql`p.id = c.payer_id` },
    practice: { to: sql`practices pr`, on: sql`pr.id = c.practice_id` },
    patient: { to: sql`patients pt`, on: sql`pt.id = c.patient_id` },
    encounter: { to: sql`encounters e`, on: sql`e.id = c.encounter_id` },
    provider: { to: sql`providers rp`, on: sql`rp.id = e.rendering_provider_id` },
  },
  dimensions: {
    status: { sql: sql`c.status::text`, type: 'string', label: 'Status' },
    coverage_rank: { sql: sql`c.coverage_rank`, type: 'string', label: 'Coverage rank' },
    payer_name: { sql: sql`p.name`, type: 'string', label: 'Payer', requires: ['payer'] },
    payer_type: { sql: sql`p.type::text`, type: 'string', label: 'Payer type', requires: ['payer'] },
    practice_name: { sql: sql`pr.name`, type: 'string', label: 'Practice', requires: ['practice'] },
    provider_name: { sql: sql`rp.last_name || ', ' || rp.first_name`, type: 'string', label: 'Rendering provider', requires: ['encounter', 'provider'] },
    service_date: { sql: sql`c.service_date_from`, type: 'date', label: 'Date of service', grains: ['day', 'week', 'month', 'quarter', 'year'] },
    submitted_date: { sql: sql`c.submitted_at::date`, type: 'date', label: 'Submitted', grains: ['day', 'week', 'month', 'quarter', 'year'] },
    aging_bucket: {
      sql: sql`case when c.balance_cents <= 0 then 'paid'
                    when current_date - c.service_date_from <= 30 then '0-30'
                    when current_date - c.service_date_from <= 60 then '31-60'
                    when current_date - c.service_date_from <= 90 then '61-90'
                    when current_date - c.service_date_from <= 120 then '91-120'
                    else '120+' end`,
      type: 'string',
      label: 'Aging bucket',
    },
    timely_filing_at_risk: { sql: sql`c.timely_filing_deadline is not null and c.timely_filing_deadline <= current_date + 14 and c.status not in ('paid','closed','voided')`, type: 'boolean', label: 'Timely filing at risk' },
    claim_number: { sql: sql`c.claim_number`, type: 'string', label: 'Claim number', phi: true },
    patient_name: { sql: sql`pt.last_name || ', ' || pt.first_name`, type: 'string', label: 'Patient', requires: ['patient'], phi: true },
  },
  measures: {
    claim_count: { sql: sql`count(distinct c.id)`, label: 'Claims', format: 'integer' },
    charged: { sql: money(sql`sum(c.total_charge_cents)`), label: 'Charges', format: 'currency' },
    paid: { sql: money(sql`sum(c.total_paid_cents)`), label: 'Paid', format: 'currency' },
    adjusted: { sql: money(sql`sum(c.total_adjustment_cents)`), label: 'Adjustments', format: 'currency' },
    balance: { sql: money(sql`sum(c.balance_cents)`), label: 'Open balance', format: 'currency' },
    patient_balance: { sql: money(sql`sum(c.patient_responsibility_cents)`), label: 'Patient balance', format: 'currency' },
    denied_count: { sql: sql`count(distinct c.id) filter (where c.status = 'denied')`, label: 'Denied', format: 'integer' },
    denial_rate: { sql: sql`round(10000.0 * count(distinct c.id) filter (where c.status = 'denied') / greatest(count(distinct c.id) filter (where c.status in ('paid','partially_paid','denied','closed')), 1))`, label: 'Denial rate', format: 'percent', description: 'Denied ÷ adjudicated, in basis points' },
    first_pass_rate: { sql: sql`round(10000.0 * count(distinct c.id) filter (where c.status in ('paid','partially_paid') and not exists (select 1 from claim_submissions s where s.claim_id = c.id and s.attempt_number > 1)) / greatest(count(distinct c.id) filter (where c.submitted_at is not null), 1))`, label: 'First-pass rate', format: 'percent' },
    avg_days_to_pay: { sql: sql`round(avg(extract(day from c.first_remittance_at - c.submitted_at)))`, label: 'Avg days to payment', format: 'days' },
  },
  baseFilter: sql`c.org_id = app.current_org()`,
};

export const denials: Dataset = {
  key: 'denials',
  label: 'Denials',
  from: sql`denials d`,
  joins: {
    payer: { to: sql`payers p`, on: sql`p.id = d.payer_id` },
    practice: { to: sql`practices pr`, on: sql`pr.id = d.practice_id` },
    claim: { to: sql`claims c`, on: sql`c.id = d.claim_id` },
  },
  dimensions: {
    category: { sql: sql`d.category`, type: 'string', label: 'Category' },
    reason_code: { sql: sql`d.group_code || '-' || d.reason_code`, type: 'string', label: 'CARC' },
    status: { sql: sql`d.status`, type: 'string', label: 'Status' },
    preventable: { sql: sql`coalesce(d.preventable, false)`, type: 'boolean', label: 'Preventable' },
    payer_name: { sql: sql`p.name`, type: 'string', label: 'Payer', requires: ['payer'] },
    practice_name: { sql: sql`pr.name`, type: 'string', label: 'Practice', requires: ['practice'] },
    denied_date: { sql: sql`d.created_at::date`, type: 'date', label: 'Denied', grains: ['day', 'week', 'month', 'quarter', 'year'] },
    suggested_action: { sql: sql`d.suggested_action`, type: 'string', label: 'Suggested action' },
  },
  measures: {
    denial_count: { sql: sql`count(*)`, label: 'Denials', format: 'integer' },
    denied_amount: { sql: money(sql`sum(d.denied_amount_cents)`), label: 'Denied amount', format: 'currency' },
    recovered_amount: { sql: money(sql`sum(d.recovered_amount_cents)`), label: 'Recovered', format: 'currency' },
    overturn_rate: { sql: sql`round(10000.0 * count(*) filter (where d.recovered_amount_cents > 0) / greatest(count(*) filter (where d.status in ('resolved','written_off','abandoned')), 1))`, label: 'Overturn rate', format: 'percent' },
    avg_days_open: { sql: sql`round(avg(extract(day from coalesce(d.resolved_at, now()) - d.created_at)))`, label: 'Avg days open', format: 'days' },
  },
  baseFilter: sql`d.org_id = app.current_org()`,
};

export const ledger: Dataset = {
  key: 'ledger',
  label: 'Ledger',
  from: sql`ledger_entries l`,
  joins: {
    payer: { to: sql`payers p`, on: sql`p.id = l.payer_id` },
    practice: { to: sql`practices pr`, on: sql`pr.id = l.practice_id` },
  },
  dimensions: {
    entry_type: { sql: sql`l.entry_type::text`, type: 'string', label: 'Entry type' },
    responsibility: { sql: sql`l.responsibility::text`, type: 'string', label: 'Responsibility' },
    posting_date: { sql: sql`l.posting_date`, type: 'date', label: 'Posting date', grains: ['day', 'week', 'month', 'quarter', 'year'] },
    service_date: { sql: sql`l.service_date`, type: 'date', label: 'Service date', grains: ['day', 'week', 'month', 'quarter', 'year'] },
    payer_name: { sql: sql`p.name`, type: 'string', label: 'Payer', requires: ['payer'] },
    practice_name: { sql: sql`pr.name`, type: 'string', label: 'Practice', requires: ['practice'] },
  },
  measures: {
    charges: { sql: money(sql`sum(l.amount_cents) filter (where l.entry_type = 'charge')`), label: 'Charges', format: 'currency' },
    insurance_payments: { sql: money(sql`-sum(l.amount_cents) filter (where l.entry_type = 'payment_insurance')`), label: 'Insurance payments', format: 'currency' },
    patient_payments: { sql: money(sql`-sum(l.amount_cents) filter (where l.entry_type = 'payment_patient')`), label: 'Patient payments', format: 'currency' },
    contractual: { sql: money(sql`-sum(l.amount_cents) filter (where l.entry_type = 'contractual_adjustment')`), label: 'Contractual adjustments', format: 'currency' },
    write_offs: { sql: money(sql`-sum(l.amount_cents) filter (where l.entry_type in ('write_off','bad_debt'))`), label: 'Write-offs', format: 'currency' },
    net_collection_rate: { sql: sql`round(10000.0 * (-sum(l.amount_cents) filter (where l.entry_type in ('payment_insurance','payment_patient'))) / greatest(sum(l.amount_cents) filter (where l.entry_type = 'charge') + sum(l.amount_cents) filter (where l.entry_type = 'contractual_adjustment'), 1))`, label: 'Net collection rate', format: 'percent', description: 'Payments ÷ (charges − contractual adjustments), basis points' },
  },
  baseFilter: sql`l.org_id = app.current_org()`,
};

export const eligibility: Dataset = {
  key: 'eligibility',
  label: 'Eligibility',
  from: sql`eligibility_checks ec`,
  joins: {
    payer: { to: sql`payers p`, on: sql`p.id = ec.payer_id` },
    practice: { to: sql`practices pr`, on: sql`pr.id = ec.practice_id` },
  },
  dimensions: {
    status: { sql: sql`ec.status::text`, type: 'string', label: 'Result' },
    trigger: { sql: sql`ec.trigger::text`, type: 'string', label: 'Trigger' },
    checked_date: { sql: sql`ec.created_at::date`, type: 'date', label: 'Checked', grains: ['day', 'week', 'month'] },
    payer_name: { sql: sql`p.name`, type: 'string', label: 'Payer', requires: ['payer'] },
    practice_name: { sql: sql`pr.name`, type: 'string', label: 'Practice', requires: ['practice'] },
    has_changes: { sql: sql`ec.has_changes`, type: 'boolean', label: 'Benefits changed' },
  },
  measures: {
    check_count: { sql: sql`count(*)`, label: 'Checks', format: 'integer' },
    inactive_rate: { sql: sql`round(10000.0 * count(*) filter (where ec.status in ('inactive','not_found')) / greatest(count(*), 1))`, label: 'Inactive rate', format: 'percent' },
    avg_latency_ms: { sql: sql`round(avg(ec.latency_ms))`, label: 'Avg latency (ms)', format: 'integer' },
  },
  baseFilter: sql`ec.org_id = app.current_org()`,
};

export const DATASETS: Record<string, Dataset> = { claims, denials, ledger, eligibility };
