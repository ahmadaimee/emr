'use client';

import { useState } from 'react';
import { createCptCodeAction } from './actions';

export function NewCptModal() {
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
        <span>New CPT Code</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-line bg-surface-raised p-6 shadow-xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Add CPT / HCPCS Procedure</h2>
                <p className="text-xs text-ink-3">Add a procedure code with default standard charge and RVU weights.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-4 hover:text-ink text-sm font-semibold p-1">
                ✕
              </button>
            </div>

            <form
              action={async (fd) => {
                setSaving(true);
                try {
                  await createCptCodeAction(fd);
                  setOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-3">Procedure Code *</label>
                  <input
                    name="code"
                    required
                    placeholder="e.g. 99214 or G0438"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 font-mono text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink-3">Code System *</label>
                  <select
                    name="codeSystem"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs text-ink"
                  >
                    <option value="CPT">CPT (AMA Level I)</option>
                    <option value="HCPCS">HCPCS Level II (CMS National)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-3">Clinical Description *</label>
                <textarea
                  name="description"
                  required
                  rows={2}
                  placeholder="e.g. Office visit for evaluation and management of established patient, 30-39 minutes..."
                  className="mt-1 w-full rounded border border-line-strong bg-surface p-2 text-xs text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-3">Specialty / Category *</label>
                  <select
                    name="category"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs text-ink"
                  >
                    <option value="Evaluation & Management">Evaluation & Management (E&M)</option>
                    <option value="Preventive Medicine">Preventive Medicine</option>
                    <option value="Medicine & Injections">Medicine & Injections</option>
                    <option value="Laboratory & Pathology">Laboratory & Pathology</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Surgery & Minor Procedures">Surgery & Minor Procedures</option>
                    <option value="Telehealth">Telehealth</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-ink-3">Global Surgical Days</label>
                  <select
                    name="globalDays"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs text-ink"
                  >
                    <option value="0">0 Days (Minor / E&M)</option>
                    <option value="10">10 Days (Minor Surgery)</option>
                    <option value="90">90 Days (Major Surgery)</option>
                    <option value="XXX">XXX (Global Concept N/A)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-ink-3">Standard Charge ($ USD) *</label>
                  <input
                    name="charge"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="185.00"
                    required
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 font-semibold text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink-3">Work RVU (wRVU)</label>
                  <input
                    name="workRvu"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="1.50"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink-3">Total RVU</label>
                  <input
                    name="totalRvu"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="3.20"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="isAddOn" className="rounded accent-grove" />
                  <span className="text-xs text-ink-2">This is an Add-On code (e.g. +99417, never billed as primary)</span>
                </label>
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
                  {saving ? 'Adding...' : 'Add Procedure Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

