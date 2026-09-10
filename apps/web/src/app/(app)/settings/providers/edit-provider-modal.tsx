'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProviderAction, type ProviderPatch } from './actions';

const BILLING_ROLES = [
  { value: 'rendering_and_billing', label: 'Rendering & Billing (Box 33)' },
  { value: 'rendering_only', label: 'Rendering only (Box 24J)' },
  { value: 'billing_only', label: 'Billing only' },
];

const field =
  'w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden';

export function EditProviderModal({
  provider,
  practices,
}: {
  provider: any;
  practices: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<ProviderPatch>({
    firstName: provider.firstName ?? '',
    lastName: provider.lastName ?? '',
    credentials: provider.credentials ?? '',
    npi: provider.npi ?? '',
    taxonomyCode: provider.taxonomyCode ?? '',
    taxonomyDescription: provider.taxonomyDescription ?? '',
    licenseNumber: provider.licenseNumber ?? '',
    licenseState: provider.licenseState ?? '',
    deaNumber: provider.deaNumber ?? '',
    email: provider.email ?? '',
    phone: provider.phone ?? '',
    billingRole: provider.billingRole ?? 'rendering_and_billing',
    acceptingNewPatients: Boolean(provider.acceptingNewPatients),
    practiceNames: provider.practiceNames ?? [],
  });

  const set = <K extends keyof ProviderPatch>(k: K, v: ProviderPatch[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const togglePractice = (name: string) =>
    set(
      'practiceNames',
      form.practiceNames.includes(name)
        ? form.practiceNames.filter((n) => n !== name)
        : [...form.practiceNames, name],
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateProviderAction(provider.id, form);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => {
      setOpen(false);
      setSaved(false);
    }, 800);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-line-strong px-2 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-surface-sunken"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-2xl rounded-xl border border-line bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">
                  Edit Dr. {provider.firstName} {provider.lastName}
                </h3>
                <p className="text-xs text-ink-3">
                  Credentials here appear on every claim this provider renders or bills.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-3 hover:bg-surface-sunken hover:text-ink">
                ✕
              </button>
            </div>

            {saved && (
              <div className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
                Provider updated.
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">First name *</label>
                  <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Last name *</label>
                  <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Credentials</label>
                  <input value={form.credentials} onChange={(e) => set('credentials', e.target.value)} placeholder="MD" className={field} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">NPI (Type 1) *</label>
                  <input
                    value={form.npi}
                    onChange={(e) => set('npi', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                    className={`${field} g-mono`}
                  />
                  <p className="mt-1 text-[10px] text-ink-4">Check digit is validated on save.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Taxonomy code</label>
                  <input value={form.taxonomyCode} onChange={(e) => set('taxonomyCode', e.target.value)} className={`${field} g-mono`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Specialty</label>
                  <input value={form.taxonomyDescription} onChange={(e) => set('taxonomyDescription', e.target.value)} className={field} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">State licence</label>
                  <input value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} className={`${field} g-mono`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Licence state</label>
                  <input value={form.licenseState} onChange={(e) => set('licenseState', e.target.value.toUpperCase().slice(0, 2))} className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">DEA number</label>
                  <input value={form.deaNumber} onChange={(e) => set('deaNumber', e.target.value)} className={`${field} g-mono`} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Email</label>
                  <input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Phone</label>
                  <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">EDI billing role</label>
                  <select value={form.billingRole} onChange={(e) => set('billingRole', e.target.value)} className={field}>
                    {BILLING_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Practice affiliations</label>
                <div className="flex flex-wrap gap-1.5">
                  {practices.map((pr) => {
                    const on = form.practiceNames.includes(pr.name);
                    return (
                      <button
                        type="button"
                        key={pr.id}
                        onClick={() => togglePractice(pr.name)}
                        className={`rounded-md border px-2 py-1 text-[11px] ${on ? 'border-grove bg-grove-soft text-grove-strong' : 'border-line text-ink-3 hover:bg-surface-sunken'}`}
                      >
                        {on ? '✓ ' : ''}
                        {pr.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-ink-2">
                <input
                  type="checkbox"
                  checked={form.acceptingNewPatients}
                  onChange={(e) => set('acceptingNewPatients', e.target.checked)}
                  className="accent-[var(--g-grove-500)]"
                />
                Accepting new patients
              </label>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-xs text-ink-2 hover:bg-surface-sunken">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="h-8 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
