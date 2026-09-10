import Link from 'next/link';
import { Card, Empty, Kpi, Money, PageHeader, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { CollectPaymentModal } from './collect-payment-modal';

export const metadata = { title: 'Payments & Collections' };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const currentSource = sp.source ?? 'all';
  const { run } = await pageContext();

  const data = await run('/payments', async (ctx) => {
    // In live postgres, query paymentBatches, payments, and patient cards
    return {
      summary: {
        totalCollectedTodayCents: 245000,
        patientPaymentsMtdCents: 1890000,
        unallocatedCreditsCents: 125000,
        settledCount: 48,
      },
      payments: [],
      patients: [],
    };
  });

  const { summary, payments, patients } = data;

  const filteredPayments =
    currentSource === 'all'
      ? payments
      : payments.filter((p: any) => p.source === currentSource);

  return (
    <>
      <PageHeader
        title="Payments & Patient Collections"
        subtitle="Real-time point-of-care payments, card processing, cash copays, and append-only ledger posting."
        actions={<CollectPaymentModal patients={patients} />}
      />

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Collected Today"
          value={<Money cents={summary.totalCollectedTodayCents} />}
          hint="Point-of-care & batch settlements"
          tone="ok"
        />
        <Kpi
          label="Patient Collections MTD"
          value={<Money cents={summary.patientPaymentsMtdCents} />}
          hint="Month-to-date patient revenue"
        />
        <Kpi
          label="Unallocated Credits"
          value={<Money cents={summary.unallocatedCreditsCents} />}
          hint="Available for claim balance offset"
          tone={summary.unallocatedCreditsCents > 0 ? 'warn' : undefined}
        />
        <Kpi
          label="Settled Transactions"
          value={summary.settledCount}
          hint="All active gateway batches"
        />
      </div>

      {/* Filter Tabs */}
      <div className="mt-5 flex flex-wrap gap-1">
        {[
          { key: 'all', label: 'All Payments' },
          { key: 'patient_card', label: 'Credit / Debit Card' },
          { key: 'patient_cash', label: 'Cash Copay' },
          { key: 'patient_check', label: 'Paper Check' },
          { key: 'patient_ach', label: 'ACH Direct Debit' },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? '/payments' : `/payments?source=${tab.key}`}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              currentSource === tab.key
                ? 'bg-ink text-ink-inverse'
                : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken hover:text-ink border border-line'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Payments Table */}
      <div className="mt-3">
        <Card title={`Transactions (${filteredPayments.length})`}>
          {filteredPayments.length === 0 ? (
            <Empty
              title="No payments recorded"
              body="Click 'Collect Payment' to record a patient payment, copay, or balance settlement."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                  <tr>
                    <th className="px-3 py-2">Payment #</th>
                    <th className="px-3 py-2">Date / Time</th>
                    <th className="px-3 py-2">Patient</th>
                    <th className="px-3 py-2">Method / Source</th>
                    <th className="px-3 py-2">Reference / Auth</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-xs">
                  {filteredPayments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-surface-sunken/40 font-sans">
                      <td className="px-3 py-2.5 font-mono font-medium text-grove-strong">
                        {p.paymentNumber}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-3">
                        {date(p.postedAt)} <span className="opacity-60 font-mono text-[11px]">{relative(p.postedAt)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={`/patients/${p.patientId}`} className="font-medium text-ink hover:underline">
                          {p.patientName}
                        </Link>
                        <div className="text-[11px] text-ink-3 font-mono">MRN: {p.mrn}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-2">
                        <span className="inline-flex items-center gap-1.5 rounded-sm bg-surface-sunken px-1.5 py-0.5 border border-line">
                          {p.method}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-ink-3">
                        {p.referenceNumber}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-ink text-sm">
                        <Money cents={p.amountCents} />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={p.status} />
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
