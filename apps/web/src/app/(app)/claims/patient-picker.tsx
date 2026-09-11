'use client';

import { useEffect, useRef, useState } from 'react';
import { NewPatientModal } from '../patients/new-patient-modal';

export interface PatientOption {
  id: string;
  name: string;
}

/**
 * Searches the already-loaded patient list locally (no round trip — the claims page
 * already fetches up to 300 patients for this form) and offers registering a new
 * patient inline when the one the user wants isn't found, without leaving the claim
 * form.
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
  const containerRef = useRef<HTMLDivElement>(null);

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

  const matches = query.trim()
    ? patients.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 20)
    : patients.slice(0, 20);

  return (
    <div className="relative" ref={containerRef}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search by patient name or MRN…"
        required={!value}
        className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-line-strong bg-surface-raised shadow-lg">
          {matches.length === 0 ? (
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
