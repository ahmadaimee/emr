'use client';

import { useState } from 'react';

export function InquireStatusModal() {
  const [open, setOpen] = useState(false);
  const [claimNumber, setClaimNumber] = useState('');
  const [payer, setPayer] = useState('Blue Cross Blue Shield');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleInquire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimNumber.trim()) return;
    setLoading(true);
    setResult(null);

    // Simulate 276/277 EDI transaction
    setTimeout(() => {
      setLoading(false);
      setResult(`277 Response Received: Claim ${claimNumber.toUpperCase()} is acknowledged by ${payer}. Status Category A1 (Adjudication In Progress). STC01: 19.`);
    }, 900);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs"
      >
        <span>Run Real-Time 276 Inquiry</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">New 276 Claim Status Inquiry</h3>
                <p className="text-xs text-ink-3">Transmit real-time ASC X12 276 transaction to clearinghouse</p>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  setResult(null);
                }}
                className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink"
              >
                ✕
              </button>
            </div>

            {result && (
              <div className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
                {result}
              </div>
            )}

            <form onSubmit={handleInquire} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Claim Number or ICN *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CLM-2026-0101 or PAY-8849201"
                  value={claimNumber}
                  onChange={(e) => setClaimNumber(e.target.value)}
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono text-ink focus:border-grove focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Target Payer</label>
                <select
                  value={payer}
                  onChange={(e) => setPayer(e.target.value)}
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                >
                  <option value="Blue Cross Blue Shield">Blue Cross Blue Shield (00010)</option>
                  <option value="Aetna Health">Aetna Health (60054)</option>
                  <option value="UnitedHealthcare">UnitedHealthcare (87726)</option>
                  <option value="Cigna">Cigna (62308)</option>
                  <option value="Medicare Part B">Medicare Part B Illinois (00590)</option>
                </select>
              </div>

              <div className="rounded-md bg-surface-sunken p-2.5 text-[11px] text-ink-3 font-mono">
                Payload: X12 276 (005010X212) · Loop 2000D / 2200D TRN*1*ICN
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setResult(null);
                  }}
                  className="rounded-md px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-sunken"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-grove px-4 py-1.5 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {loading ? 'Transmitting 276…' : 'Send 276 Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
