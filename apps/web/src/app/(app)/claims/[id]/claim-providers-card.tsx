'use client';

import { useState, useTransition } from 'react';
import { selectCls } from '@/components/ui';
import { updateClaimProvidersAction, type ProviderRoleUpdates } from './edit-actions';

interface ProviderOption {
  id: string;
  firstName: string;
  lastName: string;
  npi: string;
}

interface ClaimProviders {
  renderingProviderId: string;
  billingProviderId: string | null;
  supervisingProviderId: string | null;
  referringProviderId: string | null;
}

const ROLES: { key: keyof ClaimProviders; label: string; required?: boolean }[] = [
  { key: 'billingProviderId', label: 'Billing Provider' },
  { key: 'renderingProviderId', label: 'Rendering Provider', required: true },
  { key: 'supervisingProviderId', label: 'Supervising Provider' },
  { key: 'referringProviderId', label: 'Referring Provider' },
];

export function ClaimProvidersCard({ claimId, providers, names, options, editable }: { claimId: string; providers: ClaimProviders; names: Partial<Record<keyof ClaimProviders, string | null>>; options: ProviderOption[]; editable: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: keyof ClaimProviders, value: string) => {
    setError(null);
    startTransition(async () => {
      const updates: ProviderRoleUpdates = { [key]: value || null };
      const r = await updateClaimProvidersAction(claimId, updates);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-3.5">
      <span className="text-[10px] font-semibold uppercase text-ink-4 block mb-1.5">Providers on This Claim</span>
      {error && <p className="text-danger text-[11px] mb-1.5">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {ROLES.map(({ key, label, required }) => (
          <div key={key}>
            <span className="text-[10px] uppercase text-ink-4 block mb-0.5">{label}</span>
            {editable ? (
              <select
                defaultValue={providers[key] ?? ''}
                disabled={isPending}
                onChange={(e) => handleChange(key, e.target.value)}
                className={selectCls}
              >
                {!required && <option value="">— None —</option>}
                {options.map((p) => (
                  <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} ({p.npi})</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-ink font-medium">
                {names[key] || (() => {
                  const match = options.find((p) => p.id === providers[key]);
                  return match ? `${match.lastName}, ${match.firstName}` : '—';
                })()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
