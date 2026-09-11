import Link from 'next/link';
import { desc, eq, schema, sql } from '@grove/db';
import { Card, Empty, Kpi, Money, PageHeader, StatusPill } from '@/components/ui';
import { bps, date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { CheckModal } from './check-modal';

export const metadata = { title: 'Eligibility Verification (270/271)' };

export default async function EligibilityPage() {
  const { run } = await pageContext();

  const data = await run('/eligibility', async (ctx, phi) => {
    // 1. Fetch recent checks
    const checks = await ctx.tx
      .select({
        c: schema.eligibilityChecks,
        patientFirst: schema.patients.firstName,
        patientLast: schema.patients.lastName,
        mrn: schema.patients.mrn,
        payerName: schema.payers.name,
      })
      .from(schema.eligibilityChecks)
      .innerJoin(schema.patients, eq(schema.patients.id, schema.eligibilityChecks.patientId))
      .innerJoin(schema.payers, eq(schema.payers.id, schema.eligibilityChecks.payerId))
      .orderBy(desc(schema.eligibilityChecks.requestedAt))
      .limit(50);

    phi.touch(
      checks.map((c) => c.c.patientId),
      ['demographics', 'financial'],
      checks.length
    );

    // 2. Fetch recent batches
    const batches = await ctx.tx
      .select()
      .from(schema.eligibilityBatches)
      .orderBy(desc(schema.eligibilityBatches.createdAt))
      .limit(5);

    // 3. Fetch patients and payers for the modal
    const patients = await ctx.tx
      .select({ id: schema.patients.id, first: schema.patients.firstName, last: schema.patients.lastName, mrn: schema.patients.mrn })
      .from(schema.patients)
      .limit(100);

    const payers = await ctx.tx
      .select({ id: schema.payers.id, name: schema.payers.name })
      .from(schema.payers)
      .limit(100);

    // 4. Aggregate stats
    const [stats] = await ctx.tx.execute<{
      total_checks: string;
      active_count: string;
      inactive_count: string;
    }>(sql`
      select
        count(*)::text as total_checks,
        count(*) filter (where status = 'active')::text as active_count,
        count(*) filter (where status in ('inactive', 'not_found', 'payer_error'))::text as inactive_count
      from eligibility_checks
    `);

    return {
      checks,
      batches,
      patients: patients.map((p) => ({ id: p.id, name: `${p.last}, ${p.first} (${p.mrn})` })),
      payers: payers.map((p) => ({ id: p.id, name: p.name })),
      stats: stats!,
    };
  });

  const total = Number(data.stats.total_checks);
  const activeCount = Number(data.stats.active_count);
  const activeRate = total > 0 ? Math.round((10000 * activeCount) / total) : null;

  return (
    <>
      <PageHeader
        title="Eligibility Verification (270 / 271)"
        subtitle="Real-time 270/271 benefit inquiries and schedule batch verification."
        actions={<CheckModal patients={data.patients} payers={data.payers} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Total Inquiries Run"
          value={total}
          hint="Batch & real-time checks"
          badge="EDI 270/271"
        />
        <Kpi
          variant="secondary"
          label="Active Coverage Rate"
          value={bps(activeRate)}
          tone={activeRate !== null && activeRate >= 9000 ? 'ok' : 'warn'}
          hint={`${activeCount} confirmed active`}
        />
        <Kpi
          variant="secondary"
          label="Coverage Exceptions"
          value={data.stats.inactive_count}
          tone={Number(data.stats.inactive_count) > 0 ? 'danger' : 'ok'}
          hint="Inactive or not found"
        />
        <Kpi
          variant="secondary"
          label="Schedule Batches"
          value={data.batches.length}
          hint="Nightly schedule sweeps"
        />
      </div>

      {/* Batch Runs */}
      {data.batches.length > 0 ? (
        <div className="mb-6">
          <Card title="Recent Batch Verification Runs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                  <tr>
                    <th className="px-3 py-2">Batch Name</th>
                    <th className="px-3 py-2">Population</th>
                    <th className="px-3 py-2 text-right">Inquiries</th>
                    <th className="px-3 py-2 text-right text-ok">Active</th>
                    <th className="px-3 py-2 text-right text-danger">Exceptions</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.batches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2.5 font-medium">{b.name}</td>
                      <td className="px-3 py-2.5 text-xs text-ink-3 capitalize">{b.sourceType.replace('_', ' ')}</td>
                      <td className="px-3 py-2.5 text-right g-num">{b.totalCount ?? 0}</td>
                      <td className="px-3 py-2.5 text-right g-num text-ok">{b.activeCount ?? 0}</td>
                      <td className="px-3 py-2.5 text-right g-num text-danger">{b.inactiveCount ?? 0}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={b.status} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-3">{relative(b.startedAt ?? b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Recent Checks */}
      <Card title="Individual Eligibility Checks">
        {data.checks.length === 0 ? (
          <Empty
            title="No eligibility inquiries yet"
            body="Click 'Verify Patient (270)' above or run a batch schedule check."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                <tr>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Payer</th>
                  <th className="px-3 py-2">Service Type</th>
                  <th className="px-3 py-2">Coverage Status</th>
                  <th className="px-3 py-2">Trigger</th>
                  <th className="px-3 py-2">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.checks.map(({ c, patientFirst, patientLast, mrn, payerName }) => (
                  <tr key={c.id} className="hover:bg-surface-sunken/40">
                    <td className="px-3 py-2.5">
                      <Link href={`/patients/${c.patientId}`} className="font-medium text-grove-strong hover:underline">
                        {patientLast}, {patientFirst}
                      </Link>
                      <div className="text-[11px] text-ink-3">MRN: {mrn}</div>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{payerName}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {c.serviceTypeCodes?.[0] === '30'
                        ? '30 — Health Benefit Plan'
                        : c.serviceTypeCodes?.[0] ?? '30'}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-3 py-2.5 text-xs capitalize text-ink-3">
                      {c.trigger.replace('_', ' ')}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink-3">
                      {relative(c.respondedAt ?? c.createdAt)}
                    </td>
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

