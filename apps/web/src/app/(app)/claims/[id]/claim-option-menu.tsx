'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { checkClaimStatusNowAction } from './follow-up-actions';

export function ClaimOptionMenu({ claimId }: { claimId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleCheckStatus = () => {
    setOpen(false);
    setResult(null);
    startTransition(async () => {
      const r = await checkClaimStatusNowAction(claimId);
      setResult(r.ok ? { ok: true, text: r.statusDescription ?? 'Status check complete.' } : { ok: false, text: r.error });
    });
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <div className="flex items-center gap-2">
        {result && <span className={`text-xs font-medium ${result.ok ? 'text-ok' : 'text-danger'}`}>{result.text}</span>}
        <button
          type="button"
          disabled={isPending}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-raised px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors disabled:opacity-50"
        >
          <span>{isPending ? 'Checking…' : 'Option'}</span>
          <span className="text-[10px] opacity-70">▾</span>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-64 rounded-lg border border-line-strong bg-surface-raised py-1 shadow-xl text-xs text-ink animate-in fade-in zoom-in-95">
          <button type="button" onClick={handleCheckStatus} className="w-full text-left px-3 py-2 hover:bg-surface-sunken transition-colors">
            Check Claim Status (276/277)
          </button>
          <div className="border-t border-line my-1" />
          <div className="px-3 py-2 text-ink-4 cursor-not-allowed" title="Not yet available">Convert Claim Type</div>
          <div className="px-3 py-2 text-ink-4 cursor-not-allowed" title="Not yet available">Split Claim</div>
          <div className="px-3 py-2 text-ink-4 cursor-not-allowed" title="Not yet available">Reassign Provider Numbers</div>
        </div>
      )}
    </div>
  );
}
