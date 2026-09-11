'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { bookAppointmentAction } from './actions';

interface ProviderItem {
  id: string;
  name: string;
  credentials: string;
}

interface TypeItem {
  code: string;
  label: string;
  minutes: number;
  cpt: string;
}

interface PatientItem {
  id: string;
  name: string;
  mrn: string;
}

export function NewAppointmentModal({
  providers,
  types,
  patients,
  date,
}: {
  providers: ProviderItem[];
  types: TypeItem[];
  patients: PatientItem[];
  date: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState(providers[0]?.id || '');
  const [type, setType] = useState(types[1]?.code || 'followup');
  const [patientQuery, setPatientQuery] = useState('');
  const [reason, setReason] = useState('');
  const [start, setStart] = useState('09:00');
  const [when, setWhen] = useState(date);
  const [copay, setCopay] = useState('25.00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selected = types.find((t) => t.code === type);
  const patientLabel = (p: PatientItem) => `${p.name} — ${p.mrn}`;
  const matchedPatient = patients.find((p) => patientLabel(p) === patientQuery.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedPatient) {
      setError('Select a patient from the list — start typing a name or MRN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await bookAppointmentAction({
        providerId,
        patientId: matchedPatient.id,
        type,
        reason: reason.trim(),
        start,
        date: when,
        copayCents: Math.round((Number(copay) || 0) * 100),
      });
      setSuccess(true);
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setPatientQuery('');
        setReason('');
      }, 900);
    } catch {
      setError('Could not book the appointment. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const field = 'w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white shadow-xs transition-colors hover:bg-grove-strong"
      >
        <span>Book Appointment</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg rounded-xl border border-line bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Book Appointment</h3>
                <p className="text-xs text-ink-3">Slot length follows the visit type; eligibility is checked after booking.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink">
                ✕
              </button>
            </div>

            {success && (
              <div className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
                Appointment booked. It is on the day book now.
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Provider *</label>
                  <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className={field}>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}, {p.credentials}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Visit type *</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
                    {types.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label} ({t.minutes}m)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Patient *</label>
                  <input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Start typing a name or MRN…"
                    list="new-appointment-patients"
                    className={field}
                  />
                  <datalist id="new-appointment-patients">
                    {patients.map((p) => (
                      <option key={p.id} value={patientLabel(p)} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Reason for visit</label>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Follow-up" className={field} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Date *</label>
                  <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Start *</label>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} step={300} className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Copay</label>
                  <input value={copay} onChange={(e) => setCopay(e.target.value)} inputMode="decimal" className={field} />
                </div>
              </div>

              {selected ? (
                <p className="rounded-md bg-surface-sunken px-3 py-2 text-[11px] text-ink-3">
                  {selected.minutes}-minute slot · expected CPT <span className="g-mono">{selected.cpt}</span> ·{' '}
                  {selected.code === 'telehealth' ? 'POS 02 (telehealth)' : 'POS 11 (office)'}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-xs text-ink-2 hover:bg-surface-sunken">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-8 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-60"
                >
                  {loading ? 'Booking…' : 'Book appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
