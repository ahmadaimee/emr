'use client';

import { useEffect, useRef, useState } from 'react';
import { NewPatientModal } from '../patients/new-patient-modal';
import { searchPatients, type PatientMatch } from '@/lib/patient-search';

export interface PatientOption {
  id: string;
  name: string;
}

/**
 * Search runs server-side once the user has typed at least 2 characters — matching
 * name, MRN, date of birth, last-4 SSN, or subscriber/member ID — rather than shipping
 * every patient's DOB/SSN to the browser to filter locally. Before that, it shows the
 * short initial list the claims page already loaded, and offers registering a new
 * patient inline when the one wanted isn't found, without leaving the claim form.
 */
export function PatientPicker({
  patients,
  practices,
  value,
  onChange,
  onPatientCreated,
}: {
  patients: PatientOption[];
  practices: Array<{ id: string; name: string }>;
  value: string;
  onChange: (patientId: string) => void;
  onPatientCreated: (patient: PatientOption) => void;
}) {
  const selected = patients.find((p) => p.id === value);
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PatientMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(selected?.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    setOpen(true);
    if (value) onChange('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchPatients(v);
      if (requestId === requestIdRef.current) {
        setResults(found);
        setLoading(false);
      }
    }, 250);
  };

  const matches: (PatientMatch | PatientOption)[] =
    results ?? (query.trim() ? patients.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())) : patients).slice(0, 20);

  return (
    <div className="relative" ref={containerRef}>
      <input
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search by name, MRN, DOB, SSN last 4, or subscriber ID…"
        required={!value}
        className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-line-strong bg-surface-raised shadow-lg">
          {loading && matches.length === 0 ? (
            <div className="px-2.5 py-2 text-[11px] text-ink-3">Searching…</div>
          ) : matches.length === 0 ? (
            <div className="px-2.5 py-2 text-[11px] text-ink-3">No patient matches "{query}".</div>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setQuery(p.name);
                  setOpen(false);
                }}
                className="block w-full whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] text-ink hover:bg-surface-sunken"
              >
                {p.name}
                {'mrn' in p && p.mrn ? <span className="ml-1.5 text-ink-4">MRN {p.mrn}</span> : null}
                {'dateOfBirth' in p && p.dateOfBirth ? <span className="ml-1.5 text-ink-4">DOB {p.dateOfBirth}</span> : null}
              </button>
            ))
          )}
          <div className="border-t border-line">
            <NewPatientModal
              practices={practices}
              onCreated={(p) => {
                onPatientCreated(p);
                onChange(p.id);
                setQuery(p.name);
                setOpen(false);
              }}
              trigger={(openModal) => (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openModal}
                  className="block w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-grove-strong hover:bg-surface-sunken"
                >
                  + Register a new patient…
                </button>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
