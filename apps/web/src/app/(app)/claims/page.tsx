import Link from 'next/link';
import { and, desc, eq, schema, sql } from '@grove/db';
import { Empty, Money, PageHeader, StatusPill, selectCls } from '@/components/ui';
import { STATUS_LABEL, date } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { BulkSubmit } from './bulk-submit';

export const metadata = { title: 'Claims' };

const STATUSES = ['needs_review', 'ready', 'submitted', 'acknowledged', 'rejected', 'in_process', 'denied', 'partially_paid', 'secondary_ready', 'paid', 'patient_responsibility'];

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; practice?: string }> }) {
  const sp = await searchParams;
  const { run } = await pageContext();

  const { rows, counts, practices } = await run('/claims', async (ctx, phi) => {
    const conds = [
      sp.status ? eq(schema.claims.status, sp.status as typeof schema.claims.$inferSelect.status) : undefined,
      sp.practice ? eq(schema.claims.practiceId, sp.practice) : undefined,
      sp.q ? sql`(claim_number ilike ${'%' + sp.q + '%'} or payer_claim_control_number ilike ${'%' + sp.q + '%'})` : undefined,
    ].filter(Boolean) as Parameters<typeof and>;
    const rows = await ctx.tx
      .select({ c: schema.claims, patientLast: schema.patients.lastName, patientFirst: schema.patients.firstName, payer: schema.payers.name, practice: schema.practices.name, errors: sql<number>`(select count(*)::int from rule_findings f where f.claim_id = claims.id and f.status = 'open' and f.severity = 'error')` })
      .from(schema.claims)
      .innerJoin(schema.patients, eq(schema.patients.id, schema.claims.patientId))
      .innerJoin(schema.payers, eq(schema.payers.id, schema.claims.payerId))
      .innerJoin(schema.practices, eq(schema.practices.id, schema.claims.practiceId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.claims.createdAt))
      .limit(200);
    phi.touch(rows.map((r) => r.c.patientId), ['demographics', 'financial'], rows.length);
    const counts = await ctx.tx.select({ status: schema.claims.status, n: sql<number>`count(*)::int` }).from(schema.claims).groupBy(schema.claims.status);
    const practices = await ctx.tx.select({ id: schema.practices.id, name: schema.practices.name }).from(schema.practices).orderBy(schema.practices.name);
    return { rows, counts, practices };
  });
  const countOf = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  return (
    <>
      <PageHeader title="Claims" subtitle={`${rows.length}${rows.length === 200 ? '+' : ''} shown`} actions={<BulkSubmit />} />
      <form className="mb-3 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Claim # or payer control #" className="h-8 w-56 rounded-md border border-line-strong bg-surface-raised px-2.5 text-sm" />
        <select name="practice" defaultValue={sp.practice ?? ''} className={`${selectCls} w-56`}>
          <option value="">All practices</option>
          {practices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="h-8 rounded-md border border-line-strong bg-surface-raised px-3 text-sm">Filter</button>
      </form>
      <div className="mb-3 flex flex-wrap gap-1">
        <Link href="/claims" className={`rounded-md px-2.5 py-1 text-xs ${!sp.status ? 'bg-ink text-ink-inverse' : 'bg-surface-sunken text-ink-2 hover:bg-line'}`}>All</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/claims?status=${s}`} className={`rounded-md px-2.5 py-1 text-xs ${sp.status === s ? 'bg-ink text-ink-inverse' : 'bg-surface-sunken text-ink-2 hover:bg-line'}`}>
            {STATUS_LABEL[s]} <span className="g-num opacity-60">{countOf(s)}</span>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty title="No claims match" body="Claims are created from encounters. Try a different status or clear the search." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="g-table" data-bulk>
            <thead>
              <tr><th className="w-8"></th><th>Claim</th><th>Patient</th><th>Payer</th><th>Practice</th><th>DOS</th><th>Status</th><th className="text-right">Charge</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Filing deadline</th></tr>
            </thead>
            <tbody>
              {rows.map(({ c, patientLast, patientFirst, payer, practice, errors }) => {
                const deadlineSoon = c.timelyFilingDeadline && !['paid', 'closed', 'voided'].includes(c.status) && Date.parse(c.timelyFilingDeadline) - Date.now() < 14 * 86_400_000;
                return (
                  <tr key={c.id} tabIndex={0}>
                    <td><input type="checkbox" name="claim" value={c.id} data-status={c.status} className="accent-[var(--g-grove-500)]" aria-label={`Select ${c.claimNumber}`} /></td>
                    <td><Link href={`/claims/${c.id}`} className="g-mono font-medium hover:underline">{c.claimNumber}</Link>{errors > 0 ? <span className="ml-2 rounded-sm bg-danger-soft px-1 text-[10px] font-semibold text-danger">{errors}</span> : null}</td>
                    <td>{patientLast}, {patientFirst}</td>
                    <td className="text-ink-2">{payer}</td>
                    <td className="text-ink-2">{practice}</td>
                    <td className="text-ink-2">{date(c.serviceDateFrom)}</td>
                    <td><StatusPill status={c.status} /></td>
                    <td data-type="money"><Money cents={c.totalChargeCents} /></td>
                    <td data-type="money"><Money cents={c.totalPaidCents} /></td>
                    <td data-type="money"><Money cents={c.balanceCents} /></td>
                    <td className={deadlineSoon ? 'font-medium text-danger' : 'text-ink-3'}>{date(c.timelyFilingDeadline)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
