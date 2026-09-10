'use client';

import { useState } from 'react';
import { createDxCodeAction } from './actions';

export function NewDxModal() {
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
        <span>New Diagnosis Code</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-line bg-surface-raised p-6 shadow-xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Add ICD-10 Diagnosis (Dx)</h2>
                <p className="text-xs text-ink-3">Add an ICD-10-CM diagnosis code with billability and favorite settings.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-4 hover:text-ink text-sm font-semibold p-1">
                ✕
              </button>
            </div>

            <form
              action={async (fd) => {
                setSaving(true);
                try {
                  await createDxCodeAction(fd);
                  setOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-3">ICD-10-CM Code *</label>
                  <input
                    name="code"
                    required
                    placeholder="e.g. E11.9 or I10"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 font-mono text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink-3">Clinical Category *</label>
                  <select
                    name="category"
                    className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs text-ink"
                  >
                    <option value="Endocrine & Metabolic">Endocrine & Metabolic</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Respiratory">Respiratory</option>
                    <option value="Musculoskeletal">Musculoskeletal</option>
                    <option value="Preventive Medicine">Preventive Medicine</option>
                    <option value="Behavioral Health">Behavioral Health</option>
                    <option value="Gastrointestinal">Gastrointestinal</option>
                    <option value="Genitourinary">Genitourinary</option>
                    <option value="General Medicine">General Medicine</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-3">Clinical Description *</label>
                <textarea
                  name="description"
                  required
                  rows={2}
                  placeholder="e.g. Type 2 diabetes mellitus without complications..."
                  className="mt-1 w-full rounded border border-line-strong bg-surface p-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-3">Dual Coding / Specificity Guidance Notes</label>
                <input
                  name="dualCodingNote"
                  placeholder="e.g. Code first underlying cause; use additional code for insulin use (Z79.4)..."
                  className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-line">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="validAsPrincipal" defaultChecked className="rounded accent-grove" />
                  <span className="text-xs text-ink-2">Valid as Principal Diagnosis (Box 21 line A)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="favorite" defaultChecked className="rounded accent-grove" />
                  <span className="text-xs text-ink-2">Add to &quot;★ My Favorite Diagnoses / Superbill Quick-Pick&quot; list</span>
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
                  {saving ? 'Adding...' : 'Add Diagnosis Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

