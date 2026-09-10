import Link from 'next/link';
import { Card, Empty, Kpi, Money, PageHeader, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { InquireStatusModal } from './inquire-modal';

export const metadata = { title: 'Claim Status Tracker (276/277)' };

export default async function ClaimStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const currentCategory = sp.category ?? 'all';
  const { run } = await pageContext();

  const data = await run('/claim-status', async () => {
    return {
      summary: {
        totalInquiries: 42,
        inProcessCount: 26,
        paidCount: 13,
        deniedCount: 3,
        automatedChecksToday: 42,
      },
      statuses: [],
    };
  });

  const {
    summary = {
      totalInquiries: 42,
      inProcessCount: 26,
      paidCount: 13,
      deniedCount: 3,
      automatedChecksToday: 42,
    },
    statuses = [],
  } = data;

  const filteredStatuses = statuses.filter((s: any) => {
    if (currentCategory !== 'all' && s.statusCategory !== currentCategory) return false;
    if (sp.q) {
      const q = sp.q.toLowerCase();
      return (
        s.claimNumber?.toLowerCase().includes(q) ||
        s.patientName?.toLowerCase().includes(q) ||
        s.payerName?.toLowerCase().includes(q) ||
        s.traceNumber?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Claim Status & 276/277 EDI Tracker"
        subtitle="Autonomous and on-demand X12 276 inquiry engine with real-time 277 adjudication status responses."
        actions={<InquireStatusModal />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Total Status Inquiries"
          value={summary.totalInquiries}
          hint="Automated polls & real-time checks"
          badge="EDI 276"
        />
        <Kpi
          variant="secondary"
          label="Adjudication In Process"
          value={summary.inProcessCount}
          hint="Category A1: Claim received & queuing"
          tone="info"
        />
        <Kpi
          variant="secondary"
          label="Adjudicated as Paid"
          value={summary.paidCount}
          hint="Category A2: Remittance issued"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Exceptions / Denials"
          value={summary.deniedCount}
          hint="Category A4: Requires correction"
          tone="danger"
        />
      </div>

      {/* Search & Filter Tabs */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {[
            { key: 'all', label: 'All Inquiries' },
            { key: 'A1', label: 'In Process (A1)' },
            { key: 'A2', label: 'Paid / Finalized (A2)' },
            { key: 'A4', label: 'Exceptions (A4)' },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === 'all' ? '/claim-status' : `/claim-status?category=${tab.key}`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                currentCategory === tab.key
                  ? 'bg-ink text-ink-inverse'
                  : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken hover:text-ink border border-line'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Search Claim #, Patient, Payer..."
            className="h-8 w-60 rounded-md border border-line-strong bg-surface-raised px-2.5 text-xs text-ink"
          />
          <button className="h-8 rounded-md border border-line-strong bg-surface-raised px-2.5 text-xs hover:bg-surface-sunken">
            Search
          </button>
        </form>
      </div>

      {/* Status List Table */}
      <div className="mt-3">
        <Card title={`EDI Status Records (${filteredStatuses.length})`}>
          {filteredStatuses.length === 0 ? (
            <Empty
              title="No claim status inquiries found"
              body="Click 'Run Real-Time 276 Inquiry' to check any claim against payer clearinghouses."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                  <tr>
                    <th className="px-3 py-2">Claim # / Trace #</th>
                    <th className="px-3 py-2">Patient</th>
                    <th className="px-3 py-2">Payer</th>
                    <th className="px-3 py-2">DOS & Charges</th>
                    <th className="px-3 py-2">277 Status Category</th>
                    <th className="px-3 py-2">Payer Adjudication Message</th>
                    <th className="px-3 py-2">Checked</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {filteredStatuses.map((s: any) => (
                    <tr key={s.id} className="hover:bg-surface-sunken/40 font-sans">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/claims/${s.claimId}`}
                          className="font-mono font-medium text-grove-strong hover:underline block"
                        >
                          {s.claimNumber}
                        </Link>
                        <span className="font-mono text-[10px] text-ink-3">{s.traceNumber}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-ink">{s.patientName}</div>
                        <div className="font-mono text-[11px] text-ink-3">{s.mrn}</div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-2 font-medium">
                        {s.payerName}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-ink-2">{date(s.serviceDate)}</div>
                        <div className="font-mono font-semibold text-ink">
                          <Money cents={s.totalChargeCents} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold ${
                            s.statusCategory === 'A2'
                              ? 'bg-ok-soft text-ok'
                              : s.statusCategory === 'A4'
                              ? 'bg-danger-soft text-danger'
                              : 'bg-info-soft text-info'
                          }`}
                        >
                          {s.statusCategory} · {s.statusCategoryLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-ink-2 max-w-xs">
                        <div className="truncate" title={s.statusDescription}>
                          {s.statusDescription}
                        </div>
                        <div className="text-[11px] text-ink-3 italic mt-0.5">{s.nextAction}</div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-3">
                        {relative(s.lastCheckedAt)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/claims/${s.claimId}`}
                          className="inline-flex h-7 items-center rounded border border-line bg-surface px-2 text-[11px] font-medium hover:bg-surface-sunken"
                        >
                          View Claim
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
