'use client';

import { useState } from 'react';
import { recordInsurancePaymentAction } from './actions';

interface OpenClaimOption {
  id: string;
  claimNumber: string;
  patientName: string;
  mrn: string;
  billedCents: number;
  payerName: string;
}

interface PayerOption {
  id: string;
  name: string;
  payerId: string;
}

interface AllocationRow {
  claimId: string;
  claimNumber: string;
  patientName: string;
  billedCents: number;
  allowedCents: number;
  paidCents: number;
  contractualAdjustmentCents: number;
  patientResponsibilityCents: number;
}

export function PostInsurancePaymentModal({
  payers,
  openClaims,
}: {
  payers: PayerOption[];
  openClaims: OpenClaimOption[];
}) {
  const [open, setOpen] = useState(false);
  const [payerId, setPayerId] = useState(payers[0]?.id || 'pyr-1');
  const [paymentType, setPaymentType] = useState<'check' | 'eft' | 'virtual_card'>('check');
  const [traceNumber, setTraceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkTotalDollars, setCheckTotalDollars] = useState('');
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [selectedClaimToAdd, setSelectedClaimToAdd] = useState(openClaims[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPayer = payers.find((p) => p.id === payerId) || payers[0];
  const checkTotalCents = Math.round((Number(checkTotalDollars) || 0) * 100);
  const totalAllocatedPaidCents = allocations.reduce((sum, a) => sum + (a.paidCents || 0), 0);
  const varianceCents = checkTotalCents - totalAllocatedPaidCents;

  const handleAddClaim = () => {
    const claim = openClaims.find((c) => c.id === selectedClaimToAdd);
    if (!claim) return;
    if (allocations.some((a) => a.claimId === claim.id)) return;

    // Default 80/20 split estimation with standard contractual write-off
    const billed = claim.billedCents;
    const allowed = Math.round(billed * 0.85);
    const paid = Math.round(allowed * 0.8);
    const co45 = billed - allowed;
    const pr = allowed - paid;

    setAllocations([
      ...allocations,
      {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        patientName: claim.patientName,
        billedCents: billed,
        allowedCents: allowed,
        paidCents: paid,
        contractualAdjustmentCents: co45,
        patientResponsibilityCents: pr,
      },
    ]);
  };

  const handleRemoveAllocation = (index: number) => {
    setAllocations(allocations.filter((_, idx) => idx !== index));
  };

  const handleUpdateAllocation = (index: number, field: keyof AllocationRow, value: number) => {
    setAllocations(
      allocations.map((a, idx) => {
        if (idx !== index) return a;
        const updated = { ...a, [field]: value };
        // Auto adjust CO-45 writeoff if paid changes
        if (field === 'paidCents') {
          updated.contractualAdjustmentCents = Math.max(0, updated.billedCents - value - updated.patientResponsibilityCents);
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traceNumber.trim()) {
      setError('Check / EFT Trace Number is required.');
      return;
    }
    if (checkTotalCents <= 0) {
      setError('Total check amount must be greater than $0.00.');
      return;
    }
    if (allocations.length === 0) {
      setError('Add at least one claim to allocate this insurance payment.');
      return;
    }
    if (varianceCents !== 0) {
      setError(`Payment out of balance: Sum of claim payments ($${(totalAllocatedPaidCents / 100).toFixed(2)}) does not match check total ($${(checkTotalCents / 100).toFixed(2)}). Variance: $${(varianceCents / 100).toFixed(2)}`);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await recordInsurancePaymentAction({
        payerId,
        payerName: selectedPayer?.name || 'Insurance Payer',
        paymentType,
        checkOrEftTraceNumber: traceNumber.trim(),
        paymentDate,
        totalPaidCents: checkTotalCents,
        allocations,
      });
      setOpen(false);
      setTraceNumber('');
      setCheckTotalDollars('');
      setAllocations([]);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to post insurance payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs"
      >
        <span>🏦</span>
        <span>Post Insurance Check / EOB</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Post Manual Insurance Payment / EOB</h3>
                <p className="text-xs text-ink-3">Post paper checks, virtual credit cards, or manual EFT remittances with line-item claim balancing</p>
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

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Top Header Fields */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-ink-2 mb-1">Insurance Payer</label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                  >
                    {payers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.payerId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Payment Instrument</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                  >
                    <option value="check">Paper Check</option>
                    <option value="eft">EFT / Direct Deposit</option>
                    <option value="virtual_card">Virtual Card (VCC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Check / EFT Date</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Check / Trace / Reference Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CHK-BCBS-99120 or EFT-881290"
                    value={traceNumber}
                    onChange={(e) => setTraceNumber(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono text-ink focus:border-grove focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Total Check Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={checkTotalDollars}
                    onChange={(e) => setCheckTotalDollars(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono font-semibold text-ink focus:border-grove focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Claim Allocation Section */}
              <div className="rounded-lg border border-line bg-surface-sunken/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Claim Line-Item Allocations</h4>
                    <p className="text-[11px] text-ink-3">Allocate paid amount, contractual adjustment (CO-45), and patient copay/deductible (PR)</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedClaimToAdd}
                      onChange={(e) => setSelectedClaimToAdd(e.target.value)}
                      className="h-7 rounded border border-line bg-surface px-2 text-xs text-ink"
                    >
                      {openClaims.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.claimNumber} · {c.patientName} (${(c.billedCents / 100).toFixed(2)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddClaim}
                      className="h-7 rounded bg-ink px-2.5 text-[11px] font-medium text-ink-inverse hover:opacity-90"
                    >
                      + Add Claim
                    </button>
                  </div>
                </div>

                {allocations.length === 0 ? (
                  <div className="py-6 text-center text-xs text-ink-3">
                    No claims attached to this check yet. Select an open claim above and click &quot;+ Add Claim&quot;.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-line text-[10px] uppercase text-ink-3">
                        <tr>
                          <th className="py-1.5 px-2">Claim / Patient</th>
                          <th className="py-1.5 px-2 text-right">Billed</th>
                          <th className="py-1.5 px-2 text-right">Paid ($)</th>
                          <th className="py-1.5 px-2 text-right">CO-45 (Write-off)</th>
                          <th className="py-1.5 px-2 text-right">PR (Patient Bal)</th>
                          <th className="py-1.5 px-1 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {allocations.map((a, idx) => (
                          <tr key={a.claimId}>
                            <td className="py-2 px-2">
                              <div className="font-mono font-medium text-grove-strong">{a.claimNumber}</div>
                              <div className="text-[11px] text-ink-3">{a.patientName}</div>
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              ${(a.billedCents / 100).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={(a.paidCents / 100).toFixed(2)}
                                onChange={(e) =>
                                  handleUpdateAllocation(idx, 'paidCents', Math.round(Number(e.target.value) * 100))
                                }
                                className="w-20 h-6 text-right font-mono font-semibold rounded border border-line bg-surface px-1 text-xs"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={(a.contractualAdjustmentCents / 100).toFixed(2)}
                                onChange={(e) =>
                                  handleUpdateAllocation(idx, 'contractualAdjustmentCents', Math.round(Number(e.target.value) * 100))
                                }
                                className="w-20 h-6 text-right font-mono rounded border border-line bg-surface px-1 text-xs text-neutral-600"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={(a.patientResponsibilityCents / 100).toFixed(2)}
                                onChange={(e) =>
                                  handleUpdateAllocation(idx, 'patientResponsibilityCents', Math.round(Number(e.target.value) * 100))
                                }
                                className="w-20 h-6 text-right font-mono rounded border border-line bg-surface px-1 text-xs text-warn"
                              />
                            </td>
                            <td className="py-2 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveAllocation(idx)}
                                className="text-danger hover:underline text-[11px]"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Live Reconciliation Footer */}
                <div className="mt-3 flex flex-wrap items-center justify-between border-t border-line pt-2 text-xs">
                  <div className="flex items-center gap-4">
                    <span>
                      Check Total: <strong className="font-mono">${(checkTotalCents / 100).toFixed(2)}</strong>
                    </span>
                    <span>
                      Total Allocated: <strong className="font-mono text-grove-strong">${(totalAllocatedPaidCents / 100).toFixed(2)}</strong>
                    </span>
                  </div>
                  <div>
                    {varianceCents === 0 && checkTotalCents > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-ok-soft px-2 py-0.5 font-medium text-ok">
                        ✓ Balanced ($0.00 Variance)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-2 py-0.5 font-medium text-danger">
                        Variance: ${(varianceCents / 100).toFixed(2)} (Must be $0.00)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (checkTotalCents > 0 && varianceCents !== 0)}
                  className="rounded-md bg-grove px-4 py-1.5 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {loading ? 'Posting Remittance…' : 'Post Remittance to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
