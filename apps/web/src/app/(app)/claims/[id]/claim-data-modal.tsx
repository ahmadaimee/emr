'use client';

import { useState } from 'react';
import { updateClaimDataAction, type ClaimDataInput } from './edit-actions';

interface ClaimDataModalProps {
  claimId: string;
  current: Required<Pick<ClaimDataInput,
    'relatedToEmployment' | 'relatedToAutoAccident' | 'relatedToOtherAccident' | 'outsideLabPerformed'
  >> & ClaimDataInput;
}

export function ClaimDataModal({ claimId, current }: ClaimDataModalProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClaimDataInput>(current);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ClaimDataInput>(key: K, value: ClaimDataInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await updateClaimDataAction(claimId, form);
      if (!r.ok) setError(r.error);
      else setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden';
  const labelCls = 'block text-xs font-medium text-ink-2 mb-1';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-raised px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
      >
        <span>Data</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Claim Data</h3>
                <p className="text-xs text-ink-3">Condition, illness/accident dates, hospitalization, and outside lab — CMS-1500 items 10 &amp; 14-20</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink">
                ✕
              </button>
            </div>

            {error && <div className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</div>}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <span className={labelCls}>Is Patient Condition Related to</span>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  <label className="flex items-center gap-1.5 text-xs text-ink-2">
                    <input type="checkbox" checked={!!form.relatedToEmployment} onChange={(e) => set('relatedToEmployment', e.target.checked)} />
                    Employment
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink-2">
                    <input type="checkbox" checked={!!form.relatedToAutoAccident} onChange={(e) => set('relatedToAutoAccident', e.target.checked)} />
                    Auto Accident
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink-2">
                    <input type="checkbox" checked={!!form.relatedToOtherAccident} onChange={(e) => set('relatedToOtherAccident', e.target.checked)} />
                    Other Accident
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Accident State</label>
                  <input value={form.accidentState ?? ''} onChange={(e) => set('accidentState', e.target.value.toUpperCase())} maxLength={2} placeholder="e.g. NY" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Accident / Symptom Date</label>
                  <input type="date" value={form.accidentDate ?? ''} onChange={(e) => set('accidentDate', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Onset Date</label>
                  <input type="date" value={form.onsetDate ?? ''} onChange={(e) => set('onsetDate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Initial Treatment</label>
                  <input type="date" value={form.initialTreatmentDate ?? ''} onChange={(e) => set('initialTreatmentDate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Date Last Seen</label>
                  <input type="date" value={form.lastSeenDate ?? ''} onChange={(e) => set('lastSeenDate', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Hospitalization Dates — From (Box 18)</label>
                  <input type="date" value={form.hospitalizedFrom ?? ''} onChange={(e) => set('hospitalizedFrom', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hospitalization Dates — To</label>
                  <input type="date" value={form.hospitalizedTo ?? ''} onChange={(e) => set('hospitalizedTo', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Unable to Work — From (Box 16)</label>
                  <input type="date" value={form.disabilityFrom ?? ''} onChange={(e) => set('disabilityFrom', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Unable to Work — To</label>
                  <input type="date" value={form.disabilityTo ?? ''} onChange={(e) => set('disabilityTo', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="rounded-lg border border-line bg-surface p-3">
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink-2 mb-2">
                  <input type="checkbox" checked={!!form.outsideLabPerformed} onChange={(e) => set('outsideLabPerformed', e.target.checked)} />
                  Outside Lab (Box 20) — a purchased service billed by this provider
                </label>
                {form.outsideLabPerformed && (
                  <div>
                    <label className={labelCls}>Outside Lab Charges ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.outsideLabChargesCents ? (form.outsideLabChargesCents / 100).toFixed(2) : ''}
                      onChange={(e) => set('outsideLabChargesCents', Math.round(parseFloat(e.target.value || '0') * 100))}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Additional Claim Information (Box 19)</label>
                <textarea
                  value={form.additionalClaimInfo ?? ''}
                  onChange={(e) => set('additionalClaimInfo', e.target.value)}
                  rows={2}
                  placeholder="Free-text note per NUCC / payer instructions"
                  className="w-full rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-4 focus:border-grove resize-none"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-sunken">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="rounded-md bg-grove px-4 py-1.5 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50">
                  {loading ? 'Saving…' : 'Save Claim Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
