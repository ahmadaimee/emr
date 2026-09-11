'use client';

import { useState, useTransition } from 'react';
import { addCoverage } from '../actions';
import { Button } from '@/components/ui';

interface AddCoverageModalProps {
  patientId: string;
  payers: Array<{ id: string; name: string }>;
}

export function AddCoverageModal({ patientId, payers }: AddCoverageModalProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await addCoverage(formData);
      if (res.ok) setOpen(false);
      else setError(res.error);
    });
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Add Insurance Coverage
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-5 shadow-xl">
            <h2 className="text-base font-semibold text-ink">Add Insurance Coverage</h2>
            <p className="mt-1 text-xs text-ink-3">
              Sets up coverage rank (Primary / Secondary / Tertiary) for coordination of benefits (COB).
            </p>

            {error ? (
              <div className="mt-3 rounded-md border border-danger/30 bg-danger-soft p-2.5 text-xs text-danger">{error}</div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input type="hidden" name="patientId" value={patientId} />

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Payer</label>
                <select
                  name="payerId"
                  required
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                >
                  <option value="">Select a payer...</option>
                  {payers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Coverage Rank</label>
                  <select
                    name="rank"
                    defaultValue="primary"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="tertiary">Tertiary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Subscriber Relationship</label>
                  <select
                    name="relationshipCode"
                    defaultValue="18"
                    className="w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-sm"
                  >
                    <option value="18">18 — Self</option>
                    <option value="01">01 — Spouse</option>
                    <option value="19">19 — Child</option>
                    <option value="G8">G8 — Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Member ID</label>
                <input
                  name="memberId"
                  required
                  placeholder="e.g. W12345678"
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">Group Number</label>
                <input
                  name="groupNumber"
                  placeholder="e.g. GRP-99881"
                  className="w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-sm"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-line">
                <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={pending}>
                  {pending ? 'Saving...' : 'Save Coverage'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

