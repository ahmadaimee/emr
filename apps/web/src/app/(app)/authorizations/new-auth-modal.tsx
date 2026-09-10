'use client';

import { useState } from 'react';

interface PatientItem {
  id: string;
  name: string;
  mrn: string;
}

interface PayerItem {
  id: string;
  name: string;
}

export function NewAuthModal({
  patients,
  payers,
}: {
  patients: PatientItem[];
  payers: PayerItem[];
}) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState(patients[0]?.id || '');
  const [payerId, setPayerId] = useState(payers[0]?.id || '');
  const [procedureCode, setProcedureCode] = useState('72148');
  const [procedureName, setProcedureName] = useState('MRI Lumbar Spine without Contrast');
  const [diagnosisCode, setDiagnosisCode] = useState('M54.5');
  const [urgency, setUrgency] = useState('standard');
  const [units, setUnits] = useState('1');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 900);
    }, 600);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs"
      >
        <span>🛡️</span>
        <span>New Prior Authorization</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Submit Prior Authorization Request</h3>
                <p className="text-xs text-ink-3">Pre-service 278 inquiry and payer documentation submission</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink"
              >
                ✕
              </button>
            </div>

            {success && (
              <div className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
                Prior Authorization request submitted successfully! Tracking number generated.
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Patient *</label>
                  <select
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.mrn})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Target Payer *</label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                  >
                    {payers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">CPT / HCPCS *</label>
                  <input
                    type="text"
                    required
                    value={procedureCode}
                    onChange={(e) => setProcedureCode(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs font-mono text-ink focus:border-grove focus:outline-hidden"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-ink-2 mb-1">Procedure Description</label>
                  <input
                    type="text"
                    value={procedureName}
                    onChange={(e) => setProcedureName(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Primary ICD-10</label>
                  <input
                    type="text"
                    value={diagnosisCode}
                    onChange={(e) => setDiagnosisCode(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs font-mono text-ink focus:border-grove focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Requested Units</label>
                  <input
                    type="number"
                    min="1"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs font-mono text-ink focus:border-grove focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Urgency</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                  >
                    <option value="standard">Standard (72h)</option>
                    <option value="urgent">Urgent / STAT (24h)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Clinical Rationale & Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Summarize conservative treatment failures, imaging findings, or medical necessity..."
                  className="w-full rounded-md border border-line-strong bg-surface p-2 text-xs text-ink focus:border-grove focus:outline-hidden"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-grove px-4 py-1.5 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50"
                >
                  {loading ? 'Transmitting…' : 'Submit Auth Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
