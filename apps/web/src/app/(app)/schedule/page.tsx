import Link from 'next/link';
import { schema, sql } from '@grove/db';
import { Card, Empty, Kpi, Money, PageHeader } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { APPOINTMENT_TYPES } from '@/lib/schedule';
import { loadScheduleDay } from '@/lib/schedule-queries';
import { NewAppointmentModal } from './new-appointment-modal';
import { DayBook } from './day-book';

export const metadata = { title: 'Scheduling' };

const STATUS_TONE: Record<string, string> = {
  completed: 'bg-ok-soft text-ok border-ok/25',
  in_room: 'bg-grove-soft text-grove-strong border-grove-line',
  checked_in: 'bg-info-soft text-info border-info/25',
  scheduled: 'bg-surface-sunken text-ink-2 border-line',
  no_show: 'bg-danger-soft text-danger border-danger/25',
  cancelled: 'bg-surface-sunken text-ink-4 border-line',
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed',
  in_room: 'In room',
  checked_in: 'Checked in',
  scheduled: 'Scheduled',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};

function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function dayLabel(iso: string, offset: number) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === -1) return 'Yesterday';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; provider?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view ?? 'book';
  const { run } = await pageContext();

  const qs = new URLSearchParams();
  if (sp.date) qs.set('date', sp.date);
  if (sp.provider) qs.set('provider', sp.provider);
  const route = qs.toString() ? `/schedule?${qs}` : '/schedule';

  const requestedDate = sp.date || new Date().toISOString().slice(0, 10);

  const data: any = await run(route, async (ctx) => {
    const day = await loadScheduleDay(ctx, { date: requestedDate, providerId: sp.provider });
    const patientRows = await ctx.tx
      .select({ id: schema.patients.id, firstName: schema.patients.firstName, lastName: schema.patients.lastName, mrn: schema.patients.mrn })
      .from(schema.patients)
      .where(sql`${schema.patients.mergedIntoPatientId} is null`)
      .orderBy(schema.patients.lastName)
      .limit(500);
    return {
      patients: patientRows.map((p) => ({ id: p.id, name: `${p.lastName}, ${p.firstName}`, mrn: p.mrn })),
      date: requestedDate,
      isToday: requestedDate === new Date().toISOString().slice(0, 10),
      dates: [-1, 0, 1, 2, 3].map((o) => {
        const d = new Date();
        d.setDate(d.getDate() + o);
        return { value: d.toISOString().slice(0, 10), offset: o };
      }),
      providers: day.providers,
      totals: day.totals,
      allProviders: day.allProviders,
      appointmentTypes: APPOINTMENT_TYPES,
    };
  });

  const providers: any[] = data.providers ?? [];
  const totals = data.totals ?? {};
  const dates: any[] = data.dates ?? [];
  const utilBps = totals.capacityMinutes > 0 ? Math.round((10000 * totals.bookedMinutes) / totals.capacityMinutes) : 0;

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { date: sp.date, provider: sp.provider, view: sp.view, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return p.toString() ? `/schedule?${p}` : '/schedule';
  };

  return (
    <>
      <PageHeader
        title="Scheduling"
        subtitle="Appointment book, provider availability, and open clinic time across every practice."
        actions={<NewAppointmentModal providers={data.allProviders ?? []} types={data.appointmentTypes ?? []} patients={data.patients ?? []} date={data.date} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi variant="primary" label="Appointments" value={totals.appointments ?? 0} hint={`${totals.completed ?? 0} completed · ${totals.remaining ?? 0} to come`} badge="Book" />
        <Kpi label="Open clinic time" value={hours(totals.freeMinutes ?? 0)} hint="Bookable gaps, lunch excluded" tone={(totals.freeMinutes ?? 0) > 240 ? 'warn' : 'ok'} />
        <Kpi label="Utilisation" value={`${(utilBps / 100).toFixed(0)}%`} hint={`${hours(totals.bookedMinutes ?? 0)} of ${hours(totals.capacityMinutes ?? 0)}`} />
        <Kpi label="No-shows" value={totals.noShows ?? 0} hint="Rebook or bill per policy" tone={(totals.noShows ?? 0) > 0 ? 'danger' : 'ok'} />
        <Kpi label="Expected copays" value={<Money cents={totals.expectedCopayCents ?? 0} />} hint={`${totals.eligibilityIssues ?? 0} need eligibility`} tone={(totals.eligibilityIssues ?? 0) > 0 ? 'warn' : 'ok'} />
      </div>

      {/* Day selector */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {dates.map((d: any) => {
          const active = d.value === data.date;
          return (
            <Link
              key={d.value}
              href={link({ date: d.value })}
              className={`rounded-md border px-3 py-1.5 text-sm ${active ? 'border-grove bg-grove-soft font-medium text-grove-strong' : 'border-line text-ink-2 hover:bg-surface-sunken'}`}
            >
              {dayLabel(d.value, d.offset)}
            </Link>
          );
        })}
        <span className="ml-1 text-xs text-ink-4">{data.date}</span>

        <div className="ml-auto flex items-center gap-1">
          {[
            { k: 'book', label: 'Day book' },
            { k: 'providers', label: 'Provider availability' },
          ].map((t) => (
            <Link
              key={t.k}
              href={link({ view: t.k })}
              className={`rounded-md px-3 py-1.5 text-sm ${view === t.k ? 'bg-surface-sunken font-medium text-ink' : 'text-ink-3 hover:bg-surface-sunken'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Provider filter */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Link href={link({ provider: undefined })} className={`rounded-md border px-2.5 py-1 text-xs ${!sp.provider ? 'border-grove bg-grove-soft text-grove-strong' : 'border-line text-ink-3 hover:bg-surface-sunken'}`}>
          All providers
        </Link>
        {(data.allProviders ?? []).map((p: any) => (
          <Link
            key={p.id}
            href={link({ provider: p.id })}
            className={`rounded-md border px-2.5 py-1 text-xs ${sp.provider === p.id ? 'border-grove bg-grove-soft text-grove-strong' : 'border-line text-ink-3 hover:bg-surface-sunken'}`}
          >
            {p.name}, {p.credentials}
          </Link>
        ))}
      </div>

      {providers.length === 0 ? (
        <div className="mt-4">
          <Empty title="Nothing on the book" body="No provider is scheduled for this day." />
        </div>
      ) : view === 'providers' ? (
        <ProviderAvailability providers={providers} />
      ) : (
        <div className="mt-4">
          <DayBook providers={providers} statusTone={STATUS_TONE} statusLabel={STATUS_LABEL} />
        </div>
      )}
    </>
  );
}

function ProviderAvailability({ providers }: { providers: any[] }) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      {providers.map((p) => {
        const util = p.utilizationBps / 100;
        const tone = util >= 85 ? 'bg-danger' : util >= 60 ? 'bg-grove' : 'bg-warn';
        return (
          <Card key={p.providerId} title={`${p.providerName}, ${p.credentials}`}>
            <div className="px-4 pb-4 pt-1">
              <div className="text-xs text-ink-3">
                {p.specialty} · {p.room}
              </div>
              <div className="mt-0.5 text-xs text-ink-4">
                {p.hoursLabel} · lunch {p.lunchLabel} · NPI <span className="g-mono">{p.npi}</span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums">{p.total}</span>
                <span className="text-xs text-ink-3">appointments</span>
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, util)}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-ink-3">
                <span>{util.toFixed(0)}% booked</span>
                <span>{hours(p.freeMinutes)} free</span>
              </div>

              <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3 text-center">
                {[
                  ['Done', p.completed, 'text-ok'],
                  ['Now', p.checkedIn + p.inRoom, 'text-grove-strong'],
                  ['Left', p.remaining, 'text-ink'],
                  ['No-show', p.noShows, p.noShows > 0 ? 'text-danger' : 'text-ink-4'],
                ].map(([label, value, cls]) => (
                  <div key={String(label)}>
                    <dd className={`text-sm font-semibold tabular-nums ${cls}`}>{value as number}</dd>
                    <dt className="text-[11px] text-ink-4">{label as string}</dt>
                  </div>
                ))}
              </dl>

              <div className="mt-3 border-t border-line pt-3">
                <div className="text-xs font-medium text-ink-2">Open slots</div>
                {p.freeSlots.length === 0 ? (
                  <div className="mt-1 text-xs text-ink-4">Fully booked — no bookable gap today.</div>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {p.freeSlots.map((s: any) => (
                      <li key={s.start} className="flex items-center justify-between rounded-md bg-surface-sunken px-2 py-1 text-xs">
                        <span className="g-mono text-ink-2">
                          {s.startLabel} – {s.endLabel}
                        </span>
                        <span className="text-ink-4">{hours(s.minutes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
                <span className="text-ink-3">Expected copays</span>
                <span className="font-medium">
                  <Money cents={p.expectedCopayCents} />
                </span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
