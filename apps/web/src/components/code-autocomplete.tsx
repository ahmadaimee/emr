'use client';

import { useEffect, useRef, useState } from 'react';

export interface CodeMatch {
  code: string;
  description: string;
  billable?: boolean;
}

/**
 * A code-entry field that verifies what the user typed against a real reference list
 * (ICD-10-CM or the org's loaded procedure codes) and shows the matched description,
 * so a biller can confirm they picked the right code without leaving the field.
 */
export function CodeAutocomplete({
  value,
  onChange,
  search,
  placeholder,
  className,
  required,
}: {
  value: string;
  onChange: (code: string) => void;
  search: (query: string) => Promise<CodeMatch[]>;
  placeholder?: string;
  className: string;
  required?: boolean;
}) {
  const [matches, setMatches] = useState<CodeMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<CodeMatch | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    // If the exact code the user landed on already has a description on file, show it
    // without waiting for another keystroke (e.g. after selecting from the list, or on
    // initial edit of an existing line).
    let cancelled = false;
    if (!value.trim()) {
      setConfirmed(null);
      return;
    }
    search(value).then((results) => {
      if (cancelled) return;
      const exact = results.find((r) => r.code.toUpperCase() === value.trim().toUpperCase());
      setConfirmed(exact ?? null);
    });
    return () => {
      cancelled = true;
    };
    // Only re-check on code changes committed by selection/blur, not every keystroke —
    // the dropdown below already covers live typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleInput = (v: string) => {
    onChange(v.toUpperCase());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setMatches([]);
      setOpen(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await search(v);
      if (requestId === requestIdRef.current) {
        setMatches(results);
        setOpen(true);
        setLoading(false);
      }
    }, 250);
  };

  const select = (m: CodeMatch) => {
    onChange(m.code);
    setConfirmed(m);
    setOpen(false);
    setMatches([]);
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => matches.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="off"
      />
      {open && (loading || matches.length > 0) && (
        <div className="absolute z-20 mt-1 max-h-56 w-max min-w-full overflow-y-auto rounded-md border border-line-strong bg-surface-raised shadow-lg">
          {loading && matches.length === 0 ? (
            <div className="px-2.5 py-1.5 text-[11px] text-ink-3">Searching…</div>
          ) : (
            matches.map((m) => (
              <button
                key={m.code}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(m)}
                className="block w-full whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] hover:bg-surface-sunken"
              >
                <span className="font-mono font-semibold text-grove-strong">{m.code}</span>{' '}
                <span className="text-ink-2">{m.description}</span>
                {m.billable === false && <span className="ml-1.5 text-[10px] font-medium text-danger">not billable</span>}
              </button>
            ))
          )}
        </div>
      )}
      {confirmed && !open && (
        <p className={`mt-0.5 text-[10px] ${confirmed.billable === false ? 'text-danger' : 'text-ok'}`}>
          {confirmed.billable === false ? '⚠ ' : '✓ '}
          {confirmed.description}
        </p>
      )}
    </div>
  );
}
