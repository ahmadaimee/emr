'use client';

import { useState } from 'react';
import { recordPaymentAction } from './actions';

interface PatientOption {
  id: string;
  name: string;
  mrn: string;
  balanceCents: number;
}

export function CollectPaymentModal({ patients }: { patients: PatientOption[] }) {
  const [open, setOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? '');
  const [amount, setAmount] = useState('50.00');
  const [source, setSource] = useState('patient_card');
  const [saving, setSaving] = useState(false);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-ink-inverse hover:bg-grove-strong transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Collect Payment</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface-raised p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Collect Patient Payment</h2>
                <p className="text-xs text-ink-3">Record a co-pay, coinsurance, or balance payment.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-4 hover:text-ink text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form
              action={async (fd) => {
                setSaving(true);
                try {
                  await recordPaymentAction(fd);
                  setOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
              className="mt-4 space-y-4"
            >
              {/* Patient Selector */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Patient</label>
                <select
                  name="patientId"
                  value={selectedPatientId}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value);
                    const pat = patients.find((p) => p.id === e.target.value);
                    if (pat && pat.balanceCents > 0) {
                      setAmount((pat.balanceCents / 100).toFixed(2));
                    }
                  }}
                  required
                  className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.mrn}) — Balance: ${(p.balanceCents / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Payment Amount ($ USD)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-sm text-ink-3">$</span>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="h-9 w-full rounded-md border border-line-strong bg-surface pl-7 pr-3 text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Payment Method / Source</label>
                <select
                  name="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                >
                  <option value="patient_card">Credit / Debit Card (Swipe/Chip)</option>
                  <option value="patient_cash">Cash (Front Desk Copay)</option>
                  <option value="patient_check">Paper Check</option>
                  <option value="patient_ach">ACH Direct Debit</option>
                </select>
              </div>

              {/* Reference / Auth # */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Reference / Auth / Check #</label>
                <input
                  name="referenceNumber"
                  placeholder={source === 'patient_card' ? 'AUTH_19820' : source === 'patient_check' ? 'Check #1042' : 'Receipt #'}
                  className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Notes / Allocation</label>
                <input
                  name="notes"
                  defaultValue="Point-of-care copay payment"
                  className="mt-1 h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-ink-inverse hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {saving ? 'Posting to Ledger...' : `Collect $${amount}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
