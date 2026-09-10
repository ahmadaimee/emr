import { desc, eq, schema } from '@grove/db';
import { Card, Code, Empty, Kpi, Money, PageHeader, Severity, StatusPill } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { getMockDenialRulesData } from '@/lib/mock-data';
import { NewDenialRuleModal } from './new-denial-rule-modal';

export const metadata = { title: 'Rules Engine & Auto-Denial Fixation' };

const SYSTEM_RULES = [
  {
    key: 'sys.ncci.ptp',
    name: 'NCCI Procedure-to-Procedure (PTP) Bundling',
    category: 'ncci_ptp',
    severity: 'error',
    description: 'Enforces CMS NCCI edits. Modifier indicator 0 cannot be unbundled. Indicator 1 requires qualifying bypass modifier (59, XE, XP, XS, XU, 25).',
    isSystem: true,
  },
  {
    key: 'sys.mue.units',
    name: 'Medically Unlikely Edits (MUE) Unit Limits',
    category: 'mue',
    severity: 'error',
    description: 'Enforces maximum allowable units of service per CPT/HCPCS code based on CMS MAI 1 (line), 2 (absolute date-of-service), and 3 (clinical date-of-service).',
    isSystem: true,
  },
  {
    key: 'sys.add_on.primary_required',
    name: 'Add-On Code Primary Procedure Requirement',
    category: 'coding',
    severity: 'error',
    description: 'Add-on codes (+ symbols) cannot be billed alone; asserts presence of the designated primary procedure on the same date of service.',
    isSystem: true,
  },
  {
    key: 'sys.provider.valid_npi',
    name: 'Luhn-10 NPI Check Digit Validation',
    category: 'provider',
    severity: 'error',
    description: 'Validates 10-digit National Provider Identifier (NPI) against the ISO/IEC 7812-1 Luhn algorithm with 80840 prefix.',
    isSystem: true,
  },
  {
    key: 'sys.claim.timely_filing',
    name: 'Payer Timely Filing Deadline Warning',
    category: 'timely_filing',
    severity: 'warning',
    description: 'Warns when an unsubmitted claim is within 14 days of the statutory timely filing deadline calculated from the date of service and payer contract.',
    isSystem: true,
  },
  {
    key: 'sys.claim.diagnosis_pointers',
    name: 'Numeric ICD-10 Diagnosis Pointers (SV107)',
    category: 'coding',
    severity: 'error',
    description: 'Asserts all service lines carry valid numeric pointers (1-12) to existing ICD-10 codes in the claim diagnosis header.',
    isSystem: true,
  },
];

export default async function RulesSettingsPage() {
  const { run } = await pageContext();

  const customRules = await run('/settings/rules', async (ctx) => {
    return ctx.tx
      .select()
      .from(schema.rules)
      .orderBy(desc(schema.rules.createdAt))
      .limit(50);
  });

  const { rules: denialRules } = getMockDenialRulesData();

  const totalFixesApplied = denialRules.reduce((sum, r) => sum + (r.fixesAppliedCount || 0), 0);
  const totalRecoveredCents = denialRules.reduce((sum, r) => sum + (r.recoveredDollarsCents || 0), 0);

  return (
    <>
      <PageHeader
        title="Rules Engine & Autonomous Denial Fixation"
        subtitle="Transparent claim scrubbing and intelligent denial auto-correction rules. System rules run pre-submission; auto-denial bots execute post-835 adjudication."
        actions={<NewDenialRuleModal />}
      />

      {/* Autonomous Engine KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 mb-6">
        <Kpi
          variant="primary"
          label="Denial Revenue Recovered"
          value={<Money cents={totalRecoveredCents} />}
          hint="Type 7 replacement collections"
          tone="ok"
          badge="Auto-Fix"
        />
        <Kpi
          variant="secondary"
          label="Auto-Fixes Executed"
          value={totalFixesApplied}
          hint="Claims auto-corrected"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Active Denial Rules"
          value={denialRules.length}
          hint="Targeting CARC/RARC"
        />
        <Kpi
          variant="secondary"
          label="Auto-Submit Policy"
          value="100% Enabled"
          hint="Instant clearinghouse release"
          tone="ok"
        />
      </div>

      {/* SECTION 1: AUTONOMOUS DENIAL FIXATION ENGINE */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">
              ⚡ Autonomous Denial Fixation Rules (Auto-Submit & ICN Auto-Attach)
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">
              Rules execute automatically upon 835 remittance ingestion. Matched claims auto-attach original ICN numbers, set Frequency Code 7, and re-transmit to clearinghouse.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
              <tr>
                <th className="px-3 py-2 w-36">Rule Code</th>
                <th className="px-3 py-2">Rule Name & Strategy</th>
                <th className="px-3 py-2 w-36">Trigger CARC / RARC</th>
                <th className="px-3 py-2 w-32">Auto-Attach ICN</th>
                <th className="px-3 py-2 w-32">Auto-Submit</th>
                <th className="px-3 py-2 text-right w-36">Recovered</th>
                <th className="px-3 py-2 w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              {denialRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-surface-sunken/40 font-sans">
                  <td className="px-3 py-3 align-top font-mono font-bold text-grove-strong">
                    {rule.code}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-ink text-sm">{rule.name}</div>
                    <div className="mt-1 text-ink-3 leading-relaxed">{rule.description}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-2 border border-line">
                        Target CPT: {rule.targetCpt}
                      </span>
                      <span className="text-[11px] text-ink-4">
                        {rule.fixesAppliedCount} fixes applied
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-mono font-bold text-danger">{rule.triggerCarc}</div>
                    {rule.triggerRarc ? (
                      <div className="font-mono text-[11px] text-ink-3">RARC: {rule.triggerRarc}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {rule.autoAttachOriginalIcn ? (
                      <span className="inline-flex items-center gap-1 text-ok font-semibold">
                        <span>✓</span>
                        <span>REF*F8 / Box 22</span>
                      </span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {rule.autoSubmitCorrectedClaim ? (
                      <span className="rounded bg-ok-soft px-1.5 py-0.5 text-[11px] font-bold text-ok">
                        Instant 837P
                      </span>
                    ) : (
                      <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-ink-3">
                        Queue Review
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top text-right font-mono font-bold text-ink">
                    <Money cents={rule.recoveredDollarsCents} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <StatusPill status={rule.enabled ? 'active' : 'inactive'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: SYSTEM RULE PACKS */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wider mb-3">
          Pre-Submission Scrubber Rule Packs (CMS, NCCI, HIPAA 5010)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
              <tr>
                <th className="px-3 py-2 w-36">Severity</th>
                <th className="px-3 py-2">Rule Name & Logic</th>
                <th className="px-3 py-2 w-44">Category</th>
                <th className="px-3 py-2 w-32">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SYSTEM_RULES.map((rule) => (
                <tr key={rule.key} className="hover:bg-surface-sunken/40">
                  <td className="px-3 py-3 align-top">
                    <Severity severity={rule.severity} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-ink">{rule.name}</div>
                    <div className="mt-1 text-xs text-ink-3 leading-relaxed">{rule.description}</div>
                    <div className="mt-2 font-mono text-[11px] text-ink-4">{rule.key}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-xs text-ink-2 font-mono">
                    {rule.category}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span className="rounded bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-3">
                      Built-in System Pack
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: PRACTICE CUSTOM RULES (AST) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">
            Practice Custom Rules (AST Engine)
          </h2>
        </div>

        {customRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-8 text-center bg-surface-raised">
            <h3 className="font-medium text-ink">No custom AST rules configured</h3>
            <p className="mt-1 text-xs text-ink-3 max-w-md mx-auto">
              Custom rules allow defining practice- or payer-specific scrubbing criteria as an abstract syntax tree (AST) that can be backtested against historical claims.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                <tr>
                  <th className="px-3 py-2">Rule Name</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customRules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2.5 font-medium">{r.name}</td>
                    <td className="px-3 py-2.5 text-xs font-mono">{r.category}</td>
                    <td className="px-3 py-2.5">
                      <Severity severity={r.severity} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
