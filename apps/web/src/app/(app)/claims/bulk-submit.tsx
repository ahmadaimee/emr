'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { bulkSubmitAction } from './actions';

/**
 * Bulk actions are first-class. Select rows with the checkboxes (or `x` on a focused
 * row), then submit everything that is ready in one go. Per-item results, never
 * all-or-nothing.
 */
export function BulkSubmit() {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{ succeeded: number; failed: number; errors: string[] } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const sync = () => setSelected([...document.querySelectorAll<HTMLInputElement>('input[name="claim"]:checked')].map((i) => i.value));
    const onChange = (e: Event) => {
      if ((e.target as HTMLElement).matches?.('input[name="claim"]')) sync();
    };
    const onKey = (e: KeyboardEvent) => {
      const row = (e.target as HTMLElement)?.closest?.('tr');
      if (!row || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'x') {
        const box = row.querySelector<HTMLInputElement>('input[name="claim"]');
        if (box) {
          box.checked = !box.checked;
          row.dataset['selected'] = String(box.checked);
          sync();
        }
      } else if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const next = (e.key === 'j' ? row.nextElementSibling : row.previousElementSibling) as HTMLElement | null;
        next?.focus();
      } else if (e.key === 'Enter') {
        row.querySelector<HTMLAnchorElement>('a')?.click();
      }
    };
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('change', onChange);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const submit = () =>
    start(async () => {
      const r = await bulkSubmitAction(selected);
      setResult(r);
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      {result ? (
        <span className="text-xs text-ink-3">
          <span className="text-ok">{result.succeeded} submitted</span>{result.failed ? <>, <span className="text-danger">{result.failed} failed</span></> : null}
          {result.errors[0] ? <span className="ml-2 text-danger" title={result.errors.join('\n')}>— {result.errors[0]}</span> : null}
        </span>
      ) : null}
      <span className="text-xs text-ink-3">{selected.length ? `${selected.length} selected` : <><span className="g-kbd">x</span> select · <span className="g-kbd">j</span>/<span className="g-kbd">k</span> move</>}</span>
      <Button variant="primary" disabled={selected.length === 0 || pending} onClick={submit}>
        {pending ? 'Submitting…' : `Submit ${selected.length || ''}`.trim()}
      </Button>
    </div>
  );
}
