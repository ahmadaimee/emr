/**
 * Grove database schema.
 *
 * Every table that can hold PHI or tenant-confidential data carries `org_id` and has
 * a row-level security policy generated for it in the migrations. The only exceptions
 * are the global reference tables in `codes.ts`, which are listed explicitly in
 * `NON_TENANT_TABLES` and asserted against in CI by `tools/check-rls-coverage.ts`.
 */

export * from './tenancy';
export * from './identity';
export * from './patients';
export * from './payers';
export * from './coverage';
export * from './eligibility';
export * from './encounters';
export * from './claims';
export * from './remittance';
export * from './ledger';
export * from './payments';
export * from './workflow';
export * from './rules';
export * from './audit';
export * from './platform';
export * from './codes';

/**
 * Tables that are deliberately NOT tenant-scoped. Anything else in the `public` schema
 * must have `org_id`, RLS enabled, RLS forced, and at least one policy — or the build
 * is red.
 */
export const NON_TENANT_TABLES = [
  'organizations',
  'diagnosis_codes',
  'procedure_codes',
  'ncci_ptp_edits',
  'mue_edits',
  'add_on_code_edits',
  'coverage_policies',
  'coverage_policy_codes',
  'adjustment_reason_codes',
  'place_of_service_codes',
  'code_set_versions',
  '__drizzle_migrations',
] as const;

/**
 * Tables that must be APPEND-ONLY: the application role gets INSERT and SELECT and
 * nothing else, enforced by REVOKE plus a trigger that raises on UPDATE/DELETE.
 */
export const APPEND_ONLY_TABLES = [
  'audit_events',
  'audit_row_changes',
  'phi_access_events',
  'ledger_entries',
  'claim_versions',
  'claim_state_transitions',
  'task_events',
  'outbox_events',
  'external_calls',
] as const;
