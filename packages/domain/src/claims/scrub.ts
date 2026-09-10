import { and, eq, inArray, schema, sql } from '@grove/db';
import { scrubClaim, validateRule, type ReferenceData, type RuleDefinition, type Severity, type TenantRule } from '@grove/rules';
import { assembleClaimFacts, loadClaimAssembly, type ClaimAssembly } from './assembly';
import { transitionClaim } from './lifecycle';
import { emit } from '../outbox';
import { todayIso, type CommandContext } from '../context';

/**
 * Reference data backed by the code tables, pre-loaded for the codes on THIS claim so
 * evaluation is synchronous and issues a handful of queries rather than hundreds.
 */
export async function loadReferenceData(ctx: CommandContext, a: ClaimAssembly): Promise<ReferenceData> {
  const codes = [...new Set([...a.lines.map((l) => l.procedureCode), ...a.sameDayLinesOnOtherClaims.map((l) => l.procedureCode)])];
  const dx = [...new Set(a.encounter.diagnosisCodes.map((c) => c.replace('.', '').toUpperCase()))];
  const dos = a.encounter.serviceDate;

  const [ptp, mue, addOns, procs, dxs, pos, policies] = await Promise.all([
    codes.length
      ? ctx.tx.select().from(schema.ncciPtpEdits).where(and(inArray(schema.ncciPtpEdits.columnTwoCode, codes), inArray(schema.ncciPtpEdits.columnOneCode, codes), sql`effective_date <= ${dos}`, sql`(deletion_date is null or deletion_date > ${dos})`))
      : [],
    codes.length ? ctx.tx.select().from(schema.mueEdits).where(and(inArray(schema.mueEdits.code, codes), sql`effective_date <= ${dos}`, sql`(deletion_date is null or deletion_date > ${dos})`)) : [],
    codes.length ? ctx.tx.select().from(schema.addOnCodeEdits).where(inArray(schema.addOnCodeEdits.addOnCode, codes)) : [],
    codes.length ? ctx.tx.select().from(schema.procedureCodes).where(inArray(schema.procedureCodes.code, codes)) : [],
    dx.length ? ctx.tx.select().from(schema.diagnosisCodes).where(inArray(schema.diagnosisCodes.code, dx)) : [],
    ctx.tx.select().from(schema.placeOfServiceCodes),
    codes.length && dx.length ? ctx.tx.select().from(schema.coveragePolicyCodes).where(and(inArray(schema.coveragePolicyCodes.procedureCode, codes), inArray(schema.coveragePolicyCodes.diagnosisCode, dx))) : [],
  ]);

  const posMap = new Map(pos.map((p) => [p.code, p]));
  const procMap = new Map(procs.map((p) => [p.code, p]));
  const dxMap = new Map(dxs.map((d) => [d.code, d]));

  return {
    ncciPtp: (c1, c2) => {
      const e = ptp.find((x) => x.columnOneCode === c1 && x.columnTwoCode === c2);
      return e ? { modifierIndicator: e.modifierIndicator as '0' | '1' | '9' } : null;
    },
    mue: (code) => {
      const e = mue.find((x) => x.code === code);
      return e ? { maxUnits: e.maxUnits, mai: e.mai as '1' | '2' | '3' } : null;
    },
    addOnPrimaries: (code) => {
      const rows = addOns.filter((x) => x.addOnCode === code);
      return rows.length ? { primaryCodes: rows.map((r) => r.primaryCode), addOnType: rows[0]!.addOnType } : null;
    },
    procedure: (code) => {
      const p = procMap.get(code);
      return p ? { isAddOn: p.isAddOn, allowedPlacesOfService: p.allowedPlacesOfService ?? undefined, globalDays: p.globalDays ?? undefined } : null;
    },
    diagnosis: (code) => {
      const d = dxMap.get(code);
      // Unknown codes are treated as valid when the code table is not loaded, so an
      // empty reference database does not block every claim.
      if (!d) return dxMap.size === 0 ? { billable: true } : null;
      return { billable: d.billable, sexRestriction: d.sexRestriction ?? undefined, ageMin: d.ageMin ?? undefined, ageMax: d.ageMax ?? undefined };
    },
    medicalNecessity: (proc, dxCode) => {
      const rows = policies.filter((p) => p.procedureCode === proc);
      if (rows.length === 0) return 'no_policy';
      const hit = rows.find((p) => p.diagnosisCode === dxCode);
      return hit ? (hit.relationship === 'supports' ? 'supports' : 'does_not_support') : 'does_not_support';
    },
    placeOfService: (code) => {
      const p = posMap.get(code);
      return p ? { facilityRate: p.facilityRate } : posMap.size === 0 ? { facilityRate: false } : null;
    },
  };
}

/** Tenant rules in scope for this claim: active, and bound to nothing that excludes it. */
export async function loadTenantRules(ctx: CommandContext, a: ClaimAssembly): Promise<{ tenantRules: TenantRule[]; disabledSystemRules: Set<string> }> {
  const rules = await ctx.tx
    .select({ rule: schema.rules, version: schema.ruleVersions })
    .from(schema.rules)
    .innerJoin(schema.ruleVersions, eq(schema.ruleVersions.id, schema.rules.activeVersionId))
    .where(and(eq(schema.rules.orgId, ctx.tenant.orgId), eq(schema.rules.status, 'active')));
  const bindings = await ctx.tx.select().from(schema.ruleBindings).where(eq(schema.ruleBindings.orgId, ctx.tenant.orgId));

  const scopeValues: Record<string, string> = {
    payer: a.payer.id,
    practice: a.practice.id,
    provider: a.renderingProvider.id,
    claim_type: a.claim.type,
    place_of_service: a.encounter.placeOfService,
  };

  const applies = (ruleId: string): { enabled: boolean; severity?: Severity } => {
    const mine = bindings.filter((b) => b.ruleId === ruleId);
    if (mine.length === 0) return { enabled: true };
    // A rule with bindings applies only where a binding matches; a matching binding
    // with enabled=false switches it off for that scope.
    const byType = new Map<string, typeof mine>();
    for (const b of mine) byType.set(b.scopeType, [...(byType.get(b.scopeType) ?? []), b]);
    let severity: Severity | undefined;
    for (const [type, list] of byType) {
      const match = list.find((b) => b.scopeValue === scopeValues[type]);
      if (!match) return { enabled: false };
      if (!match.enabled) return { enabled: false };
      if (match.severityOverride) severity = match.severityOverride as Severity;
    }
    return { enabled: true, severity };
  };

  const tenantRules: TenantRule[] = [];
  const disabledSystemRules = new Set<string>();
  for (const { rule, version } of rules) {
    const decision = applies(rule.id);
    if (rule.isSystem) {
      if (!decision.enabled) disabledSystemRules.add(rule.key);
      continue;
    }
    if (!decision.enabled) continue;
    try {
      validateRule(version.definition);
    } catch {
      continue; // A corrupt definition must never block claims; it is surfaced in the rules UI.
    }
    tenantRules.push({ key: rule.key, name: rule.name, severity: decision.severity ?? rule.severity, definition: version.definition as RuleDefinition, source: 'tenant' });
  }
  return { tenantRules, disabledSystemRules };
}

export interface ScrubOutcome {
  claimId: string;
  status: 'ready' | 'needs_review';
  errorCount: number;
  warningCount: number;
  findings: Array<{ ruleKey: string; severity: Severity; message: string; path?: string; lineNumber?: number }>;
}

/** Scrub a claim, persist findings, and move it to `ready` or `needs_review`. */
export async function scrubClaimCommand(ctx: CommandContext, claimId: string): Promise<ScrubOutcome> {
  const a = await loadClaimAssembly(ctx, claimId);
  const facts = assembleClaimFacts(a, todayIso(ctx));
  const ref = await loadReferenceData(ctx, a);
  const { tenantRules, disabledSystemRules } = await loadTenantRules(ctx, a);
  const result = scrubClaim(facts, ref, { tenantRules, disabledSystemRules });

  // Replace open findings for the current version.
  await ctx.tx.update(schema.ruleFindings).set({ status: 'obsolete' }).where(and(eq(schema.ruleFindings.claimId, claimId), eq(schema.ruleFindings.status, 'open')));

  const ruleRows = await ctx.tx.select({ id: schema.rules.id, key: schema.rules.key, activeVersionId: schema.rules.activeVersionId }).from(schema.rules).where(eq(schema.rules.orgId, ctx.tenant.orgId));
  const ruleByKey = new Map(ruleRows.map((r) => [r.key, r]));

  if (result.findings.length) {
    await ctx.tx.insert(schema.ruleFindings).values(
      result.findings.map((f) => {
        const rule = ruleByKey.get(f.ruleKey);
        const lineId = f.lineNumber ? a.lines.find((l) => l.lineNumber === f.lineNumber)?.id : undefined;
        return {
          orgId: ctx.tenant.orgId,
          claimId,
          serviceLineId: lineId ?? null,
          // System rules that are not materialised as rows get a stable synthetic id.
          ruleId: rule?.id ?? '00000000-0000-4000-8000-000000000000',
          ruleVersionId: rule?.activeVersionId ?? '00000000-0000-4000-8000-000000000000',
          severity: f.severity,
          message: f.message,
          path: f.path ?? null,
          suggestedFix: f.suggestedFix ?? null,
          evidence: { ...f.evidence, ruleKey: f.ruleKey, ruleName: f.ruleName, source: f.source },
        };
      }),
    );
  }

  const current = a.claim.status;
  if (current === 'draft' || current === 'rejected' || current === 'needs_review' || current === 'ready') {
    await transitionClaim(ctx, claimId, 'scrubbing', ctx.actor ? 'user' : 'system');
  }
  const next = result.clean ? 'ready' : 'needs_review';
  await transitionClaim(ctx, claimId, next, ctx.actor ? 'user' : 'system', `${result.errorCount} errors, ${result.warningCount} warnings`);
  await emit(ctx, result.clean ? 'claim.ready' : 'claim.scrubbed', 'claim', claimId, { claimNumber: a.claim.claimNumber, errorCount: result.errorCount, warningCount: result.warningCount });

  return {
    claimId,
    status: next,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    findings: result.findings.map((f) => ({ ruleKey: f.ruleKey, severity: f.severity, message: f.message, path: f.path, lineNumber: f.lineNumber })),
  };
}
