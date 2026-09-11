'use client';

import { useState } from 'react';

export function CreateBatchModal() {
  const [open, setOpen] = useState(false);
  const [batchType, setBatchType] = useState('claims_837p');
  const [practice, setPractice] = useState('Orchard Family Practice');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMessage(`Successfully packaged batch for ${practice}. Encrypted ANSI ASC X12 file staged for immediate clearinghouse transmission.`);
    }, 800);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs"
      >
        <span>Create EDI Batch</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Package New EDI Transaction Batch</h3>
                <p className="text-xs text-ink-3">Aggregate queued transactions into an ANSI ASC X12 interchange envelope</p>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  setMessage(null);
                }}
                className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink"
              >
                ✕
              </button>
            </div>

            {message && (
              <div className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
                {message}
              </div>
            )}

            <form onSubmit={handleGenerate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Batch Transaction Type</label>
                <select
                  value={batchType}
                  onChange={(e) => setBatchType(e.target.value)}
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                >
                  <option value="claims_837p">Claims 837P Professional Batch (Clean Queued Claims)</option>
                  <option value="eligibility_270">Eligibility 270 Inquiry Sweep (Tomorrow Schedule)</option>
                  <option value="payments_settle">Daily Payment Gateway Closeout & Merchant Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Practice Care Center</label>
                <select
                  value={practice}
                  onChange={(e) => setPractice(e.target.value)}
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                >
                  <option value="Orchard Family Practice">Orchard Family Practice (NPI 1487654323)</option>
                  <option value="Valley Internal Medicine">Valley Internal Medicine (NPI 1982736450)</option>
                  <option value="All Practices">All Practice Locations (Consolidated)</option>
                </select>
              </div>

              <div className="rounded-md bg-surface-sunken p-2.5 text-[11px] text-ink-3">
                <span className="font-semibold text-ink">Clearinghouse Target:</span> Stedi Cloud REST Adapter · ISA05/06: ZZ/GROVEHEALTH
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setMessage(null);
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
                  {loading ? 'Compiling Envelope…' : 'Generate & Stage Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
