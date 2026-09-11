import Link from 'next/link';
import { desc, schema, sql } from '@grove/db';
import { Card, Kpi, Money, PageHeader, StatusPill } from '@/components/ui';
import { bps, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { loadScheduleDay } from '@/lib/schedule-queries';

export const metadata = { title: 'Dashboard' };

/**
 * Only some activity subjects have their own detail page. Where one doesn't exist yet
 * (a coverage, a denial, a custom-status edit), land on the closest real list view
 * instead of guessing a route that 404s.
 */
function activityHref(subjectType: string, subjectId: string): string | null {
  switch (subjectType) {
    case 'claim':
      return `/claims/${subjectId}`;
    case 'patient':
      return `/patients/${subjectId}`;
    case 'remittance':
      return `/remittances/${subjectId}`;
    case 'eligibility_batch':
      return '/eligibility';
    case 'statement':
      return '/statements';
    case 'claim_custom_status':
      return '/settings/claim-statuses';
    case 'denial':
      return '/queues?category=denial';
    default:
      return null;
  }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ recovery?: string }> }) {
  const { recovery } = await searchParams;
  const { run } = await pageContext();

  // The schedule snapshot and the KPI/queue snapshot are independent reads — run them
  // in parallel instead of paying for two round-trips back to back.
  const [today, data] = await Promise.all([
    run('/dashboard/today-schedule', async (ctx) => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const day = await loadScheduleDay(ctx, { date: todayIso });
      return {
        date: todayIso,
        providers: day.providers.map((p: any) => ({
          providerId: p.providerId,
          providerName: p.providerName,
          credentials: p.credentials,
          room: p.room,
          total: p.total,
          completed: p.completed,
          remaining: p.remaining,
          noShows: p.noShows,
          freeMinutes: p.freeMinutes,
          utilizationBps: p.utilizationBps,
          nextFree: p.freeSlots[0] ?? null,
          next: p.appointments.find((a: any) => a.status === 'scheduled' || a.status === 'checked_in' || a.status === 'in_room') ?? null,
        })),
        totals: day.totals,
      };
    }),

    run('/dashboard', async (ctx) => {
      const [[ar], queues, activity, [auto], [spend], risk] = await Promise.all([
        ctx.tx.execute<{ total: string; over90: string; patient: string; open_claims: string; denied_30: string; adjudicated_30: string; clean: string; submitted_30: string; charges_90: string }>(sql`
          select coalesce(sum(balance_cents) filter (where status not in ('paid','closed','voided')), 0)::text as total,
                 coalesce(sum(balance_cents) filter (where status not in ('paid','closed','voided') and current_date - service_date_from > 90), 0)::text as over90,
                 coalesce(sum(patient_responsibility_cents) filter (where status not in ('closed','voided')), 0)::text as patient,
                 count(*) filter (where status not in ('paid','closed','voided'))::text as open_claims,
                 count(*) filter (where status = 'denied' and created_at > now() - interval '30 days')::text as denied_30,
                 count(*) filter (where status in ('paid','partially_paid','denied','closed') and created_at > now() - interval '30 days')::text as adjudicated_30,
                 count(*) filter (where status in ('acknowledged','in_process','paid','partially_paid') and submitted_at > now() - interval '30 days' and not exists (select 1 from claim_submissions s where s.claim_id = claims.id and s.attempt_number > 1))::text as clean,
                 count(*) filter (where submitted_at > now() - interval '30 days')::text as submitted_30,
                 coalesce(sum(total_charge_cents) filter (where service_date_from > current_date - 90), 0)::text as charges_90
            from claims
        `),
        ctx.tx.execute<{ key: string; name: string; category: string; open: string; urgent: string; amount: string }>(sql`
          select q.key, q.name, q.category, count(t.id)::text as open, count(t.id) filter (where t.priority in ('high','urgent'))::text as urgent,
                 coalesce(sum(coalesce((t.detail->>'deniedCents')::bigint, (t.detail->>'underpaymentCents')::bigint, (t.detail->>'remainingCents')::bigint, 0)), 0)::text as amount
            from work_queues q left join tasks t on t.work_queue_id = q.id and t.status in ('open','in_progress')
           where q.active group by q.key, q.name, q.category order by count(t.id) desc
        `),
        ctx.tx.select().from(schema.activityEvents).orderBy(desc(schema.activityEvents.occurredAt)).limit(12),
        ctx.tx.select().from(schema.automationSettings).where(sql`practice_id is null`),
        ctx.tx.select({ cents: sql<number>`coalesce(sum(cost_cents),0)::bigint`, calls: sql<number>`count(*)::int` }).from(schema.externalCalls).where(sql`started_at >= date_trunc('day', now())`),
        ctx.tx.select({ n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(balance_cents),0)::bigint` }).from(schema.claims).where(sql`timely_filing_deadline <= current_date + 14 and status not in ('paid','closed','voided','submitted','acknowledged','in_process')`),
      ]);
      return { ar: ar!, queues, activity, auto, spend: spend!, risk: risk[0]! };
    }),
  ]);

  const total = Number(data.ar.total);
  const over90 = Number(data.ar.over90);
  const daysInAr = Number(data.ar.charges_90) > 0 ? Math.round(total / (Number(data.ar.charges_90) / 90)) : 0;
  const denialRate = Number(data.ar.adjudicated_30) > 0 ? Math.round((10000 * Number(data.ar.denied_30)) / Number(data.ar.adjudicated_30)) : null;
  const cleanRate = Number(data.ar.submitted_30) > 0 ? Math.round((10000 * Number(data.ar.clean)) / Number(data.ar.submitted_30)) : null;

  return (
    <>
      {recovery ? <RecoveryBanner codes={recovery.split(',')} /> : null}
      {data.auto?.globalPaused ? (
        <div className="mb-4 flex items-center justify-between rounded-md border border-warn/30 bg-warn-soft px-4 py-2.5 text-sm text-warn">
          <span>Automation is paused{data.auto.pausedReason ? `: ${data.auto.pausedReason}` : ''}. Eligibility, status checks and secondary claims are not running.</span>
          <Link href="/settings/automation" className="font-medium underline">Review</Link>
        </div>
      ) : data.auto?.dryRun ? (
        <div className="mb-4 flex items-center justify-between rounded-md border border-info/20 bg-info-soft px-4 py-2.5 text-sm text-info">
          <span>Automation is in dry-run. Jobs are evaluated and logged but take no action. Switch it on when the mock results look right.</span>
          <Link href="/settings/automation" className="font-medium underline">Automation settings</Link>
        </div>
      ) : null}

      <PageHeader title="Dashboard" subtitle={`${Number(data.spend.calls)} automated payer calls today · ${(Number(data.spend.cents) / 100).toFixed(2)} spent`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          variant="primary"
          label="Total A/R"
          value={<Money cents={total} />}
          hint={`${data.ar.open_claims} open claims`}
          badge="Core KPI"
        />
        <Kpi
          variant="secondary"
          label="A/R over 90 days"
          value={<Money cents={over90} />}
          hint={total > 0 ? `${Math.round((100 * over90) / total)}% of total` : undefined}
          tone={total > 0 && over90 / total > 0.25 ? 'danger' : undefined}
        />
        <Kpi
          variant="secondary"
          label="Days in A/R"
          value={daysInAr || '—'}
          hint="Trailing 90-day charges"
          tone={daysInAr > 45 ? 'warn' : undefined}
        />
        <Kpi
          variant="secondary"
          label="Denial rate"
          value={bps(denialRate)}
          hint="Last 30 days"
          tone={denialRate !== null && denialRate > 1000 ? 'danger' : undefined}
        />
        <Kpi
          variant="secondary"
          label="Clean claim rate"
          value={bps(cleanRate)}
          hint="First submission accepted"
          tone={cleanRate !== null && cleanRate < 9000 ? 'warn' : undefined}
        />
        <Kpi
          variant="secondary"
          label="Timely filing at risk"
          value={<Money cents={Number(data.risk.cents)} />}
          hint={`${data.risk.n} claims within 14 days`}
          tone={Number(data.risk.n) > 0 ? 'danger' : 'ok'}
        />
      </div>

      <TodaySchedule today={today} />

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title="Work queues">
            <table className="g-table">
              <thead>
                <tr><th>Queue</th><th className="text-right">Open</th><th className="text-right">High priority</th><th className="text-right">Dollars</th></tr>
              </thead>
              <tbody>
                {data.queues.map((q) => (
                  <tr key={q.key}>
                    <td><Link href={`/queues?category=${q.category}`} className="font-medium hover:underline">{q.name}</Link></td>
                    <td data-numeric>{Number(q.open) === 0 ? <span className="text-ink-4">0</span> : q.open}</td>
                    <td data-numeric>{Number(q.urgent) > 0 ? <span className="text-danger">{q.urgent}</span> : <span className="text-ink-4">0</span>}</td>
                    <td data-numeric><Money cents={Number(q.amount) || null} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card title="Activity">
            <ul className="divide-y divide-line">
              {data.activity.length === 0 ? <li className="px-4 py-6 text-sm text-ink-3">Nothing yet. Activity from people and automation appears here.</li> : null}
              {data.activity.map((a) => {
                const href = activityHref(a.subjectType, a.subjectId);
                const pill = <StatusPill status={a.verb.split('.')[1] ?? a.verb} />;
                return (
                  <li key={a.id} className="px-4 py-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-medium">{a.actorType === 'system' ? 'PracticeOS' : a.actorLabel ?? 'Someone'}</span> <span className="text-ink-2">{a.summary}</span>
                      </div>
                      <span className="shrink-0 text-xs text-ink-4">{relative(a.occurredAt)}</span>
                    </div>
                    {href ? (
                      <Link href={href} className="text-xs text-ink-3 hover:underline">
                        {pill}
                      </Link>
                    ) : (
                      <span className="text-xs text-ink-3">{pill}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function TodaySchedule({ today }: { today: any }) {
  const providers: any[] = today?.providers ?? [];
  if (providers.length === 0) return null;
  const totals = today.totals ?? {};
  const free = (m: number) => {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r === 0 ? `${h}h` : h === 0 ? `${r}m` : `${h}h ${r}m`;
  };

  return (
    <div className="mt-5">
      <Card
        title="Today's schedule"
        actions={
          <Link href="/schedule" className="text-xs font-medium text-grove-strong hover:underline">
            Open scheduling
          </Link>
        }
      >
        <div className="border-b border-line px-4 py-2 text-xs text-ink-3">
          {totals.appointments} appointments · {totals.completed} completed · {totals.remaining} to come ·{' '}
          {free(totals.freeMinutes ?? 0)} open clinic time
          {totals.noShows > 0 ? <span className="text-danger"> · {totals.noShows} no-show</span> : null}
        </div>
        <table className="g-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th className="text-right">Appts</th>
              <th className="text-right">Done</th>
              <th className="text-right">Left</th>
              <th className="text-right">Free</th>
              <th>Next open slot</th>
              <th>Next patient</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.providerId}>
                <td>
                  <Link href={`/schedule?provider=${p.providerId}`} className="font-medium hover:underline">
                    {p.providerName}
                  </Link>
                  <span className="ml-1 text-xs text-ink-4">{p.room}</span>
                </td>
                <td data-numeric>{p.total}</td>
                <td data-numeric><span className="text-ink-3">{p.completed}</span></td>
                <td data-numeric>{p.remaining}</td>
                <td data-numeric>
                  <span className={p.freeMinutes >= 120 ? 'text-warn' : 'text-ink-3'}>{free(p.freeMinutes)}</span>
                </td>
                <td className="text-xs">
                  {p.nextFree ? (
                    <span className="g-mono text-ink-2">
                      {p.nextFree.startLabel} – {p.nextFree.endLabel}
                    </span>
                  ) : (
                    <span className="text-ink-4">Fully booked</span>
                  )}
                </td>
                <td className="text-xs">
                  {p.next ? (
                    <>
                      <span className="g-mono text-ink-3">{p.next.startLabel}</span>{' '}
                      <span className="text-ink-2">{p.next.patientName}</span>
                    </>
                  ) : (
                    <span className="text-ink-4">Day complete</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function RecoveryBanner({ codes }: { codes: string[] }) {
  return (
    <div className="mb-4 rounded-lg border border-grove-line bg-grove-soft p-4">
      <div className="font-medium text-grove-strong">Save your recovery codes</div>
      <p className="mt-1 text-sm text-ink-2">Each code works once if you lose your authenticator. They are shown only now.</p>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-5">{codes.map((c) => <span key={c}>{c}</span>)}</div>
      <Link href="/dashboard" className="mt-3 inline-block text-sm font-medium text-grove-strong underline">I have saved these</Link>
    </div>
  );
}
