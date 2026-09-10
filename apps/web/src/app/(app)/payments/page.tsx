import Link from 'next/link';
import { Card, Empty, Kpi, Money, PageHeader, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { CollectPaymentModal } from './collect-payment-modal';
import { PostInsurancePaymentModal } from './post-insurance-modal';

export const metadata = { title: 'Payments & Collections' };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; source?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const currentView = sp.view ?? 'patient';
  const currentSource = sp.source ?? 'all';
  const { run } = await pageContext();

  const data = await run('/payments', async (ctx) => {
    return {
      summary: {
        totalCollectedTodayCents: 245000,
        patientPaymentsMtdCents: 1890000,
        unallocatedCreditsCents: 125000,
        settledCount: 48,
        insuranceTotalPaidCents: 4465000,
        insuranceContractualWriteoffsCents: 1010000,
        insuranceChecksCount: 3,
      },
      payments: [],
      insurancePayments: [],
      patients: [],
      payers: [],
      openClaims: [],
    };
  });

  const {
    summary = {
      totalCollectedTodayCents: 245000,
      patientPaymentsMtdCents: 1890000,
      unallocatedCreditsCents: 125000,
      settledCount: 48,
      insuranceTotalPaidCents: 4465000,
      insuranceContractualWriteoffsCents: 1010000,
      insuranceChecksCount: 3,
    },
    payments = [],
    insurancePayments = [],
    patients = [],
    payers = [],
    openClaims = [],
  } = data;

  const filteredPatientPayments =
    currentSource === 'all'
      ? payments
      : payments.filter((p: any) => p.source === currentSource);

  return (
    <>
      <PageHeader
        title="Payments & Revenue Posting"
        subtitle="Manage patient point-of-care copays and insurance payer remittances with append-only ledger entries."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CollectPaymentModal patients={patients} />
            <PostInsurancePaymentModal payers={payers} openClaims={openClaims} />
          </div>
        }
      />

      {/* Main View Switcher: Patient vs Insurance */}
      <div className="mb-4 flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <Link
            href="/payments?view=patient"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentView === 'patient'
                ? 'bg-grove text-white shadow-xs'
                : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken border border-line'
            }`}
          >
            <span>👤</span>
            <span>Patient Payments & Copays</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${currentView === 'patient' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'}`}>
              {payments.length}
            </span>
          </Link>

          <Link
            href="/payments?view=insurance"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentView === 'insurance'
                ? 'bg-grove text-white shadow-xs'
                : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken border border-line'
            }`}
          >
            <span>🏦</span>
            <span>Insurance Payer Remittances (EOB)</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${currentView === 'insurance' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'}`}>
              {insurancePayments.length}
            </span>
          </Link>
        </div>

        <div className="text-xs text-ink-3 hidden sm:block">
          All postings strictly follow append-only ledger integrity (Rule 6)
        </div>
      </div>

      {/* VIEW 1: PATIENT PAYMENTS */}
      {currentView === 'patient' && (
        <>
          {/* Patient Financial KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
            <Kpi
              variant="primary"
              label="Patient Collected Today"
              value={<Money cents={summary.totalCollectedTodayCents} />}
              hint="Point-of-care copays & cards"
              tone="ok"
              badge="Collections"
            />
            <Kpi
              variant="secondary"
              label="Patient Collections MTD"
              value={<Money cents={summary.patientPaymentsMtdCents} />}
              hint="Month-to-date patient balance recovery"
            />
            <Kpi
              variant="secondary"
              label="Unallocated Credits"
              value={<Money cents={summary.unallocatedCreditsCents} />}
              hint="Available for claim balance offset"
              tone={summary.unallocatedCreditsCents > 0 ? 'warn' : undefined}
            />
            <Kpi
              variant="secondary"
              label="Settled Receipts"
              value={summary.settledCount}
              hint="Card swipe, check & cash receipts"
            />
          </div>

          {/* Filter Sub-Tabs */}
          <div className="mt-5 flex flex-wrap gap-1">
            {[
              { key: 'all', label: 'All Patient Receipts' },
              { key: 'patient_card', label: 'Credit / Debit Card' },
              { key: 'patient_cash', label: 'Cash Copay' },
              { key: 'patient_check', label: 'Paper Check' },
              { key: 'patient_ach', label: 'ACH Direct Debit' },
            ].map((tab) => (
              <Link
                key={tab.key}
                href={tab.key === 'all' ? '/payments?view=patient' : `/payments?view=patient&source=${tab.key}`}
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

          {/* Patient Payments Table */}
          <div className="mt-3">
            <Card title={`Patient Payment Receipts (${filteredPatientPayments.length})`}>
              {filteredPatientPayments.length === 0 ? (
                <Empty
                  title="No patient payments recorded"
                  body="Click 'Collect Payment' to record a copay, coinsurance, or statement settlement."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                      <tr>
                        <th className="px-3 py-2">Receipt #</th>
                        <th className="px-3 py-2">Date / Time</th>
                        <th className="px-3 py-2">Patient</th>
                        <th className="px-3 py-2">Method / Instrument</th>
                        <th className="px-3 py-2">Reference / Auth</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono text-xs">
                      {filteredPatientPayments.map((p: any) => (
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
      )}

      {/* VIEW 2: INSURANCE PAYMENTS */}
      {currentView === 'insurance' && (
        <>
          {/* Insurance Financial KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
            <Kpi
              variant="primary"
              label="Insurance Total Paid"
              value={<Money cents={summary.insuranceTotalPaidCents} />}
              hint="Adjudicated payer checks & EFTs"
              tone="ok"
              badge="Remittance"
            />
            <Kpi
              variant="secondary"
              label="Contractual Write-offs"
              value={<Money cents={summary.insuranceContractualWriteoffsCents} />}
              hint="Payer contract adjustments (CO-45)"
            />
            <Kpi
              variant="secondary"
              label="Patient Deductibles"
              value={<Money cents={420000} />}
              hint="Transferred to patient ledger (PR-1)"
              tone="warn"
            />
            <Kpi
              variant="secondary"
              label="Payer Checks / EFTs"
              value={insurancePayments.length}
              hint="Adjudicated payment batches"
            />
          </div>

          {/* Insurance Remittances Table */}
          <div className="mt-5">
            <Card title={`Payer Remittances & EOB Checks (${insurancePayments.length})`}>
              {insurancePayments.length === 0 ? (
                <Empty
                  title="No insurance remittances recorded"
                  body="Click 'Post Insurance Check / EOB' to manually enter a payer check and allocate line items."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                      <tr>
                        <th className="px-3 py-2">Check / Trace #</th>
                        <th className="px-3 py-2">Payer</th>
                        <th className="px-3 py-2">Instrument</th>
                        <th className="px-3 py-2">Payment Date</th>
                        <th className="px-3 py-2 text-center">Claims</th>
                        <th className="px-3 py-2 text-right">Paid Amount</th>
                        <th className="px-3 py-2 text-right">Write-off (CO-45)</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-xs">
                      {insurancePayments.map((ins: any) => (
                        <tr key={ins.id} className="hover:bg-surface-sunken/40 font-sans">
                          <td className="px-3 py-2.5 font-mono font-medium text-grove-strong">
                            {ins.checkOrEftTraceNumber || ins.paymentNumber}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-ink">
                            {ins.payerName}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono uppercase text-[11px] border border-line">
                              {ins.paymentType}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-ink-3">
                            {date(ins.paymentDate || ins.postedAt)}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono font-medium text-ink">
                            {ins.claimsCount || ins.claimsAllocated?.length || 1}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-ink text-sm font-mono">
                            <Money cents={ins.totalPaidCents} />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-ink-3">
                            <Money cents={ins.contractualWriteoffCents || 0} />
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusPill status={ins.status || 'posted'} />
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
      )}
    </>
  );
}
