import Link from 'next/link';
import { Money } from '@/components/ui';

const ELIGIBILITY_TONE: Record<string, string> = {
  verified: 'text-ok',
  pending: 'text-warn',
  issue: 'text-danger',
};

const ELIGIBILITY_LABEL: Record<string, string> = {
  verified: 'Eligibility verified',
  pending: 'Eligibility pending',
  issue: 'Eligibility issue',
};

function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h ${m}m`;
}

/**
 * One column per provider, appointments in time order with the free gaps drawn
 * between them — so an operator can see at a glance who has room this afternoon.
 */
export function DayBook({
  providers,
  statusTone,
  statusLabel,
}: {
  providers: any[];
  statusTone: Record<string, string>;
  statusLabel: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-full gap-4" style={{ minWidth: `${providers.length * 300}px` }}>
        {providers.map((p) => {
          // Interleave appointments and the gaps that follow them, in clock order.
          const items = [
            ...p.appointments.map((a: any) => ({ kind: 'appt' as const, at: a.startMinutes, a })),
            ...p.freeSlots.map((s: any) => ({ kind: 'gap' as const, at: toMinutes(s.start), s })),
          ].sort((x, y) => x.at - y.at);

          return (
            <div key={p.providerId} className="flex-1" style={{ minWidth: '280px' }}>
              <div className="rounded-t-lg border border-line bg-surface-raised px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {p.providerName}, {p.credentials}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-3">{p.total} appts</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink-4">
                  <span className="truncate">
                    {p.room} · {p.hoursLabel}
                  </span>
                  <span className="shrink-0">{hours(p.freeMinutes)} free</span>
                </div>
              </div>

              <div className="space-y-1.5 rounded-b-lg border border-t-0 border-line bg-surface p-2">
                {items.length === 0 ? <div className="px-2 py-6 text-center text-xs text-ink-4">Nothing booked.</div> : null}

                {items.map((it) =>
                  it.kind === 'gap' ? (
                    <div
                      key={`gap-${it.at}`}
                      className="rounded-md border border-dashed border-line px-2.5 py-1.5 text-[11px] text-ink-4"
                    >
                      <span className="g-mono">
                        {it.s.startLabel} – {it.s.endLabel}
                      </span>
                      <span className="ml-2">open · {hours(it.s.minutes)}</span>
                    </div>
                  ) : (
                    <div
                      key={it.a.id}
                      className={`rounded-md border px-2.5 py-2 ${statusTone[it.a.status] ?? 'border-line bg-surface-sunken'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="g-mono text-[11px] font-medium">{it.a.startLabel}</span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-80">
                          {statusLabel[it.a.status] ?? it.a.status}
                        </span>
                      </div>

                      <Link href={`/patients/${it.a.patientId}`} className="mt-0.5 block truncate text-sm font-medium hover:underline">
                        {it.a.patientName}
                      </Link>

                      <div className="mt-0.5 truncate text-[11px] opacity-80">
                        {it.a.typeLabel} · {it.a.durationMinutes}m · {it.a.reason}
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate opacity-70">{it.a.payer}</span>
                        {it.a.copayCents > 0 ? (
                          <span className="shrink-0 font-medium">
                            <Money cents={it.a.copayCents} />
                          </span>
                        ) : null}
                      </div>

                      {it.a.eligibility !== 'verified' ? (
                        <div className={`mt-1 text-[11px] font-medium ${ELIGIBILITY_TONE[it.a.eligibility]}`}>
                          {ELIGIBILITY_LABEL[it.a.eligibility]}
                        </div>
                      ) : null}
                    </div>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
