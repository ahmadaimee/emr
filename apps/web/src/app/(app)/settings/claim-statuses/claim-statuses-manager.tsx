'use client';

import { useState, useTransition } from 'react';
import { createClaimStatusAction, retireClaimStatusAction } from './actions';

const COLORS = [
  { value: 'slate', label: 'Slate', cls: 'bg-surface-sunken text-ink-2 border-line' },
  { value: 'amber', label: 'Amber', cls: 'bg-warn-soft text-warn border-warn/30' },
  { value: 'red', label: 'Red', cls: 'bg-danger-soft text-danger border-danger/30' },
  { value: 'blue', label: 'Blue', cls: 'bg-info-soft text-info border-info/30' },
  { value: 'purple', label: 'Purple', cls: 'bg-grove-soft text-grove-strong border-grove/30' },
];
const colorCls = (v: string) => COLORS.find((c) => c.value === v)?.cls ?? COLORS[0]!.cls;

export interface CustomStatusRow {
  id: string;
  label: string;
  color: string;
  active: boolean;
}

export function ClaimStatusesManager({ statuses }: { statuses: CustomStatusRow[] }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('slate');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set('label', label);
    fd.set('color', color);
    setError(null);
    startTransition(async () => {
      const res = await createClaimStatusAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLabel('');
      setColor('slate');
    });
  };

  const retire = (id: string) => {
    startTransition(async () => {
      await retireClaimStatusAction(id);
    });
  };

  const active = statuses.filter((s) => s.active);
  const retired = statuses.filter((s) => !s.active);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-surface-raised p-5">
        <h3 className="mb-1 text-sm font-semibold text-ink">Add a status</h3>
        <p className="mb-3 text-xs text-ink-3">
          A free-form label staff can attach to a claim — "On Hold", "Credentialing", "Needs Coding Review". It carries no
          automation: nothing submits, transitions, or closes a claim because of a custom status.
        </p>
        {error && <div className="mb-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>}
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-ink-2">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
              required
              placeholder="e.g. Credentialing"
              className="h-8 w-full rounded-md border border-line-strong bg-surface px-2.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Color</label>
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`h-8 rounded-md border px-2 text-[11px] ${c.cls} ${color === c.value ? 'ring-2 ring-offset-1 ring-grove' : ''}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={pending} className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50">
            {pending ? 'Adding…' : 'Add status'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-line bg-surface-raised p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">Active statuses ({active.length})</h3>
        {active.length === 0 ? (
          <p className="text-xs text-ink-3">No custom statuses yet — claims only show the system status until you add one.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {active.map((s) => (
              <div key={s.id} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${colorCls(s.color)}`}>
                {s.label}
                <button type="button" onClick={() => retire(s.id)} disabled={pending} className="text-[10px] opacity-60 hover:opacity-100" title="Retire this status">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {retired.length > 0 && (
        <div className="rounded-xl border border-line bg-surface-raised p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-3">Retired ({retired.length})</h3>
          <div className="flex flex-wrap gap-2">
            {retired.map((s) => (
              <div key={s.id} className="inline-flex items-center rounded-full border border-line px-3 py-1 text-xs text-ink-4 line-through">
                {s.label}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-4">Retired statuses no longer appear as a choice; claims already tagged with one keep it until changed.</p>
        </div>
      )}
    </div>
  );
}
