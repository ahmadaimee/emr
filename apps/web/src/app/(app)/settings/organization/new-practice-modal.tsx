'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPracticeAction } from './actions';

const field = 'w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink';

export function NewPracticeModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [npi, setNpi] = useState('');
  const [taxId, setTaxId] = useState('');
  const [taxonomyCode, setTaxonomyCode] = useState('');
  const [cliaNumber, setCliaNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createPracticeAction({ name, npi, taxId, taxonomyCode, cliaNumber });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setName(''); setNpi(''); setTaxId(''); setTaxonomyCode(''); setCliaNumber('');
    router.refresh();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md bg-grove px-2.5 py-1 text-[11px] font-medium text-white hover:bg-grove-strong">
        + New Practice
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-line bg-surface-raised p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-sm font-semibold text-ink">New Client Practice</h3>
            <p className="mt-1 text-[11px] text-ink-3">A practice is a group-NPI billing entity — everything downstream (claims, providers, locations) hangs off it.</p>

            {error && <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-2 text-xs text-danger">{error}</div>}

            <form onSubmit={submit} className="mt-3 space-y-2.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Practice Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className={field} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Group NPI</label>
                  <input value={npi} onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))} className={`${field} font-mono`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Tax ID / EIN</label>
                  <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={`${field} font-mono`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Taxonomy Code</label>
                  <input value={taxonomyCode} onChange={(e) => setTaxonomyCode(e.target.value)} className={`${field} font-mono`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">CLIA #</label>
                  <input value={cliaNumber} onChange={(e) => setCliaNumber(e.target.value)} className={`${field} font-mono`} />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-xs text-ink-2 hover:bg-surface-sunken">Cancel</button>
                <button type="submit" disabled={loading} className="h-8 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50">
                  {loading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
