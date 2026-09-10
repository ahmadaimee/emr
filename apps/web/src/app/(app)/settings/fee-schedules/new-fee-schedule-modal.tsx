'use client';

import { useState } from 'react';
import { createFeeScheduleAction } from './actions';

export function NewFeeScheduleModal() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
        <span>New Fee Schedule</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-line bg-surface-raised p-6 shadow-xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Create Payer Fee Schedule</h2>
                <p className="text-xs text-ink-3">Configure contracted allowable pricing or custom chargemaster rate sheet.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-4 hover:text-ink text-sm font-semibold p-1">
                ✕
              </button>
            </div>

            <form
              action={async (fd) => {
                setSaving(true);
                try {
                  await createFeeScheduleAction(fd);
                  setOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-ink-3">Fee Schedule Name *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Blue Cross Blue Shield PPO 2026 Contract"
                  className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-3">Schedule Type *</label>
                  <select
                    name="scheduleType"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs text-ink"
                  >
                    <option value="allowed">Contracted Allowed Rate (PPO/HMO)</option>
                    <option value="charge">Standard Chargemaster (Billed)</option>
                    <option value="medicare">Medicare RBRVS / MPFS</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-ink-3">Associated Payer *</label>
                  <input
                    name="payerName"
                    required
                    placeholder="e.g. Blue Cross Blue Shield"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-3">Effective Start Date *</label>
                  <input
                    name="effectiveDate"
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    required
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink-3">Contract Expiration Date</label>
                  <input
                    name="terminationDate"
                    type="date"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-3">Contract Notes & Specifications</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. 115% of 2026 Medicare Part B non-facility rates for primary care E&M codes..."
                  className="mt-1 w-full rounded border border-line-strong bg-surface p-2 text-xs text-ink"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 rounded bg-grove px-4 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Fee Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

