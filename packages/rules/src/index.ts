import type { Finding } from './ast';
import { evaluateRule, type TenantRule } from './evaluator';
import type { ClaimFacts, ReferenceData } from './facts';
import { SYSTEM_RULES, type SystemRule } from './system-rules';

export * from './ast';
export * from './facts';
export { evaluateRule } from './evaluator';
export type { TenantRule } from './evaluator';
export { SYSTEM_RULES } from './system-rules';
export type { SystemRule } from './system-rules';
export { isValidNpi } from './npi';

export interface ScrubOptions {
  /** System rule keys disabled for this scope (tenant bindings with enabled=false). */
  disabledSystemRules?: Set<string>;
  /** Tenant-authored rules already filtered to this claim's scope. */
  tenantRules?: TenantRule[];
  /** Override the built-in list, e.g. for tests. */
  systemRules?: SystemRule[];
}

export interface ScrubResult {
  findings: Finding[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** True when there are no error-severity findings. */
  clean: boolean;
}

/**
 * Run every applicable rule against a claim. Synchronous and allocation-light so it
 * can run on every save; reference data is pre-loaded by the caller.
 */
export function scrubClaim(facts: ClaimFacts, ref: ReferenceData, opts: ScrubOptions = {}): ScrubResult {
  const findings: Finding[] = [];
  for (const rule of opts.systemRules ?? SYSTEM_RULES) {
    if (opts.disabledSystemRules?.has(rule.key)) continue;
    findings.push(...rule.evaluate(facts, ref));
  }
  for (const rule of opts.tenantRules ?? []) {
    findings.push(...evaluateRule(rule, facts));
  }
  // Errors first, then by line, so the biller sees what blocks submission at the top.
  const rank = { error: 0, warning: 1, info: 2 } as const;
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.lineNumber ?? 0) - (b.lineNumber ?? 0));
  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  return {
    findings,
    errorCount,
    warningCount,
    infoCount: findings.length - errorCount - warningCount,
    clean: errorCount === 0,
  };
}
