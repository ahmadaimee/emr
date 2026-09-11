'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLocationAction } from './actions';

const field = 'w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink';

export function NewLocationModal({ practiceId, practiceName }: { practiceId: string; practiceName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [npi, setNpi] = useState('');
  const [placeOfService, setPlaceOfService] = useState('11');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createLocationAction({ practiceId, name, line1, city, state, postalCode, npi, placeOfService });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setName(''); setLine1(''); setCity(''); setState(''); setPostalCode(''); setNpi('');
    router.refresh();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded border border-line-strong px-1.5 py-0.5 text-[10px] font-medium text-ink-2 hover:bg-surface-sunken">
        + Location
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-line bg-surface-raised p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-sm font-semibold text-ink">New Location — {practiceName}</h3>
            <p className="mt-1 text-[11px] text-ink-3">Sets the MAC jurisdiction and drives which LCDs apply to claims from here.</p>

            {error && <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-2 text-xs text-danger">{error}</div>}

            <form onSubmit={submit} className="mt-3 space-y-2.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Location Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Main Office" className={field} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Address *</label>
                <input value={line1} onChange={(e) => setLine1(e.target.value)} required className={`${field} mb-1.5`} />
                <div className="grid grid-cols-3 gap-1.5">
                  <input value={city} onChange={(e) => setCity(e.target.value)} required placeholder="City" className={field} />
                  <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} required placeholder="ST" className={field} />
                  <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required placeholder="ZIP" className={field} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Facility NPI</label>
                  <input value={npi} onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))} className={`${field} font-mono`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Place of Service</label>
                  <input value={placeOfService} onChange={(e) => setPlaceOfService(e.target.value)} className={`${field} font-mono`} />
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
