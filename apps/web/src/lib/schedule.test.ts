import { describe, expect, it } from 'vitest';
import { buildProviderDay, CLINIC_HOURS, hhmm, label12, type RawAppointment, type RawProvider } from './schedule';

const provider: RawProvider = { id: 'prv-1', name: 'Dr. Vance', credentials: 'MD', npi: '1487654323' };

function appt(overrides: Partial<RawAppointment> = {}): RawAppointment {
  return {
    id: 'appt-1',
    providerId: 'prv-1',
    patientId: 'pat-1',
    patientName: 'Miller, Eleanor',
    mrn: 'MRN-1',
    startMinutes: 9 * 60,
    durationMinutes: 20,
    type: 'followup',
    status: 'scheduled',
    reason: 'Follow-up',
    payerName: 'Blue Cross',
    eligibilityStatus: 'active',
    expectedCopayCents: 2500,
    ...overrides,
  };
}

describe('hhmm / label12', () => {
  it('formats minutes-since-midnight as 24h and 12h clock strings', () => {
    expect(hhmm(9 * 60 + 5)).toBe('09:05');
    expect(label12(0)).toBe('12:00 AM');
    expect(label12(13 * 60)).toBe('1:00 PM');
    expect(label12(9 * 60 + 5)).toBe('9:05 AM');
  });
});

describe('buildProviderDay', () => {
  it('reports an empty day as fully free, minus lunch', () => {
    const day = buildProviderDay(provider, []);
    expect(day.total).toBe(0);
    expect(day.bookedMinutes).toBe(0);
    expect(day.capacityMinutes).toBe(CLINIC_HOURS.end - CLINIC_HOURS.start - (CLINIC_HOURS.lunchEnd - CLINIC_HOURS.lunchStart));
    expect(day.freeMinutes).toBe(day.capacityMinutes);
    expect(day.freeSlots).toHaveLength(2); // before lunch, after lunch
  });

  it('excludes a booked slot from the free gaps that follow it', () => {
    const day = buildProviderDay(provider, [appt({ startMinutes: 9 * 60, durationMinutes: 30 })]);
    expect(day.bookedMinutes).toBe(30);
    expect(day.freeMinutes).toBe(day.capacityMinutes - 30);
    // No gap should overlap [9:00, 9:30).
    for (const slot of day.freeSlots) {
      const slotStart = slot.start === hhmm(9 * 60) ? 9 * 60 : undefined;
      expect(slotStart).not.toBe(9 * 60);
    }
  });

  it('drops cancelled appointments from booked time but keeps them in counts', () => {
    const day = buildProviderDay(provider, [appt({ status: 'cancelled', startMinutes: 10 * 60, durationMinutes: 20 })]);
    expect(day.total).toBe(1);
    expect(day.bookedMinutes).toBe(0);
    expect(day.freeMinutes).toBe(day.capacityMinutes);
  });

  it('never reports a gap under 15 minutes as free', () => {
    // Two 20-minute visits back to back with only a 5-minute buffer between them.
    const day = buildProviderDay(provider, [
      appt({ id: 'a', startMinutes: 9 * 60, durationMinutes: 20 }),
      appt({ id: 'b', startMinutes: 9 * 60 + 25, durationMinutes: 20 }),
    ]);
    const midGap = day.freeSlots.find((s) => s.start === hhmm(9 * 60 + 20));
    expect(midGap).toBeUndefined();
  });

  it('maps coverage status to a display eligibility tone', () => {
    const day = buildProviderDay(provider, [
      appt({ id: 'a', eligibilityStatus: 'active' }),
      appt({ id: 'b', eligibilityStatus: 'inactive', startMinutes: 10 * 60 }),
      appt({ id: 'c', eligibilityStatus: null, startMinutes: 11 * 60 }),
    ]);
    const byId = Object.fromEntries(day.appointments.map((a) => [a.id, a.eligibility]));
    expect(byId.a).toBe('verified');
    expect(byId.b).toBe('issue');
    expect(byId.c).toBe('pending');
  });

  it('counts status buckets and sums expected copay, excluding no-shows and cancellations', () => {
    const day = buildProviderDay(provider, [
      appt({ id: 'a', status: 'completed', expectedCopayCents: 1000 }),
      appt({ id: 'b', status: 'no_show', expectedCopayCents: 2000, startMinutes: 10 * 60 }),
      appt({ id: 'c', status: 'cancelled', expectedCopayCents: 3000, startMinutes: 11 * 60 }),
      appt({ id: 'd', status: 'scheduled', expectedCopayCents: 4000, startMinutes: 14 * 60 }),
    ]);
    expect(day.completed).toBe(1);
    expect(day.remaining).toBe(1);
    expect(day.noShows).toBe(1);
    expect(day.expectedCopayCents).toBe(1000 + 4000);
  });
});
