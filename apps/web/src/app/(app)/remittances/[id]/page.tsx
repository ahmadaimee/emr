import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, schema, sql } from '@grove/db';
import { Card, Code, Empty, Money, PageHeader, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { PostButton } from './post-button';

export default async function RemittanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { run } = await pageContext();

  const data = await run(`/remittances/${id}`, async (ctx, phi) => {
    const [remit] = await ctx.tx
      .select()
      .from(schema.remittances)
      .where(eq(schema.remittances.id, id));

    if (!remit) return null;

    const claims = await ctx.tx
      .select({
        rc: schema.remittanceClaims,
        claimNumber: schema.claims.claimNumber,
        patientId: schema.claims.patientId,
        patientFirst: schema.patients.firstName,
        patientLast: schema.patients.lastName,
      })
      .from(schema.remittanceClaims)
      .leftJoin(schema.claims, eq(schema.claims.id, schema.remittanceClaims.claimId))
      .leftJoin(schema.patients, eq(schema.patients.id, schema.claims.patientId))
      .where(eq(schema.remittanceClaims.remittanceId, id));

    const patientIds = claims.map((c) => c.patientId).filter(Boolean) as string[];
    if (patientIds.length > 0) {
      phi.touch(patientIds, ['financial'], patientIds.length);
    }

    const claimIds = claims.map((c) => c.rc.id);
    let adjustments: Array<typeof schema.remittanceAdjustments.$inferSelect> = [];
    if (claimIds.length > 0) {
      adjustments = await ctx.tx
        .select()
        .from(schema.remittanceAdjustments)
        .where(sql`${schema.remittanceAdjustments.remittanceClaimId} in ${claimIds}`);
    }

    const plb = await ctx.tx
      .select()
      .from(schema.providerLevelAdjustments)
      .where(eq(schema.providerLevelAdjustments.remittanceId, id));

    return { remit, claims, adjustments, plb };
  });

  if (!data) notFound();
  const { remit, claims, adjustments, plb } = data;

  const isBalanced = remit.balanceVarianceCents === 0;

  return (
    <>
      <div className="mb-2 text-xs text-ink-3">
        <Link href="/remittances" className="hover:underline">
          Remittances
        </Link>{' '}
        / {remit.traceNumber || remit.id.slice(0, 8)}
      </div>

      <PageHeader
        title={`Remittance ${remit.traceNumber ?? remit.checkNumber ?? remit.id.slice(0, 8)}`}
        subtitle={`${remit.payerName ?? 'Payer'} · Payment Date ${date(remit.paymentDate)} · ${remit.paymentMethod ?? 'ACH'}`}
        actions={
          <div className="flex items-center gap-2">
            <PostButton remittanceId={remit.id} disabled={remit.status === 'posted'} />
          </div>
        }
      />

      {/* Balancing Card */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-surface-raised p-4">
          <div className="text-xs uppercase text-ink-3">Total Paid (BPR)</div>
          <div className="mt-1 text-xl font-semibold g-num text-ink">
            <Money cents={remit.totalPaidCents} />
          </div>
          <div className="mt-1 text-xs text-ink-3">From payer check/EFT</div>
        </div>

        <div className="rounded-lg border border-line bg-surface-raised p-4">
          <div className="text-xs uppercase text-ink-3">Claims Sum (CLP)</div>
          <div className="mt-1 text-xl font-semibold g-num text-ink">
            <Money cents={remit.computedClaimTotalCents} />
          </div>
          <div className="mt-1 text-xs text-ink-3">{claims.length} claims adjudicated</div>
        </div>

        <div className="rounded-lg border border-line bg-surface-raised p-4">
          <div className="text-xs uppercase text-ink-3">Provider Adjustments (PLB)</div>
          <div className="mt-1 text-xl font-semibold g-num text-ink">
            <Money cents={remit.providerAdjustmentTotalCents} />
          </div>
          <div className="mt-1 text-xs text-ink-3">{plb.length} adjustments</div>
        </div>

        <div className="rounded-lg border border-line bg-surface-raised p-4">
          <div className="text-xs uppercase text-ink-3">Balance Variance</div>
          <div className="mt-1 text-xl font-semibold g-num">
            <Money cents={remit.balanceVarianceCents} variance />
          </div>
          <div className="mt-1 text-xs">
            <StatusPill status={remit.status} />
          </div>
        </div>
      </div>

      {/* Claims list */}
      <Card title={`Adjudicated Claims (${claims.length})`}>
        {claims.length === 0 ? (
          <Empty title="No claims in this remittance" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                <tr>
                  <th className="px-3 py-2">Claim # / Control #</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2 text-right">Billed</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-right">Patient Resp</th>
                  <th className="px-3 py-2">Adjustments (CAS)</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {claims.map(({ rc, claimNumber, patientFirst, patientLast }) => {
                  const claimAdjs = adjustments.filter((a) => a.remittanceClaimId === rc.id);
                  return (
                    <tr key={rc.id} className="hover:bg-surface-sunken/40">
                      <td className="px-3 py-2.5">
                        {rc.claimId ? (
                          <Link
                            href={`/claims/${rc.claimId}`}
                            className="font-medium text-grove-strong hover:underline"
                          >
                            {claimNumber ?? rc.patientControlNumber}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs">{rc.patientControlNumber}</span>
                        )}
                        {rc.payerClaimControlNumber ? (
                          <div className="text-[11px] text-ink-3">
                            Payer CCN: {rc.payerClaimControlNumber}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        {patientLast && patientFirst ? (
                          <span>{patientLast}, {patientFirst}</span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right g-num">
                        <Money cents={rc.totalChargeCents} />
                      </td>
                      <td className="px-3 py-2.5 text-right g-num font-medium">
                        <Money cents={rc.totalPaidCents} />
                      </td>
                      <td className="px-3 py-2.5 text-right g-num">
                        <Money cents={rc.patientResponsibilityCents} />
                      </td>
                      <td className="px-3 py-2.5">
                        {claimAdjs.length === 0 ? (
                          <span className="text-xs text-ink-3">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {claimAdjs.map((adj) => (
                              <span
                                key={adj.id}
                                className={`rounded px-1.5 py-0.5 text-[11px] font-mono ${
                                  adj.groupCode === 'PR'
                                    ? 'bg-clay-soft text-clay'
                                    : adj.groupCode === 'CO'
                                    ? 'bg-surface-sunken text-ink-2'
                                    : 'bg-warn-soft text-warn'
                                }`}
                                title={`${adj.reasonDescription ?? ''} (${adj.groupCode}-${adj.reasonCode})`}
                              >
                                {adj.groupCode}-{adj.reasonCode}: <Money cents={adj.amountCents} />
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-mono uppercase text-ink-2">
                          CLP-{rc.claimStatusCode}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Provider-level adjustments if present */}
      {plb.length > 0 ? (
        <div className="mt-6">
          <Card title="Provider-Level Adjustments (PLB)">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                <tr>
                  <th className="px-3 py-2">Provider ID</th>
                  <th className="px-3 py-2">Fiscal Period</th>
                  <th className="px-3 py-2">Reason Code</th>
                  <th className="px-3 py-2">Identifier</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plb.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-mono text-xs">{p.providerIdentifier || '—'}</td>
                    <td className="px-3 py-2 text-xs">{date(p.fiscalPeriodDate)}</td>
                    <td className="px-3 py-2 font-mono text-xs font-medium">{p.adjustmentReasonCode}</td>
                    <td className="px-3 py-2 text-xs text-ink-3">{p.adjustmentIdentifier || '—'}</td>
                    <td className="px-3 py-2 text-right g-num font-medium">
                      <Money cents={p.adjustmentAmountCents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ) : null}
    </>
  );
}
