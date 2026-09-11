'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthorizationAction } from './actions';

interface PatientItem { id: string; name: string; mrn: string }
interface PayerItem { id: string; name: string }
interface ProviderItem { id: string; name: string }

export function NewAuthModal({
  patients,
  payers,
  providers,
}: {
  patients: PatientItem[];
  payers: PayerItem[];
  providers: ProviderItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [renderingProviderId, setRenderingProviderId] = useState('');
  const [procedureCode, setProcedureCode] = useState('');
  const [diagnosisCode, setDiagnosisCode] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'urgent'>('routine');
  const [units, setUnits] = useState('1');
  const [serviceDateFrom, setServiceDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setPatientId(''); setPayerId(''); setRenderingProviderId(''); setProcedureCode(''); setDiagnosisCode('');
    setUrgency('routine'); setUnits('1'); setServiceDateFrom(new Date().toISOString().slice(0, 10)); setNotes(''); setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createAuthorizationAction({
      patientId, payerId, renderingProviderId: renderingProviderId || undefined, urgency,
      procedureCode, diagnosisCode, unitsRequested: Number(units) || 1, serviceDateFrom, notes: notes || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    router.refresh();
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
      reset();
    }, 900);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs"
      >
        <span>New Prior Authorization</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Request Prior Authorization</h3>
                <p className="text-xs text-ink-3">Generates a 278 request artifact and starts the payer's response clock — 7 days routine, 72 hours urgent (CMS 2026 rule).</p>
              </div>
              <button onClick={() => { setOpen(false); reset(); }} className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink">
                ✕
              </button>
            </div>

            {success && (
              <div className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
                Authorization request created and tracked.
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Patient *</label>
                  <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink">
                    <option value="">Select a patient…</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Target Payer *</label>
                  <select required value={payerId} onChange={(e) => setPayerId(e.target.value)} className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink">
                    <option value="">Select a payer…</option>
                    {payers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Requesting Provider</label>
                <select value={renderingProviderId} onChange={(e) => setRenderingProviderId(e.target.value)} className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink">
                  <option value="">Select a provider…</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">CPT / HCPCS *</label>
                  <input type="text" required value={procedureCode} onChange={(e) => setProcedureCode(e.target.value)} placeholder="72148" className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs font-mono text-ink" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Primary ICD-10 *</label>
                  <input type="text" required value={diagnosisCode} onChange={(e) => setDiagnosisCode(e.target.value)} placeholder="M54.5" className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs font-mono text-ink" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Requested Units</label>
                  <input type="number" min="1" value={units} onChange={(e) => setUnits(e.target.value)} className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs font-mono text-ink" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Service Date *</label>
                  <input type="date" required value={serviceDateFrom} onChange={(e) => setServiceDateFrom(e.target.value)} className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Urgency</label>
                  <select value={urgency} onChange={(e) => setUrgency(e.target.value as 'routine' | 'urgent')} className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink">
                    <option value="routine">Routine (7-day response)</option>
                    <option value="urgent">Urgent (72-hour response)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Clinical Rationale & Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Summarize conservative treatment failures, imaging findings, or medical necessity…"
                  className="w-full rounded-md border border-line-strong bg-surface p-2 text-xs text-ink"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => { setOpen(false); reset(); }} className="rounded-md px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-sunken">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="rounded-md bg-grove px-4 py-1.5 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50">
                  {loading ? 'Submitting…' : 'Submit Auth Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
