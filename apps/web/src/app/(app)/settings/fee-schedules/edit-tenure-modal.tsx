'use client';

import { useState } from 'react';
import { updateFeeScheduleTenureAction } from './actions';

export interface FeeSchedule {
  id: string;
  name: string;
  scheduleType: string;
  payerName: string;
  effectiveDate: string;
  terminationDate?: string | null;
  isDefault?: boolean;
  notes?: string;
  linesCount?: number;
}

export function EditTenureModal({
  schedule,
  isOpen,
  onClose,
}: {
  schedule: FeeSchedule;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(schedule.effectiveDate || '');
  const [endDate, setEndDate] = useState(schedule.terminationDate || '');
  const [isDefault, setIsDefault] = useState(Boolean(schedule.isDefault));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink">Edit Effective Tenure & DOS Range</h2>
              {schedule.isDefault && (
                <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-semibold">
                  ★ Default
                </span>
              )}
            </div>
            <p className="text-xs text-ink-3">
              Configure Date of Service (DOS) claim matching tenure and default chargemaster status.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-sm font-semibold p-1">
            ✕
          </button>
        </div>

        <form
          action={async (fd) => {
            setSaving(true);
            try {
              await updateFeeScheduleTenureAction(fd);
              onClose();
            } finally {
              setSaving(false);
            }
          }}
          className="mt-4 space-y-3.5 text-xs"
        >
          <input type="hidden" name="id" value={schedule.id} />

          <div>
            <label className="block font-medium text-ink-3">Fee Schedule Name *</label>
            <input
              name="name"
              defaultValue={schedule.name}
              required
              className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink-3">Associated Payer *</label>
              <input
                name="payerName"
                defaultValue={schedule.payerName}
                required
                className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block font-medium text-ink-3">Schedule Type *</label>
              <select
                name="scheduleType"
                defaultValue={schedule.scheduleType}
                className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs text-ink"
              >
                <option value="allowed">Contracted Allowed Rate (PPO/HMO)</option>
                <option value="charge">Standard Chargemaster (Billed)</option>
                <option value="medicare">Medicare RBRVS / MPFS</option>
              </select>
            </div>
          </div>

          {/* DOS Tenure Range Box */}
          <div className="rounded-lg border border-grove/40 bg-grove-soft/20 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-grove-strong">
              <span>Date of Service (DOS) Effective Tenure Window</span>
            </div>
            <p className="text-[11px] text-ink-3">
              Claims whose Date of Service (DOS) falls within this range will automatically be priced using this fee schedule.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-ink-2">
                  DOS Start Date (Effective From) *
                </label>
                <input
                  name="effectiveDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-ink-2">
                  DOS End Date (Effective Through)
                </label>
                <input
                  name="terminationDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Leave empty for ongoing"
                  className="mt-1 h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-xs text-ink font-semibold"
                />
                <span className="text-[10px] text-ink-4 mt-0.5 block">Leave blank for open-ended / ongoing</span>
              </div>
            </div>

            {/* Live Tenure Preview */}
            <div className="rounded bg-surface-raised border border-line p-2 text-[11px] text-ink flex items-center gap-2">
              <span className="text-grove-strong font-bold">Matching Window:</span>
              <span>
                DOS from <strong className="font-mono">{startDate || 'Any'}</strong> to{' '}
                <strong className="font-mono">{endDate || 'Ongoing'}</strong>
              </span>
            </div>
          </div>

          {/* Default Status Checkbox */}
          <div className="rounded border border-line bg-surface-raised p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="mt-0.5 rounded accent-grove"
              />
              <div>
                <span className="text-xs font-semibold text-ink">
                  ★ Set as Default Fee Schedule
                </span>
                <p className="text-[11px] text-ink-3 mt-0.5">
                  Make this the default chargemaster schedule for encounters when no specific payer contract overrides it.
                </p>
              </div>
            </label>
          </div>

          <div>
            <label className="block font-medium text-ink-3">Tenure Notes & Justification</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={schedule.notes || ''}
              placeholder="e.g. 2026 Commercial fee schedule update aligned with new payer contract amendment..."
              className="mt-1 w-full rounded border border-line-strong bg-surface p-2 text-xs text-ink"
            />
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-8 rounded bg-grove px-4 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving Tenure...' : 'Save Tenure & Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
