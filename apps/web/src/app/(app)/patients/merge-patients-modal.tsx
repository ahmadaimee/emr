'use client';

import { useState } from 'react';
import { mergePatientsAction } from './actions';

interface PatientSummary {
  id: string;
  name: string;
  mrn: string;
  dob?: string;
}

export function MergePatientsModal({
  patients,
  initialPrimaryId,
}: {
  patients: PatientSummary[];
  initialPrimaryId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [primaryId, setPrimaryId] = useState(initialPrimaryId ?? patients[0]?.id ?? '');
  const [duplicateId, setDuplicateId] = useState(
    patients.find((p) => p.id !== (initialPrimaryId ?? patients[0]?.id))?.id ?? ''
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const primaryPatient = patients.find((p) => p.id === primaryId);
  const duplicatePatient = patients.find((p) => p.id === duplicateId);

  const handleMerge = async () => {
    if (!primaryId || !duplicateId || primaryId === duplicateId) return;
    setLoading(true);
    try {
      await mergePatientsAction(primaryId, duplicateId, notes);
      setOpen(false);
      setConfirmed(false);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to merge patient profiles');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-raised px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
      >
        <span>Merge Duplicate Profiles</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3.5">
              <div>
                <h2 className="text-base font-semibold text-ink">
                  Master Patient Index (MPI) Profile Merge
                </h2>
                <p className="text-xs text-ink-3 mt-0.5">
                  Consolidate duplicate patient records into a single authoritative primary profile.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-4 hover:text-ink text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Profile Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Survivor Profile */}
                <div className="rounded-lg border-2 border-grove/50 bg-grove-soft/10 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-grove-strong">
                      Primary Profile (Survivor)
                    </span>
                    <span className="rounded bg-grove/20 px-1.5 py-0.5 text-[9px] font-bold text-grove-strong">
                      TARGET RECORD
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-3">
                    This profile retains its MRN, identity, and receives all merged records.
                  </p>
                  <select
                    value={primaryId}
                    onChange={(e) => {
                      setPrimaryId(e.target.value);
                      if (e.target.value === duplicateId) {
                        setDuplicateId(patients.find((p) => p.id !== e.target.value)?.id ?? '');
                      }
                    }}
                    className="mt-2.5 w-full rounded-md border border-grove/40 bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-ink"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.mrn})
                      </option>
                    ))}
                  </select>
                  {primaryPatient ? (
                    <div className="mt-2 text-xs text-ink-2">
                      <div><span className="text-ink-3">MRN:</span> {primaryPatient.mrn}</div>
                      <div><span className="text-ink-3">Patient:</span> {primaryPatient.name}</div>
                    </div>
                  ) : null}
                </div>

                {/* Duplicate Secondary Profile */}
                <div className="rounded-lg border-2 border-clay/40 bg-clay-soft/10 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-clay">
                      Duplicate Profile (To Subsume)
                    </span>
                    <span className="rounded bg-clay/20 px-1.5 py-0.5 text-[9px] font-bold text-clay">
                      SOURCE RECORD
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-3">
                    All data from this profile will be combined into Primary. Status set to Merged.
                  </p>
                  <select
                    value={duplicateId}
                    onChange={(e) => setDuplicateId(e.target.value)}
                    className="mt-2.5 w-full rounded-md border border-clay/40 bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-ink"
                  >
                    {patients
                      .filter((p) => p.id !== primaryId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.mrn})
                        </option>
                      ))}
                  </select>
                  {duplicatePatient ? (
                    <div className="mt-2 text-xs text-ink-2">
                      <div><span className="text-ink-3">MRN:</span> {duplicatePatient.mrn}</div>
                      <div><span className="text-ink-3">Patient:</span> {duplicatePatient.name}</div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* What will be merged list */}
              <div className="rounded-lg border border-line bg-surface-sunken/40 p-3.5">
                <div className="text-xs font-semibold text-ink">
                  Consolidation Scope (Everything Transferred):
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-grove font-bold">✓</span>
                    <span>Clinical SOAP Notes & Vitals</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-grove font-bold">✓</span>
                    <span>Medical History, PMH & Allergies</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-grove font-bold">✓</span>
                    <span>Encrypted PHI Documents & Labs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-grove font-bold">✓</span>
                    <span>Insurance Coverages & Prior Auths</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-grove font-bold">✓</span>
                    <span>Open & Adjudicated Claims</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-grove font-bold">✓</span>
                    <span>Ledger Entries & Payment Balances</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-ink-3">Merge Reason / Clinician Note</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Duplicate MRN created during telehealth intake, confirmed identical SSN and DOB"
                  className="mt-1 w-full rounded-md border border-line-strong bg-surface-raised px-3 py-1.5 text-xs text-ink placeholder:text-ink-4"
                />
              </div>

              {/* Confirmation checkbox */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="confirm-merge"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line-strong text-grove focus:ring-grove"
                />
                <label htmlFor="confirm-merge" className="text-xs text-ink-2 cursor-pointer">
                  I confirm that <strong className="text-ink">{duplicatePatient?.name}</strong> and{' '}
                  <strong className="text-ink">{primaryPatient?.name}</strong> represent the same patient, and I authorize consolidating all clinical and billing records into{' '}
                  <strong className="text-grove-strong">{primaryPatient?.name} ({primaryPatient?.mrn})</strong>.
                </label>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-line pt-3.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-md border border-line px-3 text-xs font-medium text-ink hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!confirmed || loading || !duplicateId}
                  onClick={handleMerge}
                  className="h-8 rounded-md bg-grove px-4 text-xs font-semibold text-ink-inverse hover:bg-grove-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {loading ? 'Merging Records...' : 'Confirm & Execute Merge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
