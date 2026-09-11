import Link from 'next/link';
import { desc, eq, schema, sql } from '@grove/db';
import { Card, Empty, Kpi, Money, PageHeader, StatusPill } from '@/components/ui';
import { date } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { GenerateRunModal } from './generate-run-modal';
import { SendStatementsBar } from './send-statements-bar';

export const metadata = { title: 'Patient Statements' };

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const currentStatus = sp.status ?? 'all';
  const { run } = await pageContext();

  const data = await run('/statements', async (ctx) => {
    const practices = await ctx.tx.select({ id: schema.practices.id, name: schema.practices.name }).from(schema.practices).orderBy(schema.practices.name);

    const rows = await ctx.tx
      .select({
        id: schema.patientStatements.id,
        statementNumber: schema.patientStatements.statementNumber,
        cycleNumber: schema.patientStatements.cycleNumber,
        statementDate: schema.patientStatements.statementDate,
        dueDate: schema.patientStatements.dueDate,
        balanceDueCents: schema.patientStatements.balanceDueCents,
        status: schema.patientStatements.status,
        sentAt: schema.patientStatements.sentAt,
        viewedAt: schema.patientStatements.viewedAt,
        paidAt: schema.patientStatements.paidAt,
        patientId: schema.patientStatements.patientId,
        patientFirst: schema.patients.firstName,
        patientLast: schema.patients.lastName,
        mrn: schema.patients.mrn,
      })
      .from(schema.patientStatements)
      .innerJoin(schema.patients, eq(schema.patients.id, schema.patientStatements.patientId))
      .where(currentStatus !== 'all' ? eq(schema.patientStatements.status, currentStatus as typeof schema.patientStatements.$inferSelect.status) : undefined)
      .orderBy(desc(schema.patientStatements.statementDate))
      .limit(300);

    const [summary] = await ctx.tx.execute<{ outstanding_cents: string; draft_count: string; sent_count: string; paid_count: string }>(sql`
      select
        coalesce(sum(balance_due_cents) filter (where status not in ('paid','void')), 0)::text as outstanding_cents,
        count(*) filter (where status = 'draft')::text as draft_count,
        count(*) filter (where status in ('sent','delivered','viewed'))::text as sent_count,
        count(*) filter (where status = 'paid')::text as paid_count
      from patient_statements
    `);

    return { practices, rows, summary: summary! };
  });

  const { practices = [], rows = [], summary } = data;

  return (
    <>
      <PageHeader
        title="Patient Statements"
        subtitle="Generate a statement run from each patient's ledger balance, then send. A pay-link token is minted per statement once sent."
        actions={<GenerateRunModal practices={practices} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi variant="primary" label="Outstanding on Statements" value={<Money cents={Number(summary?.outstanding_cents ?? 0)} />} tone={Number(summary?.outstanding_cents ?? 0) > 0 ? 'warn' : 'ok'} badge="Statements" />
        <Kpi variant="secondary" label="Draft — Not Yet Sent" value={Number(summary?.draft_count ?? 0)} hint="Review before sending" />
        <Kpi variant="secondary" label="Sent / Awaiting Payment" value={Number(summary?.sent_count ?? 0)} />
        <Kpi variant="secondary" label="Paid" value={Number(summary?.paid_count ?? 0)} tone="ok" />
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {['all', 'draft', 'sent', 'viewed', 'paid'].map((s) => (
          <Link
            key={s}
            href={s === 'all' ? '/statements' : `/statements?status=${s}`}
            className={`rounded-md px-2.5 py-1 text-xs capitalize ${currentStatus === s ? 'bg-ink text-ink-inverse' : 'bg-surface-sunken text-ink-2 hover:bg-line'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <Card>
        {rows.length === 0 ? (
          <Empty title="No statements found" body="Click 'Generate Statement Run' to build statements from current patient balances." />
        ) : (
          <>
            <SendStatementsBar draftIds={rows.filter((r) => r.status === 'draft').map((r) => r.id)} />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                  <tr>
                    <th className="px-3 py-2"></th>
                    <th className="px-3 py-2">Statement #</th>
                    <th className="px-3 py-2">Patient</th>
                    <th className="px-3 py-2 text-center">Cycle</th>
                    <th className="px-3 py-2">Date / Due</th>
                    <th className="px-3 py-2 text-right">Balance Due</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-sunken/40">
                      <td className="px-3 py-2">
                        {r.status === 'draft' && <input type="checkbox" name="stmt" value={r.id} className="rounded border-line-strong" />}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-grove-strong">{r.statementNumber}</td>
                      <td className="px-3 py-2 text-xs">
                        <Link href={`/patients/${r.patientId}`} className="font-medium text-ink hover:underline">{r.patientLast}, {r.patientFirst}</Link>
                        <div className="text-[11px] text-ink-3">MRN: {r.mrn}</div>
                      </td>
                      <td className="px-3 py-2 text-center g-num text-xs">{r.cycleNumber}</td>
                      <td className="px-3 py-2 text-xs text-ink-3">{date(r.statementDate)} → {date(r.dueDate)}</td>
                      <td className="px-3 py-2 text-right font-medium text-sm"><Money cents={r.balanceDueCents} /></td>
                      <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
