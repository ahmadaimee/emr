'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { importPatientsCsvAction, type ImportPatientsResult } from './actions';

const TEMPLATE = 'firstName,lastName,dateOfBirth,sex,email,phone,mrn,payerName,memberId,openingBalance\nJane,Doe,1980-01-01,F,jane@example.com,555-0100,,Sample Health Plan,ABC123456789,245.00';

export function ImportPatientsModal({ practices }: { practices: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [practiceId, setPracticeId] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportPatientsResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
  };

  const reset = () => {
    setPracticeId(''); setFileName(''); setCsvText(''); setError(null); setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      setError('Choose a CSV file, or paste rows into the box below.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await importPatientsCsvAction(csvText, practiceId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res);
    router.refresh();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-raised px-3 text-xs font-medium text-ink-2 hover:bg-surface-sunken">
        ⇪ Import from CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl rounded-xl border border-line bg-surface-raised p-6 shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Migrate Patients from Another System</h3>
                <p className="text-xs text-ink-3">Bring over demographics, a primary coverage, and an opening balance — no need to re-key every historical claim.</p>
              </div>
              <button onClick={() => { setOpen(false); reset(); }} className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken">✕</button>
            </div>

            {result && (
              <div className="mt-4 space-y-2 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-xs text-ok">
                <div className="font-medium">
                  Imported {result.created} patient{result.created === 1 ? '' : 's'}
                  {result.skippedDuplicates ? `, skipped ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? '' : 's'}` : ''}.
                </div>
                {result.errors.length > 0 && (
                  <div className="text-danger">
                    {result.errors.length} row issue{result.errors.length === 1 ? '' : 's'}:
                    <ul className="ml-4 mt-1 list-disc space-y-0.5">
                      {result.errors.slice(0, 10).map((e, i) => (
                        <li key={i}>Row {e.row}: {e.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {error && <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}

            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Practice *</label>
                <select required value={practiceId} onChange={(e) => setPracticeId(e.target.value)} className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs">
                  <option value="">Select a practice…</option>
                  {practices.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">CSV file</label>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="w-full text-xs" />
                {fileName && <p className="mt-1 text-[11px] text-ink-3">Loaded {fileName} — {csvText.split('\n').filter(Boolean).length - 1} row(s).</p>}
              </div>

              <details className="rounded-md border border-line bg-surface-sunken/40 p-2.5 text-xs">
                <summary className="cursor-pointer font-medium text-ink-2">Or paste CSV rows directly</summary>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => { setCsvText(e.target.value); setFileName(''); }}
                  placeholder={TEMPLATE}
                  className="mt-2 w-full rounded-md border border-line-strong bg-surface p-2 font-mono text-[11px]"
                />
              </details>

              <div className="rounded-md bg-surface-sunken p-2.5 text-[11px] text-ink-3">
                <span className="font-medium text-ink-2">Expected columns</span> (header row required): <code className="font-mono">firstName, lastName, dateOfBirth</code> are required (YYYY-MM-DD). Optional: <code className="font-mono">sex, email, phone, mrn, payerName, memberId, openingBalance</code>. A row with a <code className="font-mono">payerName</code> that doesn't match an existing payer still creates the patient — just without coverage.
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => { setOpen(false); reset(); }} className="h-8 rounded-md px-3 text-xs text-ink-2 hover:bg-surface-sunken">Close</button>
                <button type="submit" disabled={loading} className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50">
                  {loading ? 'Importing…' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
