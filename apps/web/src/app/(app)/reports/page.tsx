import Link from 'next/link';
import { compileReport, STANDARD_REPORTS } from '@grove/reporting';
import { Card, Empty, Money, PageHeader } from '@/components/ui';
import { bps } from '@/lib/format';
import { pageContext } from '@/lib/session';

export const metadata = { title: 'Reports & Analytics' };

const REPORT_TABS: Record<string, { title: string; description: string }> = {
  ar_aging_by_payer: {
    title: 'A/R Aging by Payer',
    description: 'Outstanding insurance balance grouped by payer and aging buckets (0-30, 31-60, 61-90, 91-120, 120+).',
  },
  collections_by_month: {
    title: 'Monthly Cash Collections & NCR',
    description: 'Gross charges, payments, contractual write-offs, and net collection rate (NCR) by month.',
  },
  payer_performance: {
    title: 'Payer Turnaround & Yield',
    description: 'First-pass clean rate, denial rate, average days to pay, and total paid yield per payer.',
  },
  denials_by_category: {
    title: 'Denial Analysis by Category',
    description: 'Denied dollars, count, and overturn rate categorized by root cause (eligibility, coding, auth, timely filing).',
  },
  timely_filing_risk: {
    title: 'Timely Filing Risk',
    description: 'Claims approaching payer timely-filing statutory deadlines requiring immediate submission.',
  },
  eligibility_exceptions: {
    title: 'Eligibility Exception Rate',
    description: 'Inactive coverage and rejection rates per payer across real-time and batch inquiries.',
  },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const sp = await searchParams;
  const currentKey = sp.report && REPORT_TABS[sp.report] ? sp.report : 'ar_aging_by_payer';
  const meta = REPORT_TABS[currentKey]!;
  const queryDef = STANDARD_REPORTS[currentKey]!;

  const { run } = await pageContext();

  const data = await run('/reports', async (ctx, phi) => {
    const compiled = compileReport(queryDef);
    const rows = await ctx.tx.execute<Record<string, any>>(compiled.query);
    return { compiled, rows };
  });

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Semantic reporting layer compiled directly to parameterized SQL with tenant RLS isolation."
      />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-line pb-3">
        {Object.entries(REPORT_TABS).map(([key, item]) => {
          const active = currentKey === key;
          return (
            <Link
              key={key}
              href={`/reports?report=${key}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-ink text-ink-inverse'
                  : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken hover:text-ink'
              }`}
            >
              {item.title}
            </Link>
          );
        })}
      </div>

      <div className="mb-4">
        <h2 className="text-base font-semibold text-ink">{meta.title}</h2>
        <p className="mt-0.5 text-xs text-ink-3">{meta.description}</p>
      </div>

      <Card>
        {data.rows.length === 0 ? (
          <Empty
            title="No report data available"
            body="No records match this report's criteria in the current practice or date range."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                <tr>
                  {data.compiled.columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 ${
                        col.kind === 'measure' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-sunken/40">
                    {data.compiled.columns.map((col) => {
                      const val = row[col.key];
                      const isMoney = col.format === 'cents';
                      const isBps = col.format === 'bps';
                      const isNum = col.kind === 'measure';

                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-2.5 text-xs ${
                            isNum ? 'text-right g-num font-medium' : 'text-ink-2'
                          }`}
                        >
                          {isMoney ? (
                            <Money cents={Number(val)} />
                          ) : isBps ? (
                            bps(Number(val))
                          ) : isNum ? (
                            Number(val).toLocaleString()
                          ) : (
                            val ?? '—'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

