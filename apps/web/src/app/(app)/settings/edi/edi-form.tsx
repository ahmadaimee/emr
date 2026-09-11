'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateEdiSettingsAction } from './actions';

const field = 'w-full h-8 rounded-md border border-line-strong bg-surface px-2 font-mono text-xs text-ink focus:border-grove focus:outline-hidden';

export function EdiForm({ org }: { org: { ediSubmitterId: string; ediSubmitterName: string; ediUsageIndicator: 'T' | 'P' } }) {
  const router = useRouter();
  const [submitterId, setSubmitterId] = useState(org.ediSubmitterId);
  const [submitterName, setSubmitterName] = useState(org.ediSubmitterName);
  const [usageIndicator, setUsageIndicator] = useState<'T' | 'P'>(org.ediUsageIndicator);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingProduction, setConfirmingProduction] = useState(false);

  const switchingToProduction = usageIndicator === 'P' && org.ediUsageIndicator !== 'P';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (switchingToProduction && !confirmingProduction) {
      setConfirmingProduction(true);
      return;
    }
    setConfirmingProduction(false);
    setSaving(true);
    setError(null);
    const res = await updateEdiSettingsAction({ ediSubmitterId: submitterId, ediSubmitterName: submitterName, ediUsageIndicator: usageIndicator });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-xs">
      {saved && <div className="rounded-md border border-ok/30 bg-ok/10 px-2.5 py-1.5 text-[11px] font-medium text-ok">Saved.</div>}
      {error && <div className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[11px] font-medium text-danger">{error}</div>}

      <div>
        <label className="mb-1 block font-medium text-ink-2">Submitter ID (ISA06 / GS02) *</label>
        <input value={submitterId} onChange={(e) => setSubmitterId(e.target.value)} required maxLength={15} className={field} />
        <p className="mt-1 text-[10px] text-ink-4">Assigned by the clearinghouse when your trading-partner agreement is set up.</p>
      </div>
      <div>
        <label className="mb-1 block font-medium text-ink-2">Submitter Name (NM1*41)</label>
        <input value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} maxLength={60} className={field} />
      </div>
      <div>
        <label className="mb-1 block font-medium text-ink-2">Usage Indicator (ISA15)</label>
        <select value={usageIndicator} onChange={(e) => { setUsageIndicator(e.target.value as 'T' | 'P'); setConfirmingProduction(false); }} className={field}>
          <option value="T">T — Test</option>
          <option value="P">P — Production</option>
        </select>
        <p className="mt-1 text-[10px] text-ink-4">Sending Production before the clearinghouse and payers approve it gets claims rejected or worse.</p>
      </div>

      {confirmingProduction && (
        <div className="rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-[11px] text-warn">
          Switching to Production sends real claims to real payers. Only confirm this after the clearinghouse and every
          payer on this list have approved production submission.
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-line pt-3">
        {confirmingProduction && (
          <button type="button" onClick={() => setConfirmingProduction(false)} className="h-8 rounded-md px-3 text-xs text-ink-2 hover:bg-surface-sunken">
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving} className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50">
          {saving ? 'Saving…' : confirmingProduction ? 'Confirm — go to Production' : 'Save'}
        </button>
      </div>
    </form>
  );
}
