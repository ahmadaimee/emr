'use client';

import { useState } from 'react';
import { updateClaimFilingAction } from '../actions';

interface EditFilingModalProps {
  claimId: string;
  claimNumber: string;
  currentType?: string;
  currentFrequencyCode?: string;
  currentOriginalIcn?: string;
  currentRank?: string;
  currentPriorAuth?: string;
}

export function EditFilingModal({
  claimId,
  claimNumber,
  currentType = '837P',
  currentFrequencyCode = '1',
  currentOriginalIcn = '',
  currentRank = 'primary',
  currentPriorAuth = '',
}: EditFilingModalProps) {
  const [open, setOpen] = useState(false);
  const [claimType, setClaimType] = useState(currentType);
  const [frequencyCode, setFrequencyCode] = useState(currentFrequencyCode);
  const [originalIcn, setOriginalIcn] = useState(currentOriginalIcn);
  const [coverageRank, setCoverageRank] = useState(currentRank);
  const [priorAuth, setPriorAuth] = useState(currentPriorAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((frequencyCode === '7' || frequencyCode === '8') && !originalIcn.trim()) {
      setError('Original Payer Control Number (ICN/CCN) is strictly required for Replacement (Type 7) or Void (Type 8) claims.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await updateClaimFilingAction(claimId, {
        claimType: claimType as '837P' | '837I' | '837D',
        claimFrequencyCode: frequencyCode,
        originalPayerControlNumber: originalIcn.trim(),
        coverageRank: coverageRank as 'primary' | 'secondary' | 'tertiary',
        priorAuthNumber: priorAuth.trim(),
      });
      setOpen(false);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update claim filing attributes');
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
        <span>⚙️</span>
        <span>Claim Type & Filing</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Claim Filing & Submission Type</h3>
                <p className="text-xs text-ink-3">Configure EDI transaction format, frequency, and cross-reference ICN for claim {claimNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">
                  EDI Transaction / Claim Type
                </label>
                <select
                  value={claimType}
                  onChange={(e) => setClaimType(e.target.value)}
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden"
                >
                  <option value="837P">837P — Professional (CMS-1500 HCFA Standard)</option>
                  <option value="837I">837I — Institutional (UB-04 / CMS-1450 Hospital)</option>
                  <option value="837D">837D — Dental (ADA Dental Claim Form)</option>
                </select>
                <p className="mt-1 text-[11px] text-ink-3">Defines X12 loop structure and clearinghouse routing rules.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">
                    Claim Frequency Code
                  </label>
                  <select
                    value={frequencyCode}
                    onChange={(e) => setFrequencyCode(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden"
                  >
                    <option value="1">1 — Original Claim (Initial Submission)</option>
                    <option value="7">7 — Replacement of Prior Claim (Corrected Claim)</option>
                    <option value="8">8 — Void / Cancel Prior Claim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">
                    Coverage Rank
                  </label>
                  <select
                    value={coverageRank}
                    onChange={(e) => setCoverageRank(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden"
                  >
                    <option value="primary">Primary Coverage</option>
                    <option value="secondary">Secondary Coverage (COB)</option>
                    <option value="tertiary">Tertiary Coverage</option>
                  </select>
                </div>
              </div>

              {(frequencyCode === '7' || frequencyCode === '8') && (
                <div className="rounded-lg border border-warn/30 bg-warn/10 p-3">
                  <label className="block text-xs font-semibold text-warn mb-1">
                    Original Claim Reference / ICN Number (Required) *
                  </label>
                  <input
                    type="text"
                    required
                    value={originalIcn}
                    onChange={(e) => setOriginalIcn(e.target.value)}
                    placeholder="e.g. CCN-BCBS-88910 or ICN-2026-991823"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono text-ink focus:border-grove focus:outline-hidden"
                  />
                  <p className="mt-1 text-[11px] text-ink-3">
                    Placed in Loop 2300 REF*F8 (Original Reference Number) and Box 22 on CMS-1500 for payer adjudication matching.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">
                  Prior Authorization Number (Optional)
                </label>
                <input
                  type="text"
                  value={priorAuth}
                  onChange={(e) => setPriorAuth(e.target.value)}
                  placeholder="e.g. AUTH-99214-BCBS"
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono text-ink focus:border-grove focus:outline-hidden"
                />
                <p className="mt-1 text-[11px] text-ink-3">Placed in Loop 2300 REF*G1 and Box 23 on CMS-1500.</p>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-grove px-4 py-1.5 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save & Update Claim Filing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
