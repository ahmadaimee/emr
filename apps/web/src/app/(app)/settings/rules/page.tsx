import { desc, eq, schema } from '@grove/db';
import { Card, Code, Empty, PageHeader, Severity, StatusPill } from '@/components/ui';
import { pageContext } from '@/lib/session';

export const metadata = { title: 'Rules Engine & Claim Scrubber' };

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

  return (
    <>
      <PageHeader
        title="Rules Engine & Claim Scrubber"
        subtitle="Transparent, testable rules executed against every claim before submission. System rule packs load alongside tenant custom edits."
      />

      <div className="mb-8">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wider mb-3">
          System Rule Packs (CMS, NCCI, HIPAA 5010)
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

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">
            Practice Custom Rules (AST)
          </h2>
        </div>

        {customRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-8 text-center bg-surface-raised">
            <h3 className="font-medium text-ink">No custom rules configured</h3>
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
