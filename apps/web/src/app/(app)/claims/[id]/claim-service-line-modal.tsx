'use client';

import { useState } from 'react';
import { CodeAutocomplete } from '@/components/code-autocomplete';
import { searchProcedureCodes } from '@/lib/code-lookup';
import { addClaimServiceLineAction, updateClaimServiceLineAction, type ServiceLineInput } from './edit-actions';

interface ExistingLine {
  id: string;
  procedureCode: string;
  modifier1: string | null;
  modifier2: string | null;
  modifier3: string | null;
  modifier4: string | null;
  diagnosisPointers: number[];
  units: number;
  chargeCents: number;
  placeOfService: string | null;
}

interface ServiceLineModalProps {
  claimId: string;
  diagnosisCodes: string[];
  line?: ExistingLine;
  trigger: (open: () => void) => React.ReactNode;
}

export function ServiceLineModal({ claimId, diagnosisCodes, line, trigger }: ServiceLineModalProps) {
  const [open, setOpen] = useState(false);
  const [procedureCode, setProcedureCode] = useState(line?.procedureCode ?? '');
  const [modifiers, setModifiers] = useState([line?.modifier1 ?? '', line?.modifier2 ?? '', line?.modifier3 ?? '', line?.modifier4 ?? '']);
  const [units, setUnits] = useState(String(line?.units ?? 1));
  const [chargeDollars, setChargeDollars] = useState(line ? (line.chargeCents / 100).toFixed(2) : '');
  const [pointers, setPointers] = useState<Set<number>>(new Set(line?.diagnosisPointers ?? [1]));
  const [placeOfService, setPlaceOfService] = useState(line?.placeOfService ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePointer = (idx: number) => {
    setPointers((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = procedureCode.trim().toUpperCase();
    const chargeCents = Math.round(parseFloat(chargeDollars || '0') * 100);
    if (!code) return setError('A procedure code is required.');
    if (!(chargeCents > 0)) return setError('Charge must be greater than zero.');
    if (pointers.size === 0) return setError('Select at least one diagnosis for this line.');

    setError(null);
    setLoading(true);
    const input: ServiceLineInput = {
      procedureCode: code,
      modifiers: modifiers.map((m) => m.trim().toUpperCase()).filter(Boolean),
      units: parseInt(units, 10) || 1,
      chargeCents,
      diagnosisPointers: [...pointers].sort(),
      placeOfService: placeOfService.trim() || undefined,
    };
    try {
      const r = line
        ? await updateClaimServiceLineAction(claimId, line.id, input)
        : await addClaimServiceLineAction(claimId, input);
      if (!r.ok) setError(r.error);
      else setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {trigger(() => setOpen(true))}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-display text-base font-semibold text-ink">{line ? 'Edit Service Line' : 'Add Service Line'}</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink">
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">CPT / HCPCS Code</label>
                  <CodeAutocomplete
                    value={procedureCode}
                    onChange={setProcedureCode}
                    search={searchProcedureCodes}
                    placeholder="e.g. 99214"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono text-ink focus:border-grove"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Units</label>
                  <input
                    type="number"
                    min={1}
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Modifiers (up to 4)</label>
                <div className="grid grid-cols-4 gap-2">
                  {modifiers.map((m, i) => (
                    <input
                      key={i}
                      value={m}
                      onChange={(e) => setModifiers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                      maxLength={2}
                      placeholder={`M${i + 1}`}
                      className="h-8 rounded-md border border-line-strong bg-surface px-2 text-xs font-mono text-ink text-center focus:border-grove"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Diagnosis Pointers</label>
                {/* CMS-1500 box 24E / 837P SV107 allow at most 4 pointers (A-D) per line,
                    regardless of how many diagnoses the claim carries overall. */}
                <div className="flex flex-wrap gap-1.5">
                  {diagnosisCodes.slice(0, 4).map((dx, idx) => {
                    const n = idx + 1;
                    const letter = String.fromCharCode(65 + idx);
                    const selected = pointers.has(n);
                    return (
                      <button
                        key={dx}
                        type="button"
                        onClick={() => togglePointer(n)}
                        className={`rounded px-2 py-1 text-[11px] font-mono font-semibold border transition-colors ${
                          selected ? 'bg-grove text-white border-grove' : 'bg-surface border-line-strong text-ink-2 hover:bg-surface-sunken'
                        }`}
                      >
                        {letter} · {dx}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Charge ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={chargeDollars}
                    onChange={(e) => setChargeDollars(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs g-mono text-ink focus:border-grove"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Place of Service (Optional)</label>
                  <input
                    value={placeOfService}
                    onChange={(e) => setPlaceOfService(e.target.value)}
                    placeholder="Defaults to encounter POS"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-mono text-ink focus:border-grove"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-sunken">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="rounded-md bg-grove px-4 py-1.5 text-xs font-medium text-white hover:bg-grove-strong transition-colors disabled:opacity-50">
                  {loading ? 'Saving…' : line ? 'Save Changes' : 'Add Line'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
