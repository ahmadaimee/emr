'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateStatementRunAction } from './actions';

export function GenerateRunModal({ practices }: { practices: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [practiceId, setPracticeId] = useState('');
  const [minimumBalance, setMinimumBalance] = useState('5.00');
  const [dueInDays, setDueInDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ statementCount: number; totalBalanceCents: number } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await generateStatementRunAction({
      practiceId,
      minimumBalanceCents: Math.round((Number(minimumBalance) || 0) * 100),
      dueInDays: Number(dueInDays) || 30,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.data);
    router.refresh();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs">
        + Generate Statement Run
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-display text-base font-semibold text-ink">Generate Statement Run</h3>
              <button onClick={() => { setOpen(false); setResult(null); }} className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken">✕</button>
            </div>
            <p className="mt-2 text-xs text-ink-3">Builds one statement per patient whose ledger balance is at or above the minimum, itemized from their patient-responsibility entries.</p>

            {result && (
              <div className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
                Generated {result.statementCount} statement{result.statementCount === 1 ? '' : 's'} totaling ${(result.totalBalanceCents / 100).toFixed(2)}.
              </div>
            )}
            {error && <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}

            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Practice *</label>
                <select required value={practiceId} onChange={(e) => setPracticeId(e.target.value)} className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs">
                  <option value="">Select a practice…</option>
                  {practices.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Minimum balance ($)</label>
                  <input type="number" step="0.01" min="0" value={minimumBalance} onChange={(e) => setMinimumBalance(e.target.value)} className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs font-mono" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Due in (days)</label>
                  <input type="number" min="1" value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-xs text-ink-2 hover:bg-surface-sunken">Close</button>
                <button type="submit" disabled={loading} className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50">
                  {loading ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
