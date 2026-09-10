'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProviderAction, setProviderStatusAction } from './actions';

export function ProviderStatusSelect({
  id,
  status,
  statuses,
}: {
  id: string;
  status: string;
  statuses: Array<{ value: string; label: string; hint: string }>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (next: string) => {
    const previous = value;
    setValue(next);
    setBusy(true);
    setError(null);
    const res = await setProviderStatusAction(id, next);
    setBusy(false);
    if (!res.ok) {
      setValue(previous);
      setError(res.error);
      return;
    }
    router.refresh();
  };

  const tone =
    value === 'active'
      ? 'border-ok/30 bg-ok-soft text-ok'
      : value === 'suspended'
        ? 'border-danger/30 bg-danger-soft text-danger'
        : value === 'terminated'
          ? 'border-line bg-surface-sunken text-ink-4'
          : 'border-warn/30 bg-warn-soft text-warn';

  return (
    <div>
      <select
        value={value}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        title={statuses.find((s) => s.value === value)?.hint}
        className={`h-6 rounded-md border px-1.5 text-[11px] font-medium capitalize focus:border-grove focus:outline-hidden disabled:opacity-60 ${tone}`}
      >
        {statuses.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {error ? <div className="mt-1 max-w-[160px] text-[10px] text-danger">{error}</div> : null}
    </div>
  );
}

export function DeleteProviderButton({
  id,
  name,
  references,
}: {
  id: string;
  name: string;
  references: { claims: number; appointments: number; total: number; deletable: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const res = await deleteProviderAction(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-line-strong px-2 py-0.5 text-[11px] font-medium text-ink-3 hover:bg-danger-soft hover:text-danger"
      >
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-md rounded-xl border border-line bg-surface-raised p-5 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-ink">Delete {name}?</h3>

            {references.deletable ? (
              <p className="mt-2 text-sm text-ink-2">
                Nothing references this provider, so the record can be removed. This cannot be undone.
              </p>
            ) : (
              <div className="mt-2 space-y-2 text-sm text-ink-2">
                <p>This provider cannot be deleted — their NPI is already on submitted work:</p>
                <ul className="ml-4 list-disc text-xs text-ink-3">
                  {references.claims > 0 ? <li>{references.claims} claim{references.claims === 1 ? '' : 's'}</li> : null}
                  {references.appointments > 0 ? (
                    <li>{references.appointments} appointment{references.appointments === 1 ? '' : 's'}</li>
                  ) : null}
                </ul>
                <p className="text-xs">
                  Those records must keep resolving for appeals, corrected claims and the audit trail. Set the
                  provider to <span className="font-medium">Terminated</span> instead — they stop being schedulable
                  but their history stays intact.
                </p>
              </div>
            )}

            {error ? (
              <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
              <button onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-xs text-ink-2 hover:bg-surface-sunken">
                Cancel
              </button>
              {references.deletable ? (
                <button
                  onClick={confirm}
                  disabled={busy}
                  className="h-8 rounded-md bg-danger px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? 'Deleting…' : 'Delete provider'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
