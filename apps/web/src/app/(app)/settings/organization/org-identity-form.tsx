'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrganizationAction } from './actions';

const field = 'w-full h-8 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus:border-grove focus:outline-hidden';

interface Address { line1: string; line2?: string; city: string; state: string; zip: string }

export function OrgIdentityForm({
  org,
}: {
  org: { name: string; dba?: string; phone?: string; fax?: string; email?: string; physicalAddress?: Address; payToAddress?: Address };
}) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [dba, setDba] = useState(org.dba ?? '');
  const [phone, setPhone] = useState(org.phone ?? '');
  const [email, setEmail] = useState(org.email ?? '');
  const [addr, setAddr] = useState<Address>(org.physicalAddress ?? { line1: '', city: '', state: '', zip: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateOrganizationAction({ name, extra: { dba, phone, email, physicalAddress: addr } });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <form onSubmit={submit} className="space-y-3 p-4 text-xs">
      {saved && <div className="rounded-md border border-ok/30 bg-ok/10 px-2.5 py-1.5 text-[11px] font-medium text-ok">Saved.</div>}
      {error && <div className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[11px] font-medium text-danger">{error}</div>}

      <div>
        <label className="mb-1 block font-medium text-ink-2">Legal Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required className={field} />
      </div>
      <div>
        <label className="mb-1 block font-medium text-ink-2">DBA / Trade Name</label>
        <input value={dba} onChange={(e) => setDba(e.target.value)} className={field} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block font-medium text-ink-2">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
        </div>
        <div>
          <label className="mb-1 block font-medium text-ink-2">Billing Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </div>
      </div>
      <div className="border-t border-line pt-2">
        <label className="mb-1 block font-medium text-ink-2">Physical Address</label>
        <input value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} placeholder="Line 1" className={`${field} mb-1.5`} />
        <div className="grid grid-cols-3 gap-1.5">
          <input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="City" className={field} />
          <input value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="ST" className={field} />
          <input value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} placeholder="ZIP" className={field} />
        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-3">
        <button type="submit" disabled={saving} className="h-8 rounded-md bg-grove px-4 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
