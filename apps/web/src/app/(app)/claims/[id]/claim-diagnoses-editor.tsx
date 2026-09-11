'use client';

import { useState, useTransition } from 'react';
import { inputCls } from '@/components/ui';
import { CodeAutocomplete } from '@/components/code-autocomplete';
import { searchDiagnosisCodes } from '@/lib/code-lookup';
import { updateClaimDiagnosesAction } from './edit-actions';

export function ClaimDiagnosesEditor({ claimId, diagnosisCodes, editable }: { claimId: string; diagnosisCodes: string[]; editable: boolean }) {
  const [codes, setCodes] = useState(diagnosisCodes);
  const [newCode, setNewCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const commit = (next: string[]) => {
    setError(null);
    startTransition(async () => {
      const r = await updateClaimDiagnosesAction(claimId, next);
      if (!r.ok) setError(r.error);
      else setCodes(next);
    });
  };

  const addCode = () => {
    const code = newCode.trim().toUpperCase();
    if (!code || codes.includes(code)) {
      setNewCode('');
      return;
    }
    commit([...codes, code]);
    setNewCode('');
  };

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-3.5">
      <span className="text-[10px] font-semibold uppercase text-ink-4 block mb-1.5">
        Assigned ICD-10 Diagnoses (ICD Ind: 0)
      </span>
      {error && <p className="text-danger text-[11px] mb-1.5">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        {codes.map((dx, idx) => {
          const pointer = String.fromCharCode(65 + idx);
          return (
            <div key={`${dx}-${idx}`} className="flex items-center gap-2 rounded border border-line bg-surface p-2">
              <span className="font-mono font-bold text-grove-strong bg-grove-soft px-1.5 rounded text-xs shrink-0">
                {pointer}
              </span>
              <span className="font-mono font-bold text-ink flex-1 truncate">{dx}</span>
              {editable && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => commit(codes.filter((_, i) => i !== idx))}
                  className="text-ink-4 hover:text-danger shrink-0"
                  title="Remove diagnosis"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editable && (
        <div className="flex items-start gap-1.5 mt-2">
          <div className="flex-1" onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCode();
            }
          }}>
            <CodeAutocomplete
              value={newCode}
              onChange={setNewCode}
              search={searchDiagnosisCodes}
              placeholder="Add ICD-10 code (e.g. M5450)"
              className={inputCls}
            />
          </div>
          <button
            type="button"
            disabled={isPending || !newCode.trim() || codes.length >= 12}
            onClick={addCode}
            className="h-8 shrink-0 rounded-md bg-grove text-white px-3 text-xs font-medium hover:bg-grove-strong transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
