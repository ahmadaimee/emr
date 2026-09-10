import Link from 'next/link';
import { Card, Empty, Kpi, Money, PageHeader, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { CreateBatchModal } from './create-batch-modal';

export const metadata = { title: 'EDI & Transmission Batches' };

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const currentType = sp.type ?? 'all';
  const { run } = await pageContext();

  const data = await run('/batches', async () => {
    return {
      summary: {
        totalBatchesToday: 6,
        openClaimBatches: 1,
        settledPaymentCents: 342000,
        totalAdjudicatedCents: 1425000,
        eligibilityVerifiedCount: 68,
      },
      batches: [],
    };
  });

  const {
    summary = {
      totalBatchesToday: 6,
      openClaimBatches: 1,
      settledPaymentCents: 342000,
      totalAdjudicatedCents: 1425000,
      eligibilityVerifiedCount: 68,
    },
    batches = [],
  } = data;

  const filteredBatches =
    currentType === 'all'
      ? batches
      : batches.filter((b: any) => b.type === currentType);

  return (
    <>
      <PageHeader
        title="Batch Management Hub"
        subtitle="Manage end-to-end EDI interchange lifecycle for 837P claim submissions, 835 payment remittances, and 270 eligibility sweeps."
        actions={<CreateBatchModal />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Total Batches Processed"
          value={summary.totalBatchesToday}
          hint="Envelopes verified today"
          badge="EDI Hub"
        />
        <Kpi
          variant="secondary"
          label="Ready Claim Batches"
          value={summary.openClaimBatches}
          hint="Scrubbed 100% clean — Pending transmission"
          tone={summary.openClaimBatches > 0 ? 'warn' : undefined}
        />
        <Kpi
          variant="secondary"
          label="Settled Gateway Batches"
          value={<Money cents={summary.settledPaymentCents} />}
          hint="Merchant card swipe & copay settlements"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Eligibility Swept"
          value={summary.eligibilityVerifiedCount}
          hint="270 inquiries processed in schedule batch"
          tone="info"
        />
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-1">
        {[
          { key: 'all', label: 'All Batches' },
          { key: 'claims_837p', label: '837P Claim Batches' },
          { key: 'payments', label: 'Payment & Remittance Batches' },
          { key: 'eligibility_270', label: '270 Eligibility Batches' },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? '/batches' : `/batches?type=${tab.key}`}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              currentType === tab.key
                ? 'bg-ink text-ink-inverse'
                : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken hover:text-ink border border-line'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Batches Table */}
      <div className="mt-3">
        <Card title={`Batches (${filteredBatches.length})`}>
          {filteredBatches.length === 0 ? (
            <Empty
              title="No batches found"
              body="Click 'Create EDI Batch' to generate a claim interchange or trigger an eligibility sweep."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                  <tr>
                    <th className="px-3 py-2">Batch Number</th>
                    <th className="px-3 py-2">Type / Protocol</th>
                    <th className="px-3 py-2">Practice / Target</th>
                    <th className="px-3 py-2 text-center">Items</th>
                    <th className="px-3 py-2 text-right">Batch Value</th>
                    <th className="px-3 py-2">Clearinghouse Transmission</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {filteredBatches.map((b: any) => (
                    <tr key={b.id} className="hover:bg-surface-sunken/40 font-sans">
                      <td className="px-3 py-2.5 font-mono font-semibold text-grove-strong">
                        {b.batchNumber}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono uppercase text-[11px] border border-line">
                          {b.type === 'claims_837p' ? '837P Professional' : b.type === 'payments' ? '835 Remittance' : '270 Eligibility'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-ink-2 font-medium">
                        {b.practiceName}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-semibold text-ink">
                        {b.itemCount}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium text-ink">
                        {b.totalAmountCents > 0 ? <Money cents={b.totalAmountCents} /> : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-ink-2 max-w-xs truncate" title={b.clearinghouseStatus}>
                        {b.clearinghouseStatus}
                      </td>
                      <td className="px-3 py-2.5 text-ink-3">
                        {relative(b.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={b.status} />
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
