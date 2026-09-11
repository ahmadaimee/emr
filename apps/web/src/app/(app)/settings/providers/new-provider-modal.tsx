'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProviderAction } from './actions';

const field =
  'w-full h-8 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink focus:border-grove focus:outline-hidden';

export function NewProviderModal({ practices = [] }: { practices?: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [credentials, setCredentials] = useState('MD');
  const [npi, setNpi] = useState('');
  const [taxonomyCode, setTaxonomyCode] = useState('207Q00000X');
  const [specialty, setSpecialty] = useState('Family Medicine Physician');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [billingRole, setBillingRole] = useState('rendering_and_billing');
  const [practiceNames, setPracticeNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const togglePractice = (name: string) =>
    setPracticeNames((n) => (n.includes(name) ? n.filter((x) => x !== name) : [...n, name]));

  const reset = () => {
    setFirstName('');
    setLastName('');
    setCredentials('MD');
    setNpi('');
    setTaxonomyCode('207Q00000X');
    setSpecialty('Family Medicine Physician');
    setLicenseNumber('');
    setBillingRole('rendering_and_billing');
    setPracticeNames([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !npi) return;
    setLoading(true);
    setError(null);
    const res = await createProviderAction({
      firstName,
      lastName,
      credentials,
      npi,
      taxonomyCode,
      taxonomyDescription: specialty,
      licenseNumber,
      billingRole,
      practiceNames,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    router.refresh();
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
      reset();
    }, 900);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs"
      >
        <span>Enroll New Provider</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface-raised p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-ink">Enroll Clinical Provider</h3>
                <p className="text-xs text-ink-3">Add clinician NPI, taxonomy, and billing credentials for claim generation</p>
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
                Provider successfully enrolled into practice roster.
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-ink-2 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={field}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-ink-2 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={field}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-ink-2 mb-1">Credentials</label>
                  <select value={credentials} onChange={(e) => setCredentials(e.target.value)} className={field}>
                    <option value="MD">MD</option>
                    <option value="DO">DO</option>
                    <option value="NP">NP</option>
                    <option value="PA-C">PA-C</option>
                    <option value="DC">DC</option>
                    <option value="LCSW">LCSW</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Individual NPI (10 digits) *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. 1487654323"
                    value={npi}
                    onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={`${field} font-mono`}
                  />
                  <p className="mt-1 text-[10px] text-ink-4">Check digit is validated on save.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Taxonomy Code</label>
                  <input
                    type="text"
                    value={taxonomyCode}
                    onChange={(e) => setTaxonomyCode(e.target.value)}
                    className={`${field} font-mono`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Specialty Description</label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className={field}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">State License #</label>
                  <input
                    type="text"
                    placeholder="e.g. IL-036-99214"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className={field}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1">EDI Billing Role</label>
                <select value={billingRole} onChange={(e) => setBillingRole(e.target.value)} className={field}>
                  <option value="rendering_and_billing">Rendering & Billing Provider (Loop 2310B / Box 24J & 33)</option>
                  <option value="rendering_only">Rendering Only (Group Bills — Loop 2310B / Box 24J)</option>
                  <option value="supervising">Supervising Clinician (Loop 2310D)</option>
                </select>
              </div>

              {practices.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Practice affiliations</label>
                  <div className="flex flex-wrap gap-1.5">
                    {practices.map((pr) => {
                      const on = practiceNames.includes(pr.name);
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
              )}

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
                  {loading ? 'Validating…' : 'Enroll Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
