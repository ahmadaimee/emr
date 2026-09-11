'use client';

import { useState, useTransition } from 'react';
import { setCustomStatusAction } from '../actions';

const COLOR_CLASSES: Record<string, string> = {
  slate: 'bg-surface-sunken text-ink-2 border-line',
  amber: 'bg-warn-soft text-warn border-warn/30',
  red: 'bg-danger-soft text-danger border-danger/30',
  blue: 'bg-info-soft text-info border-info/30',
  purple: 'bg-grove-soft text-grove-strong border-grove/30',
};

const pillCls = (color: string) => `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${COLOR_CLASSES[color] ?? COLOR_CLASSES.slate}`;

/**
 * A sticky note next to the real status pill — never drives automation, never gates a
 * transition. Purely "what is a human doing with this claim right now."
 */
export function CustomStatusPicker({
  claimId,
  currentId,
  options,
}: {
  claimId: string;
  currentId: string | null;
  options: Array<{ id: string; label: string; color: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentId);
  const [error, setError] = useState<string | null>(null);

  const current = options.find((o) => o.id === value);

  const choose = (id: string | null) => {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const res = await setCustomStatusAction(claimId, id);
      if (!res.ok) {
        setError(res.error ?? 'Failed to update.');
        return;
      }
      setValue(id);
    });
  };

  if (options.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={current ? pillCls(current.color) : 'inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11px] font-medium text-ink-3 hover:bg-surface-sunken'}
      >
        {pending ? 'Saving…' : current ? current.label : '+ Tag'}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-line bg-surface-raised py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-surface-sunken"
            >
              <span className={pillCls(o.color)}>{o.label}</span>
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => choose(null)}
              className="mt-1 w-full border-t border-line px-2.5 py-1.5 text-left text-xs text-ink-3 hover:bg-surface-sunken"
            >
              Clear tag
            </button>
          )}
        </div>
      )}
      {error && <div className="absolute left-0 top-full mt-1 whitespace-nowrap text-[10px] text-danger">{error}</div>}
    </div>
  );
}
