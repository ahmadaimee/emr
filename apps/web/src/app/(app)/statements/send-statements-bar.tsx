'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendStatementsAction } from './actions';

export function SendStatementsBar({ draftIds }: { draftIds: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const sync = () => setSelected([...document.querySelectorAll<HTMLInputElement>('input[name="stmt"]:checked')].map((i) => i.value));
    document.addEventListener('change', sync);
    return () => document.removeEventListener('change', sync);
  }, []);

  if (draftIds.length === 0) return null;

  const send = () =>
    startTransition(async () => {
      await sendStatementsAction(selected);
      setSelected([]);
      router.refresh();
    });

  return (
    <div className="flex items-center justify-between border-b border-line bg-surface-sunken/30 px-3 py-2 text-xs">
      <span className="text-ink-3">{selected.length ? `${selected.length} selected` : `${draftIds.length} draft statement${draftIds.length === 1 ? '' : 's'} ready to send`}</span>
      <button
        type="button"
        onClick={send}
        disabled={selected.length === 0 || pending}
        className="h-7 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50"
      >
        {pending ? 'Sending…' : `Send ${selected.length || ''}`.trim()}
      </button>
    </div>
  );
}
