'use client';

import { useState } from 'react';
import { createSoapNote } from '../actions';

export function NewSoapModal({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Vitals state
  const [bp, setBp] = useState('120/80');
  const [hr, setHr] = useState('72');
  const [temp, setTemp] = useState('98.6');
  const [rr, setRr] = useState('16');
  const [spo2, setSpo2] = useState('99');
  const [weight, setWeight] = useState('155');
  const [height, setHeight] = useState('68');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-ink-inverse hover:bg-grove-strong transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>New SOAP Note</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Document Clinical Encounter (SOAP)</h2>
                <p className="text-xs text-ink-3">Standardized clinical charting with vitals, ICD-10 diagnoses, and clinician sign-off.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-4 hover:text-ink text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form
              action={async (fd) => {
                setSaving(true);
                try {
                  await createSoapNote(fd);
                  setOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
              className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1"
            >
              <input type="hidden" name="patientId" value={patientId} />

              {/* Encounter Vitals Section */}
              <div className="rounded-lg border border-line bg-surface-sunken/40 p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">Patient Vitals</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-[11px] text-ink-3">Blood Pressure (mmHg)</label>
                    <input
                      name="bp"
                      value={bp}
                      onChange={(e) => setBp(e.target.value)}
                      placeholder="120/80"
                      className="mt-0.5 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-3">Heart Rate (bpm)</label>
                    <input
                      name="hr"
                      value={hr}
                      onChange={(e) => setHr(e.target.value)}
                      placeholder="72"
                      className="mt-0.5 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-3">Temperature (°F)</label>
                    <input
                      name="temp"
                      value={temp}
                      onChange={(e) => setTemp(e.target.value)}
                      placeholder="98.6"
                      className="mt-0.5 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-3">SpO2 (%)</label>
                    <input
                      name="spo2"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      placeholder="99"
                      className="mt-0.5 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-3">Weight (lbs)</label>
                    <input
                      name="weight"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="155"
                      className="mt-0.5 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-3">Height (in)</label>
                    <input
                      name="height"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="68"
                      className="mt-0.5 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-3">Resp Rate (/min)</label>
                    <input
                      name="rr"
                      value={rr}
                      onChange={(e) => setRr(e.target.value)}
                      placeholder="16"
                      className="mt-0.5 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink-3">Service Date</label>
                    <input
                      name="serviceDate"
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="mt-0.5 h-8 w-full rounded border border-line-strong bg-surface px-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* S: Subjective */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  <span className="text-grove font-bold mr-1">S</span> — Subjective (Chief Complaint & HPI)
                </label>
                <textarea
                  name="subjective"
                  rows={3}
                  required
                  placeholder="Patient states symptoms, duration, exacerbating/alleviating factors, review of systems..."
                  defaultValue="Patient presents for follow-up evaluation. States mild persistent discomfort, no acute distress."
                  className="mt-1 w-full rounded-md border border-line-strong bg-surface p-2.5 text-xs focus:ring-1 focus:ring-grove focus:outline-none"
                />
              </div>

              {/* O: Objective */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  <span className="text-grove font-bold mr-1">O</span> — Objective (Physical Exam & Clinical Findings)
                </label>
                <textarea
                  name="objective"
                  rows={3}
                  required
                  placeholder="Physical exam by body system (HEENT, Heart, Lungs, Abdomen, Musculoskeletal, Neuro)..."
                  defaultValue="Alert and oriented x 3. Heart: RRR, no murmurs. Lungs: Clear to auscultation bilaterally. Abdomen soft, non-tender."
                  className="mt-1 w-full rounded-md border border-line-strong bg-surface p-2.5 text-xs focus:ring-1 focus:ring-grove focus:outline-none"
                />
              </div>

              {/* A: Assessment */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  <span className="text-grove font-bold mr-1">A</span> — Assessment & ICD-10 Diagnoses
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <input
                    name="primaryIcd10"
                    placeholder="Primary ICD-10 (e.g. M54.5, I10)"
                    defaultValue="M54.5"
                    required
                    className="h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono"
                  />
                  <input
                    name="primaryDiagnosis"
                    placeholder="Diagnosis description"
                    defaultValue="Low back pain, unspecified"
                    required
                    className="h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs"
                  />
                </div>
              </div>

              {/* P: Plan */}
              <div>
                <label className="block text-xs font-semibold text-ink">
                  <span className="text-grove font-bold mr-1">P</span> — Plan (Rx, Orders, Referrals & Follow-Up)
                </label>
                <textarea
                  name="plan"
                  rows={3}
                  required
                  placeholder="Therapy orders, prescriptions with dosage/frequency, patient education, follow-up timeline..."
                  defaultValue="Continue conservative therapy. Encouraged hydration and daily stretching. Return to clinic in 4 weeks."
                  className="mt-1 w-full rounded-md border border-line-strong bg-surface p-2.5 text-xs focus:ring-1 focus:ring-grove focus:outline-none"
                />
              </div>

              {/* Sign & Lock */}
              <div className="flex items-center gap-2 rounded-md border border-line bg-surface-sunken p-2.5">
                <input type="checkbox" id="signNote" name="signed" defaultChecked className="rounded border-line-strong text-grove" />
                <label htmlFor="signNote" className="text-xs text-ink-2 cursor-pointer select-none">
                  Electronically sign and seal clinical note as Attending Physician (Dr. Marcus Vance, MD)
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-ink-inverse hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {saving ? 'Signing & Saving Note...' : 'Save & Sign SOAP Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
