'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClaimAction } from './actions';

const field =
  'w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden';

const POS_OPTIONS = [
  { value: '11', label: '11 — Office' },
  { value: '02', label: '02 — Telehealth (patient at home)' },
  { value: '19', label: '19 — Off-campus Outpatient Hospital' },
  { value: '21', label: '21 — Inpatient Hospital' },
  { value: '22', label: '22 — On-campus Outpatient Hospital' },
  { value: '23', label: '23 — Emergency Room' },
];

interface Line {
  procedureCode: string;
  modifiers: string;
  units: string;
  chargeDollars: string;
  diagnosisPointers: string;
}

const emptyLine = (): Line => ({ procedureCode: '', modifiers: '', units: '1', chargeDollars: '', diagnosisPointers: '1' });

export function NewClaimModal({
  patients,
  providers,
}: {
  patients: Array<{ id: string; name: string }>;
  providers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [renderingProviderId, setRenderingProviderId] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [placeOfService, setPlaceOfService] = useState('11');
  const [diagnosisCodes, setDiagnosisCodes] = useState<string[]>(['']);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCents = lines.reduce((s, l) => s + Math.round((Number(l.chargeDollars) || 0) * 100), 0);

  const reset = () => {
    setPatientId('');
    setRenderingProviderId('');
    setServiceDate(new Date().toISOString().slice(0, 10));
    setPlaceOfService('11');
    setDiagnosisCodes(['']);
    setLines([emptyLine()]);
    setError(null);
  };

  const setDx = (i: number, v: string) => setDiagnosisCodes((d) => d.map((x, idx) => (idx === i ? v : x)));
  const addDx = () => setDiagnosisCodes((d) => [...d, '']);
  const removeDx = (i: number) => setDiagnosisCodes((d) => d.filter((_, idx) => idx !== i));

  const setLine = <K extends keyof Line>(i: number, k: K, v: Line[K]) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLine = () => setLines((ls) => [...ls, emptyLine()]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createClaimAction({
      patientId,
      renderingProviderId,
      serviceDate,
      placeOfService,
      diagnosisCodes,
      lines: lines.map((l) => ({
        procedureCode: l.procedureCode,
        modifiers: l.modifiers.split(',').map((m) => m.trim().toUpperCase()).filter(Boolean).slice(0, 4),
        units: Number(l.units) || 1,
        chargeCents: Math.round((Number(l.chargeDollars) || 0) * 100),
        diagnosisPointers: l.diagnosisPointers
          .split(',')
          .map((p) => Number(p.trim()))
          .filter((n) => Number.isInteger(n) && n > 0)
          .slice(0, 4), // CMS-1500 box 24E / 837P SV107 allow at most 4 pointers (A-D) per line
      })),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    reset();
    router.push(`/claims/${res.claimId}`);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs"
      >
        + New Claim
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">New Claim</h3>
                <p className="text-xs text-ink-3">Bill an encounter — the charge posts to the ledger the moment the claim is created.</p>
              </div>
              <button
                type="button"
                onClick={() => { setOpen(false); reset(); }}
                className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Patient *</label>
                  <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className={field}>
                    <option value="">Select a patient…</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Rendering Provider *</label>
                  <select required value={renderingProviderId} onChange={(e) => setRenderingProviderId(e.target.value)} className={field}>
                    <option value="">Select a provider…</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Service Date *</label>
                  <input type="date" required value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Place of Service *</label>
                  <select required value={placeOfService} onChange={(e) => setPlaceOfService(e.target.value)} className={field}>
                    {POS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-line bg-surface-sunken/30 p-3">
                <h4 className="mb-2 text-xs font-semibold text-ink">Diagnoses (ICD-10)</h4>
                <div className="space-y-2">
                  {diagnosisCodes.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 text-right text-[11px] text-ink-4">{i + 1}.</span>
                      <input value={d} onChange={(e) => setDx(i, e.target.value)} placeholder="e.g. Z00.00" className={`${field} font-mono`} required={i === 0} />
                      {diagnosisCodes.length > 1 && (
                        <button type="button" onClick={() => removeDx(i)} className="text-xs text-danger hover:underline">Remove</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addDx} className="mt-2 text-xs font-medium text-grove-strong hover:underline">+ Add diagnosis</button>
              </div>

              <div className="rounded-lg border border-line bg-surface-sunken/30 p-3">
                <h4 className="mb-1 text-xs font-semibold text-ink">Service Lines</h4>
                <p className="mb-2 text-[11px] text-ink-3">Dx pointers reference the numbered diagnosis list above (e.g. "1,2").</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line text-[10px] uppercase text-ink-3">
                      <tr>
                        <th className="py-1.5 pr-2">CPT/HCPCS *</th>
                        <th className="py-1.5 pr-2">Modifiers (up to 4)</th>
                        <th className="py-1.5 pr-2 w-16">Units</th>
                        <th className="py-1.5 pr-2 w-24">Dx Ptrs (up to 4)</th>
                        <th className="py-1.5 pr-2 text-right w-28">Charge ($) *</th>
                        <th className="py-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {lines.map((l, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-2">
                            <input value={l.procedureCode} onChange={(e) => setLine(i, 'procedureCode', e.target.value)} placeholder="99213" required className={`${field} font-mono`} />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input value={l.modifiers} onChange={(e) => setLine(i, 'modifiers', e.target.value)} placeholder="25, 59" className={`${field} font-mono`} />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input type="number" min="1" value={l.units} onChange={(e) => setLine(i, 'units', e.target.value)} className={`${field} font-mono`} />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input value={l.diagnosisPointers} onChange={(e) => setLine(i, 'diagnosisPointers', e.target.value)} placeholder="1, 2" className={`${field} font-mono`} />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input type="number" step="0.01" min="0.01" required value={l.chargeDollars} onChange={(e) => setLine(i, 'chargeDollars', e.target.value)} placeholder="0.00" className={`${field} text-right font-mono`} />
                          </td>
                          <td className="py-1.5 text-center">
                            {lines.length > 1 && (
                              <button type="button" onClick={() => removeLine(i)} className="text-xs text-danger hover:underline">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={addLine} className="text-xs font-medium text-grove-strong hover:underline">+ Add line</button>
                  <span className="text-xs text-ink-2">Total charge: <strong className="font-mono">${(totalCents / 100).toFixed(2)}</strong></span>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => { setOpen(false); reset(); }} className="h-8 rounded-md px-3 text-xs text-ink-2 hover:bg-surface-sunken">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50">
                  {loading ? 'Creating claim…' : 'Create Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
