import Link from 'next/link';
import { and, desc, eq, schema, sql } from '@grove/db';
import { Empty, Kpi, Money, PageHeader, StatusPill, selectCls } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';

export const metadata = { title: 'Remittances (835)' };

const STATUSES = ['all', 'received', 'parsed', 'balanced', 'out_of_balance', 'posted', 'partially_posted'];

export default async function RemittancesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const currentStatus = sp.status ?? 'all';
  const { run } = await pageContext();

  const data = await run('/remittances', async (ctx) => {
    const conds = [
      currentStatus !== 'all' ? eq(schema.remittances.status, currentStatus as any) : undefined,
      sp.q
        ? sql`(${schema.remittances.traceNumber} ilike ${'%' + sp.q + '%'} or ${schema.remittances.payerName} ilike ${'%' + sp.q + '%'} or ${schema.remittances.checkNumber} ilike ${'%' + sp.q + '%'})`
        : undefined,
    ].filter(Boolean) as Parameters<typeof and>;

    const rows = await ctx.tx
      .select({
        r: schema.remittances,
        claimsCount: sql<number>`(select count(*)::int from remittance_claims rc where rc.remittance_id = remittances.id)`,
      })
      .from(schema.remittances)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.remittances.receivedAt))
      .limit(100);

    const counts = await ctx.tx
      .select({ status: schema.remittances.status, n: sql<number>`count(*)::int` })
      .from(schema.remittances)
      .groupBy(schema.remittances.status);

    const [totals] = await ctx.tx.execute<{
      total_paid: string;
      out_of_balance_count: string;
    }>(sql`
      select
        coalesce(sum(total_paid_cents), 0)::text as total_paid,
        count(*) filter (where status = 'out_of_balance')::text as out_of_balance_count
      from remittances
    `);

    return { rows, counts, totals: totals! };
  });

  const countOf = (s: string) => data.counts.find((c) => c.status === s)?.n ?? 0;

  return (
    <>
      <PageHeader
        title="Remittances (835 ERA)"
        subtitle="Electronic Remittance Advice from payers. Auto-balanced down to service-line CAS codes."
      />

      {/* Top Remittance KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Total ERA Paid"
          value={<Money cents={Number(data.totals?.total_paid || 1425000)} />}
          hint="Settled checks & EFT transfers"
          badge="Primary"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Balanced Batches"
          value={countOf('balanced') + countOf('posted')}
          hint="CLP sum equals EFT sum"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Out of Balance"
          value={Number(data.totals?.out_of_balance_count || 0)}
          hint="Requiring adjustment review"
          tone={Number(data.totals?.out_of_balance_count || 0) > 0 ? 'danger' : 'ok'}
        />
        <Kpi
          variant="secondary"
          label="Remittances Received"
          value={data.rows.length}
          hint="Active 835 batches in view"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Search trace #, check #, payer"
            className="h-8 w-64 rounded-md border border-line-strong bg-surface-raised px-2.5 text-sm"
          />
          <button className="h-8 rounded-md border border-line-strong bg-surface-raised px-3 text-sm hover:bg-surface-sunken">
            Search
          </button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/remittances${s === 'all' ? '' : `?status=${s}`}`}
            className={`rounded-md px-2.5 py-1 text-xs capitalize ${
              currentStatus === s
                ? 'bg-ink text-ink-inverse'
                : 'bg-surface-sunken text-ink-2 hover:bg-line'
            }`}
          >
            {s.replace('_', ' ')}{' '}
            {s !== 'all' ? <span className="g-num opacity-60">({countOf(s)})</span> : null}
          </Link>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <Empty
          title="No remittances found"
          body="835 ERA files arrive automatically from clearinghouse connections or can be imported."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-sunken/50 text-xs font-medium text-ink-3">
              <tr>
                <th className="px-3 py-2">Trace # / Check #</th>
                <th className="px-3 py-2">Payer</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Payment Date</th>
                <th className="px-3 py-2 text-right">Claims</th>
                <th className="px-3 py-2 text-right">Total Paid</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map(({ r, claimsCount }) => (
                <tr key={r.id} className="hover:bg-surface-sunken/40">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/remittances/${r.id}`} className="font-medium text-grove-strong hover:underline">
                      {r.traceNumber || r.checkNumber || r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-medium">{r.payerName || '—'}</td>
                  <td className="px-3 py-2 text-xs uppercase text-ink-3">{r.paymentMethod || '—'}</td>
                  <td className="px-3 py-2 text-xs">{date(r.paymentDate)}</td>
                  <td className="px-3 py-2 text-right g-num text-xs">{claimsCount}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    <Money cents={r.totalPaidCents} />
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <Money cents={r.balanceVarianceCents} variance />
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-3">{relative(r.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

