'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Command {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  keywords?: string;
}

const COMMANDS: Command[] = [
  { id: 'dashboard', label: 'Go to Dashboard', href: '/dashboard', hint: 'G D' },
  { id: 'claims', label: 'Go to Claims', href: '/claims', hint: 'G C' },
  { id: 'claims-review', label: 'Claims needing review', href: '/claims?status=needs_review', keywords: 'scrub errors' },
  { id: 'claims-ready', label: 'Claims ready to submit', href: '/claims?status=ready' },
  { id: 'patients', label: 'Go to Patients', href: '/patients', hint: 'G P' },
  { id: 'eligibility', label: 'Go to Eligibility', href: '/eligibility', hint: 'G E', keywords: 'batch verify 270 271' },
  { id: 'eligibility-new', label: 'Start a batch eligibility run', href: '/eligibility?new=1' },
  { id: 'queues', label: 'Go to Work queues', href: '/queues', hint: 'G Q', keywords: 'tasks denials' },
  { id: 'denials', label: 'Denials queue', href: '/queues?category=denial' },
  { id: 'rejections', label: 'Clearinghouse rejections', href: '/queues?category=rejection' },
  { id: 'underpayments', label: 'Underpayments', href: '/queues?category=underpayment' },
  { id: 'timely', label: 'Timely filing at risk', href: '/queues?category=timely_filing' },
  { id: 'remittances', label: 'Go to Remittances', href: '/remittances', hint: 'G R', keywords: '835 era' },
  { id: 'payments', label: 'Go to Payments & Patient Billing', href: '/payments', hint: 'G Y', keywords: 'patient payments copay card cash' },
  { id: 'reports', label: 'Go to Reports', href: '/reports' },
  { id: 'automation', label: 'Automation settings', href: '/settings/automation', keywords: 'pause kill switch' },
  { id: 'audit', label: 'Audit log', href: '/settings/audit', keywords: 'compliance phi access' },
];

/**
 * ⌘K. Jump anywhere, run anything. Typing a claim number (GRV-…) or a name searches.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const lastKey = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (typing || open) return;
      // Two-key chords: G then D/C/P/E/Q/R.
      const now = Date.now();
      if (lastKey.current && lastKey.current.key === 'g' && now - lastKey.current.at < 800) {
        const map: Record<string, string> = { d: '/dashboard', c: '/claims', p: '/patients', e: '/eligibility', q: '/queues', r: '/remittances' };
        const href = map[e.key.toLowerCase()];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        lastKey.current = null;
        return;
      }
      lastKey.current = { key: e.key.toLowerCase(), at: now };
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, router]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? COMMANDS.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(needle)) : COMMANDS;
    if (needle && /^grv-?\d+/i.test(needle)) list.unshift({ id: 'claim-search', label: `Open claim ${needle.toUpperCase()}`, href: `/claims?q=${encodeURIComponent(needle)}` });
    else if (needle.length >= 2 && list.length < 3) list.push({ id: 'patient-search', label: `Search patients for “${q.trim()}”`, href: `/patients?q=${encodeURIComponent(q.trim())}` });
    return list.slice(0, 12);
  }, [q]);

  if (!open) return null;

  const go = (c: Command) => {
    setOpen(false);
    if (c.href) router.push(c.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--g-surface-overlay)] pt-[12vh] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-surface-raised shadow-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) go(results[active]!);
            else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Jump to a page, a claim number, or a patient…"
          className="h-12 w-full border-b border-line bg-transparent px-4 text-base outline-none placeholder:text-ink-4"
        />
        <ul className="max-h-80 overflow-auto py-1">
          {results.map((c, i) => (
            <li key={c.id}>
              <button onMouseEnter={() => setActive(i)} onClick={() => go(c)} className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${i === active ? 'bg-grove-soft text-ink' : 'text-ink-2'}`}>
                <span>{c.label}</span>
                {c.hint ? <span className="g-kbd">{c.hint}</span> : null}
              </button>
            </li>
          ))}
          {results.length === 0 ? <li className="px-4 py-3 text-sm text-ink-3">Nothing matches.</li> : null}
        </ul>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-xs text-ink-3">
          <span><span className="g-kbd">↑↓</span> navigate</span>
          <span><span className="g-kbd">↵</span> open</span>
          <span><span className="g-kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
