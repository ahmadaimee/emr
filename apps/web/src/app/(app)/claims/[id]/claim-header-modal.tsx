'use client';

import { useState } from 'react';
import { updateClaimHeaderAction } from './edit-actions';

const DELAY_REASON_CODES = [
  { code: '', label: 'None — filing on time' },
  { code: '1', label: '1 — Proof of eligibility unknown or unavailable' },
  { code: '2', label: '2 — Litigation' },
  { code: '3', label: '3 — Authorization delays' },
  { code: '4', label: '4 — Delay in certifying provider' },
  { code: '5', label: '5 — Delay in supplying billing forms' },
  { code: '6', label: '6 — Delay in delivery of custom-made appliances' },
  { code: '7', label: '7 — Third party processing delay' },
  { code: '8', label: '8 — Delay in eligibility determination' },
  { code: '9', label: '9 — Original claim rejected/denied for reasons unrelated to the claim' },
  { code: '10', label: '10 — Administration delay in the prior approval process' },
  { code: '11', label: '11 — Other' },
];

export function ClaimHeaderModal({ claimId, currentDelayReasonCode }: { claimId: string; currentDelayReasonCode: string | null }) {
  const [open, setOpen] = useState(false);
  const [delayReasonCode, setDelayReasonCode] = useState(currentDelayReasonCode ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await updateClaimHeaderAction(claimId, { delayReasonCode: delayReasonCode || null });
      if (!r.ok) setError(r.error);
      else setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-raised px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
      >
        <span>Header</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Claim Header</h3>
                <p className="text-xs text-ink-3">Submission-level attributes carried on the 837 CLM segment</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink">
                ✕
              </button>
            </div>

            {error && <div className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</div>}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Delay Reason Code (CLM20)</label>
                <select
                  value={delayReasonCode}
                  onChange={(e) => setDelayReasonCode(e.target.value)}
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden"
                >
                  {DELAY_REASON_CODES.map((d) => (
                    <option key={d.code} value={d.code}>{d.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-ink-3">Justifies filing past the payer&apos;s timely filing window. Leave as &quot;None&quot; when filing on time.</p>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-sunken">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="rounded-md bg-grove px-4 py-1.5 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50">
                  {loading ? 'Saving…' : 'Save Header'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
