'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordAuthorizationDecisionAction } from './actions';

export function DecisionButton({ authorizationId }: { authorizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'approved' | 'partially_approved' | 'denied'>('approved');
  const [authorizationNumber, setAuthorizationNumber] = useState('');
  const [unitsApproved, setUnitsApproved] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await recordAuthorizationDecisionAction(authorizationId, {
      status,
      authorizationNumber: authorizationNumber || undefined,
      unitsApproved: unitsApproved ? Number(unitsApproved) : undefined,
      expiresOn: expiresOn || undefined,
      payerResponseMessage: message || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-line-strong px-2 py-1 text-[11px] font-medium text-ink-2 hover:bg-surface-sunken">
        Record Decision
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-line bg-surface-raised p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-sm font-semibold text-ink">Record the payer's decision</h3>
            <p className="mt-1 text-[11px] text-ink-3">Enter what the payer said — by phone, portal, fax, or a returned 278.</p>

            {error && <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-2 text-xs text-danger">{error}</div>}

            <form onSubmit={submit} className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Decision</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs">
                  <option value="approved">Approved</option>
                  <option value="partially_approved">Partially approved</option>
                  <option value="denied">Denied</option>
                </select>
              </div>
              {status !== 'denied' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-2">Authorization number *</label>
                    <input value={authorizationNumber} onChange={(e) => setAuthorizationNumber(e.target.value)} required className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-2">Units approved</label>
                      <input type="number" min="1" value={unitsApproved} onChange={(e) => setUnitsApproved(e.target.value)} className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs font-mono" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-2">Expires on</label>
                      <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs" />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Payer note</label>
                <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full rounded-md border border-line-strong bg-surface p-2 text-xs" />
              </div>
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-xs text-ink-2 hover:bg-surface-sunken">Cancel</button>
                <button type="submit" disabled={loading} className="h-8 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50">
                  {loading ? 'Saving…' : 'Save decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
