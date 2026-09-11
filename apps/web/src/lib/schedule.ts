/**
 * Pure day-book assembly logic, shared by the scheduling console and the dashboard's
 * "Today's schedule" widget. No DB access here — callers fetch rows, this shapes them.
 */

export const APPOINTMENT_TYPES = [
  { code: 'new', label: 'New Patient', minutes: 40, cpt: '99204' },
  { code: 'followup', label: 'Follow-up', minutes: 20, cpt: '99213' },
  { code: 'annual', label: 'Annual Physical', minutes: 30, cpt: '99395' },
  { code: 'telehealth', label: 'Telehealth', minutes: 15, cpt: '99213' },
  { code: 'procedure', label: 'Procedure', minutes: 45, cpt: '20610' },
  { code: 'labs', label: 'Lab / Injection', minutes: 10, cpt: '36415' },
] as const;

/**
 * The standard clinic day every provider is assumed to keep. Per-provider working
 * hours would be a real improvement, but it's a settings feature of its own — there is
 * nowhere in the product today to configure it, so building the day-book against a
 * column that can never be set would be worse than this explicit, documented default.
 */
export const CLINIC_HOURS = { start: 8 * 60, end: 17 * 60, lunchStart: 12 * 60, lunchEnd: 13 * 60 };

export function hhmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function label12(m: number): string {
  const h = Math.floor(m / 60);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m % 60).padStart(2, '0')} ${suffix}`;
}

export interface RawAppointment {
  id: string;
  providerId: string;
  patientId: string;
  patientName: string;
  mrn: string;
  startMinutes: number;
  durationMinutes: number;
  type: string;
  status: string;
  reason: string | null;
  payerName: string | null;
  eligibilityStatus: string | null;
  expectedCopayCents: number | null;
}

export interface RawProvider {
  id: string;
  name: string;
  credentials: string | null;
  npi: string;
}

function typeLabel(code: string): string {
  return APPOINTMENT_TYPES.find((t) => t.code === code)?.label ?? code;
}

function eligibilityTone(status: string | null): 'verified' | 'pending' | 'issue' {
  if (status === 'active') return 'verified';
  if (status === 'inactive' || status === 'not_found') return 'issue';
  return 'pending';
}

/** Gaps in a provider's booked day, excluding lunch. Slivers under 15 minutes aren't sellable clinic time. */
function freeSlotsFor(appts: { startMinutes: number; durationMinutes: number }[]) {
  const blocks = [
    ...appts.map((a) => [a.startMinutes, a.startMinutes + a.durationMinutes] as [number, number]),
    [CLINIC_HOURS.lunchStart, CLINIC_HOURS.lunchEnd] as [number, number],
  ].sort((a, b) => a[0] - b[0]);

  const slots: { start: string; end: string; startLabel: string; endLabel: string; minutes: number }[] = [];
  let cursor = CLINIC_HOURS.start;
  for (const [s, e] of blocks) {
    if (s - cursor >= 15) slots.push({ start: hhmm(cursor), end: hhmm(s), startLabel: label12(cursor), endLabel: label12(s), minutes: s - cursor });
    cursor = Math.max(cursor, e);
  }
  if (CLINIC_HOURS.end - cursor >= 15) {
    slots.push({ start: hhmm(cursor), end: hhmm(CLINIC_HOURS.end), startLabel: label12(cursor), endLabel: label12(CLINIC_HOURS.end), minutes: CLINIC_HOURS.end - cursor });
  }
  return slots;
}

/** Per-provider load for one day: how many appointments, how full, where the gaps are. */
export function buildProviderDay(provider: RawProvider, appts: RawAppointment[]) {
  const active = appts.filter((a) => a.status !== 'cancelled');
  const slots = freeSlotsFor(active);
  const lunchMinutes = CLINIC_HOURS.lunchEnd - CLINIC_HOURS.lunchStart;
  const capacityMinutes = CLINIC_HOURS.end - CLINIC_HOURS.start - lunchMinutes;
  const bookedMinutes = active.reduce((s, a) => s + a.durationMinutes, 0);
  const freeMinutes = slots.reduce((s, x) => s + x.minutes, 0);
  const counts = (s: string) => appts.filter((a) => a.status === s).length;

  const decorated = appts
    .map((a) => ({
      ...a,
      startLabel: label12(a.startMinutes),
      endLabel: label12(a.startMinutes + a.durationMinutes),
      typeLabel: typeLabel(a.type),
      eligibility: eligibilityTone(a.eligibilityStatus),
      copayCents: a.expectedCopayCents ?? 0,
      payer: a.payerName ?? 'Self-pay',
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  return {
    providerId: provider.id,
    providerName: provider.name,
    credentials: provider.credentials ?? '',
    specialty: '',
    npi: provider.npi,
    room: '',
    hoursLabel: `${label12(CLINIC_HOURS.start)} – ${label12(CLINIC_HOURS.end)}`,
    lunchLabel: `${label12(CLINIC_HOURS.lunchStart)} – ${label12(CLINIC_HOURS.lunchEnd)}`,
    appointments: decorated,
    total: appts.length,
    completed: counts('completed'),
    checkedIn: counts('checked_in'),
    inRoom: counts('in_room'),
    remaining: counts('scheduled'),
    noShows: counts('no_show'),
    bookedMinutes,
    capacityMinutes,
    freeMinutes,
    utilizationBps: capacityMinutes > 0 ? Math.round((10000 * bookedMinutes) / capacityMinutes) : 0,
    freeSlots: slots,
    expectedCopayCents: appts.filter((a) => a.status !== 'no_show' && a.status !== 'cancelled').reduce((s, a) => s + (a.expectedCopayCents ?? 0), 0),
  };
}

export type ProviderDay = ReturnType<typeof buildProviderDay>;
