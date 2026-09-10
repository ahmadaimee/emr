'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, PageHeader, inputCls, selectCls } from '@/components/ui';
import { saveProviderAction } from '../actions';
import { DeleteProviderButton, ProviderStatusSelect } from '../provider-row-actions';

const PLACE_OF_SERVICE = [
  { code: '11', label: '11 · Office' },
  { code: '02', label: '02 · Telehealth (patient at home)' },
  { code: '10', label: '10 · Telehealth (patient not at home)' },
  { code: '19', label: '19 · Off-campus outpatient hospital' },
  { code: '20', label: '20 · Urgent care facility' },
  { code: '21', label: '21 · Inpatient hospital' },
  { code: '22', label: '22 · On-campus outpatient hospital' },
  { code: '23', label: '23 · Emergency room' },
  { code: '81', label: '81 · Independent laboratory' },
];

const GENDERS = ['unspecified', 'male', 'female', 'nonbinary'];

type Patch = Record<string, any>;

export function ProviderEditForm({
  provider,
  references,
  warnings,
  practices,
  colleagues,
  reference,
}: {
  provider: any;
  references: { claims: number; appointments: number; total: number; deletable: boolean };
  warnings: Array<{ label: string; value: string; days: number; severity: 'expired' | 'urgent' | 'soon' }>;
  practices: Array<{ id: string; name: string }>;
  colleagues: Array<{ id: string; name: string }>;
  reference: {
    credentials: string[];
    billingRoles: Array<{ value: string; label: string; hint: string }>;
    employmentTypes: string[];
    deaSchedules: string[];
    licenseStatuses: string[];
    enrollmentStatuses: string[];
    states: string[];
    taxonomies: Array<{ code: string; description: string }>;
    statuses: Array<{ value: string; label: string; hint: string }>;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState<Patch>(() => ({ ...provider }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const set = (key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const displayName = `Dr. ${form.firstName || ''} ${form.lastName || ''}`.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await saveProviderAction(provider.id, form);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setDirty(false);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  };

  const taxonomyLabel = useMemo(
    () => reference.taxonomies.find((t) => t.code === form.taxonomyCode)?.description ?? '',
    [form.taxonomyCode, reference.taxonomies],
  );

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={displayName || 'Provider'}
        subtitle={`${form.credentials || ''} · ${form.taxonomyDescription || taxonomyLabel || 'No specialty on file'} · NPI ${form.npi || '—'}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/settings/providers"
              className="inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken"
            >
              ← Directory
            </Link>
            <DeleteProviderButton id={provider.id} name={displayName} references={references} />
            <button
              type="submit"
              disabled={saving || !dirty}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50"
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-raised px-4 py-2.5">
        <span className="text-xs font-medium text-ink-3">Status</span>
        <ProviderStatusSelect id={provider.id} status={form.status || 'active'} statuses={reference.statuses} />
        <span className="h-4 w-px bg-line" />
        <span className="text-xs text-ink-3">
          On {references.claims} claim{references.claims === 1 ? '' : 's'} and {references.appointments} appointment
          {references.appointments === 1 ? '' : 's'}
          {references.deletable ? '' : ' — cannot be deleted, only deactivated'}
        </span>
      </div>

      {warnings.length > 0 ? (
        <Card title="⚠ Credentials needing attention">
          <ul className="divide-y divide-line">
            {warnings.map((w) => (
              <li key={w.label} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{w.label}</span>
                <span
                  className={
                    w.severity === 'expired'
                      ? 'font-medium text-danger'
                      : w.severity === 'urgent'
                        ? 'font-medium text-warn'
                        : 'text-ink-3'
                  }
                >
                  {w.severity === 'expired' ? `Expired ${-w.days}d ago` : `Expires in ${w.days}d`} · {w.value}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* ---------------------------------------------------------- Identity */}
        <Card title="Identity">
          <div className="grid grid-cols-2 gap-3 p-4">
            <Text label="Prefix" value={form.prefix} onChange={(v) => set('prefix', v)} />
            <Text label="Preferred name" value={form.preferredName} onChange={(v) => set('preferredName', v)} />
            <Text label="First name *" value={form.firstName} onChange={(v) => set('firstName', v)} />
            <Text label="Middle name" value={form.middleName} onChange={(v) => set('middleName', v)} />
            <Text label="Last name *" value={form.lastName} onChange={(v) => set('lastName', v)} />
            <Text label="Suffix" value={form.suffix} onChange={(v) => set('suffix', v)} placeholder="Jr., III" />
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Credentials</label>
              <input list="credential-options" value={form.credentials || ''} onChange={(e) => set('credentials', e.target.value)} className={inputCls} />
              <datalist id="credential-options">
                {reference.credentials.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <Select label="Gender" value={form.gender || 'unspecified'} onChange={(v) => set('gender', v)} options={GENDERS.map((g) => ({ value: g, label: g }))} />
            <Text label="Date of birth" type="date" value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
            <Text
              label="Languages spoken"
              value={(form.languages || []).join(', ')}
              onChange={(v) => set('languages', v.split(',').map((s: string) => s.trim()).filter(Boolean))}
              placeholder="English, Spanish"
            />
          </div>
        </Card>

        {/* ---------------------------------------------------- Identifiers & enrollment */}
        <Card title="Identifiers & payer enrollment">
          <div className="grid grid-cols-2 gap-3 p-4">
            <Text label="NPI (Type 1) *" mono value={form.npi} onChange={(v) => set('npi', v.replace(/\D/g, '').slice(0, 10))} hint="Check digit validated on save" />
            <Text label="Group NPI (Type 2)" mono value={form.groupNpi} onChange={(v) => set('groupNpi', v.replace(/\D/g, '').slice(0, 10))} />
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Federal tax ID</label>
              <div className="flex gap-1.5">
                <select value={form.taxIdType || 'EI'} onChange={(e) => set('taxIdType', e.target.value)} className={`${selectCls} w-20`}>
                  <option value="EI">EIN</option>
                  <option value="SY">SSN</option>
                </select>
                <input value={form.taxId || ''} onChange={(e) => set('taxId', e.target.value.replace(/\D/g, '').slice(0, 9))} className={`${inputCls} g-mono`} />
              </div>
            </div>
            <Text label="UPIN (legacy)" mono value={form.upin} onChange={(v) => set('upin', v)} />
            <Text label="Medicaid provider ID" mono value={form.medicaidId} onChange={(v) => set('medicaidId', v)} />
            <Select label="Medicaid state" value={form.medicaidState || 'IL'} onChange={(v) => set('medicaidState', v)} options={reference.states.map((s) => ({ value: s, label: s }))} />
            <Text label="Medicare PTAN" mono value={form.medicarePtan} onChange={(v) => set('medicarePtan', v)} />
            <Text label="PECOS revalidation due" type="date" value={form.pecosRevalidationDate} onChange={(v) => set('pecosRevalidationDate', v)} />
            <Text label="CAQH provider ID" mono value={form.caqhId} onChange={(v) => set('caqhId', v)} />
            <Text label="CAQH last attested" type="date" value={form.caqhAttestedOn} onChange={(v) => set('caqhAttestedOn', v)} />
            <Checkbox label="Enrolled in PECOS" checked={Boolean(form.pecosEnrolled)} onChange={(v) => set('pecosEnrolled', v)} full />
          </div>
        </Card>

        {/* --------------------------------------------------------------- Taxonomy */}
        <Card title="Taxonomy & specialty">
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-ink-2">Primary taxonomy (NUCC)</label>
              <select
                value={form.taxonomyCode || ''}
                onChange={(e) => {
                  const code = e.target.value;
                  const desc = reference.taxonomies.find((t) => t.code === code)?.description ?? '';
                  set('taxonomyCode', code);
                  set('taxonomyDescription', desc);
                }}
                className={selectCls}
              >
                <option value="">— select —</option>
                {reference.taxonomies.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} · {t.description}
                  </option>
                ))}
              </select>
            </div>
            <Text label="Specialty (display)" value={form.taxonomyDescription} onChange={(v) => set('taxonomyDescription', v)} className="col-span-2" />
            <Text
              label="Secondary taxonomies"
              value={(form.secondaryTaxonomies || []).join(', ')}
              onChange={(v) => set('secondaryTaxonomies', v.split(',').map((s: string) => s.trim()).filter(Boolean))}
              placeholder="207QA0505X"
              mono
              className="col-span-2"
            />
            <Text
              label="Subspecialties"
              value={(form.subspecialties || []).join(', ')}
              onChange={(v) => set('subspecialties', v.split(',').map((s: string) => s.trim()).filter(Boolean))}
              placeholder="Sports Medicine"
              className="col-span-2"
            />
          </div>
        </Card>

        {/* -------------------------------------------------------- License & DEA */}
        <Card title="State license & DEA">
          <div className="grid grid-cols-2 gap-3 p-4">
            <Text label="State licence number" mono value={form.licenseNumber} onChange={(v) => set('licenseNumber', v)} />
            <Select label="Licence state" value={form.licenseState || 'IL'} onChange={(v) => set('licenseState', v)} options={reference.states.map((s) => ({ value: s, label: s }))} />
            <Select
              label="Licence status"
              value={form.licenseStatus || 'active'}
              onChange={(v) => set('licenseStatus', v)}
              options={reference.licenseStatuses.map((s) => ({ value: s, label: s }))}
            />
            <div />
            <Text label="Licence issued" type="date" value={form.licenseIssuedOn} onChange={(v) => set('licenseIssuedOn', v)} />
            <Text label="Licence expires" type="date" value={form.licenseExpiresOn} onChange={(v) => set('licenseExpiresOn', v)} />
            <Text label="DEA number" mono value={form.deaNumber} onChange={(v) => set('deaNumber', v.toUpperCase())} hint="2 letters + 7 digits; checksum validated on save" />
            <Text label="DEA expires" type="date" value={form.deaExpiresOn} onChange={(v) => set('deaExpiresOn', v)} />
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-ink-2">DEA schedules authorised</label>
              <div className="flex flex-wrap gap-1.5">
                {reference.deaSchedules.map((s) => {
                  const on = (form.deaSchedules || []).includes(s);
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() =>
                        set('deaSchedules', on ? (form.deaSchedules || []).filter((x: string) => x !== s) : [...(form.deaSchedules || []), s])
                      }
                      className={`rounded-md border px-2 py-1 text-xs ${on ? 'border-grove bg-grove-soft text-grove-strong' : 'border-line text-ink-3 hover:bg-surface-sunken'}`}
                    >
                      Schedule {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <Text label="State CDS number" mono value={form.stateCdsNumber} onChange={(v) => set('stateCdsNumber', v)} />
            <Text label="State CDS expires" type="date" value={form.stateCdsExpiresOn} onChange={(v) => set('stateCdsExpiresOn', v)} />
          </div>
        </Card>

        {/* -------------------------------------------------------------- Contact */}
        <Card title="Contact & address">
          <div className="grid grid-cols-2 gap-3 p-4">
            <Text label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} className="col-span-2" />
            <Text label="Office phone" value={form.phone} onChange={(v) => set('phone', v)} />
            <Text label="Mobile" value={form.mobile} onChange={(v) => set('mobile', v)} />
            <Text label="Fax" value={form.fax} onChange={(v) => set('fax', v)} />
            <div />
            <Text label="Address line 1" value={form.addressLine1} onChange={(v) => set('addressLine1', v)} className="col-span-2" />
            <Text label="Address line 2" value={form.addressLine2} onChange={(v) => set('addressLine2', v)} className="col-span-2" />
            <Text label="City" value={form.city} onChange={(v) => set('city', v)} />
            <Select label="State" value={form.state || 'IL'} onChange={(v) => set('state', v)} options={reference.states.map((s) => ({ value: s, label: s }))} />
            <Text label="ZIP" mono value={form.zip} onChange={(v) => set('zip', v)} />
            <Text label="County" value={form.county} onChange={(v) => set('county', v)} />
          </div>
        </Card>

        {/* --------------------------------------------------------- Organization */}
        <Card title="Organization & employment">
          <div className="grid grid-cols-2 gap-3 p-4">
            <Text label="Organization / group name" value={form.organizationName} onChange={(v) => set('organizationName', v)} className="col-span-2" />
            <Text label="Organization NPI (Type 2)" mono value={form.organizationNpi} onChange={(v) => set('organizationNpi', v.replace(/\D/g, '').slice(0, 10))} />
            <Select
              label="Employment type"
              value={form.employmentType || 'Employed'}
              onChange={(v) => set('employmentType', v)}
              options={reference.employmentTypes.map((e) => ({ value: e, label: e }))}
            />
            <Text label="Employment start" type="date" value={form.employmentStartDate} onChange={(v) => set('employmentStartDate', v)} />
            <Text label="Employment end" type="date" value={form.employmentEndDate} onChange={(v) => set('employmentEndDate', v)} />
            <Select
              label="Primary practice"
              value={form.primaryPracticeId || ''}
              onChange={(v) => set('primaryPracticeId', v)}
              options={[{ value: '', label: '— none —' }, ...practices.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Select
              label="Supervising provider"
              value={form.supervisingProviderId || ''}
              onChange={(v) => set('supervisingProviderId', v)}
              options={[{ value: '', label: '— none —' }, ...colleagues.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Text label="Panel size" type="number" value={form.panelSize} onChange={(v) => set('panelSize', Number(v) || 0)} />
            <Checkbox label="Accepting new patients" checked={Boolean(form.acceptingNewPatients)} onChange={(v) => set('acceptingNewPatients', v)} />

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-ink-2">Practice affiliations</label>
              <div className="flex flex-wrap gap-1.5">
                {practices.map((pr) => {
                  const on = (form.practiceNames || []).includes(pr.name);
                  return (
                    <button
                      type="button"
                      key={pr.id}
                      onClick={() =>
                        set(
                          'practiceNames',
                          on ? (form.practiceNames || []).filter((n: string) => n !== pr.name) : [...(form.practiceNames || []), pr.name],
                        )
                      }
                      className={`rounded-md border px-2 py-1 text-[11px] ${on ? 'border-grove bg-grove-soft text-grove-strong' : 'border-line text-ink-3 hover:bg-surface-sunken'}`}
                    >
                      {on ? '✓ ' : ''}
                      {pr.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* --------------------------------------------------------------- Billing */}
        <Card title="Claims & billing defaults">
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-ink-2">EDI billing role</label>
              <select value={form.billingRole || 'rendering_and_billing'} onChange={(e) => set('billingRole', e.target.value)} className={selectCls}>
                {reference.billingRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} — {r.hint}
                  </option>
                ))}
              </select>
            </div>
            <Select
              label="Default place of service"
              value={form.defaultPlaceOfService || '11'}
              onChange={(v) => set('defaultPlaceOfService', v)}
              options={PLACE_OF_SERVICE.map((p) => ({ value: p.code, label: p.label }))}
            />
            <Text label="Claim taxonomy override" mono value={form.claimTaxonomyCode} onChange={(v) => set('claimTaxonomyCode', v)} />
            <Text label="CLIA number" mono value={form.cliaNumber} onChange={(v) => set('cliaNumber', v)} />
            <Checkbox label="Box 33 uses group NPI (not individual)" checked={Boolean(form.box33UsesGroupNpi)} onChange={(v) => set('box33UsesGroupNpi', v)} full />
          </div>
        </Card>

        {/* ----------------------------------------------------------- Scheduling */}
        <Card title="Scheduling defaults">
          <div className="grid grid-cols-2 gap-3 p-4">
            <Text label="Default appointment length (min)" type="number" value={form.defaultAppointmentMinutes} onChange={(v) => set('defaultAppointmentMinutes', Number(v) || 0)} />
            <Text label="Default room / bay" value={form.room} onChange={(v) => set('room', v)} />
          </div>
        </Card>
      </div>

      {/* -------------------------------------------------------- Board certifications */}
      <div className="mt-4">
        <ListEditor
          title="Board certifications"
          items={form.boardCertifications || []}
          onChange={(v) => set('boardCertifications', v)}
          empty={{ board: '', specialty: '', certifiedOn: '', expiresOn: '' }}
          addLabel="Add certification"
          fields={[
            { key: 'board', label: 'Board', placeholder: 'American Board of Family Medicine' },
            { key: 'specialty', label: 'Specialty', placeholder: 'Family Medicine' },
            { key: 'certifiedOn', label: 'Certified', type: 'date' },
            { key: 'expiresOn', label: 'Expires', type: 'date' },
          ]}
        />
      </div>

      {/* -------------------------------------------------------------- Privileges */}
      <div className="mt-4">
        <ListEditor
          title="Hospital privileges"
          items={form.hospitalPrivileges || []}
          onChange={(v) => set('hospitalPrivileges', v)}
          empty={{ hospital: '', status: 'active', expiresOn: '' }}
          addLabel="Add hospital"
          fields={[
            { key: 'hospital', label: 'Hospital', placeholder: 'Springfield Memorial Hospital' },
            { key: 'status', label: 'Status', placeholder: 'active' },
            { key: 'expiresOn', label: 'Expires', type: 'date' },
          ]}
        />
      </div>

      {/* --------------------------------------------------------- Payer enrollment */}
      <div className="mt-4">
        <ListEditor
          title="Payer enrollments"
          items={form.payerEnrollments || []}
          onChange={(v) => set('payerEnrollments', v)}
          empty={{ payer: '', status: 'in_process', providerNumber: '', effectiveOn: '' }}
          addLabel="Add payer"
          fields={[
            { key: 'payer', label: 'Payer', placeholder: 'Blue Cross Blue Shield' },
            { key: 'status', label: 'Status', select: reference.enrollmentStatuses },
            { key: 'providerNumber', label: 'Provider #', mono: true },
            { key: 'effectiveOn', label: 'Effective', type: 'date' },
          ]}
        />
      </div>

      {/* ------------------------------------------------------ Malpractice / compliance */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Malpractice coverage">
          <div className="grid grid-cols-2 gap-3 p-4">
            <Text label="Carrier" value={form.malpracticeCarrier} onChange={(v) => set('malpracticeCarrier', v)} className="col-span-2" />
            <Text label="Policy number" mono value={form.malpracticePolicyNumber} onChange={(v) => set('malpracticePolicyNumber', v)} className="col-span-2" />
            <Money label="Per occurrence" cents={form.malpracticePerOccurrenceCents} onChange={(c) => set('malpracticePerOccurrenceCents', c)} />
            <Money label="Aggregate" cents={form.malpracticeAggregateCents} onChange={(c) => set('malpracticeAggregateCents', c)} />
            <Text label="Policy expires" type="date" value={form.malpracticeExpiresOn} onChange={(v) => set('malpracticeExpiresOn', v)} className="col-span-2" />
          </div>
        </Card>

        <Card title="Compliance screening">
          <div className="grid grid-cols-2 gap-3 p-4">
            <Text label="OIG exclusion list checked" type="date" value={form.oigCheckedOn} onChange={(v) => set('oigCheckedOn', v)} />
            <Text label="SAM.gov checked" type="date" value={form.samCheckedOn} onChange={(v) => set('samCheckedOn', v)} />
            <Text label="State exclusion list checked" type="date" value={form.stateExclusionCheckedOn} onChange={(v) => set('stateExclusionCheckedOn', v)} />
            <Text label="NPDB last queried" type="date" value={form.npdbQueriedOn} onChange={(v) => set('npdbQueriedOn', v)} />
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------------- Notes */}
      <div className="mt-4">
        <Card title="Internal notes">
          <div className="p-4">
            <textarea
              value={form.internalNotes || ''}
              onChange={(e) => set('internalNotes', e.target.value)}
              rows={3}
              placeholder="Not shown on claims or to the provider."
              className="w-full rounded-md border border-line-strong bg-surface-raised px-2.5 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-grove"
            />
          </div>
        </Card>
      </div>

      <div className="sticky bottom-4 mt-4 flex justify-end">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 shadow-lg">
          {dirty ? <span className="text-xs text-warn">Unsaved changes</span> : <span className="text-xs text-ink-4">No changes</span>}
          <button
            type="submit"
            disabled={saving || !dirty}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-4 text-xs font-medium text-white hover:bg-grove-strong disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------------

function Text({
  label,
  value,
  onChange,
  type = 'text',
  mono = false,
  placeholder,
  hint,
  className = '',
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-ink-2">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} ${mono ? 'g-mono' : ''}`}
      />
      {hint ? <p className="mt-1 text-[10px] text-ink-4">{hint}</p> : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-ink-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({ label, checked, onChange, full = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; full?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-xs text-ink-2 ${full ? 'col-span-2' : ''} self-end pb-1.5`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--g-grove-500)]" />
      {label}
    </label>
  );
}

function Money({ label, cents, onChange }: { label: string; cents: number; onChange: (cents: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-2">{label}</label>
      <div className="flex items-center gap-1">
        <span className="text-xs text-ink-4">$</span>
        <input
          type="number"
          value={cents ? cents / 100 : ''}
          onChange={(e) => onChange(Math.round((Number(e.target.value) || 0) * 100))}
          className={inputCls}
        />
      </div>
    </div>
  );
}

interface ListField {
  key: string;
  label: string;
  type?: string;
  mono?: boolean;
  placeholder?: string;
  select?: string[];
}

function ListEditor({
  title,
  items,
  onChange,
  empty,
  fields,
  addLabel,
}: {
  title: string;
  items: any[];
  onChange: (items: any[]) => void;
  empty: Record<string, any>;
  fields: ListField[];
  addLabel: string;
}) {
  const update = (i: number, key: string, value: any) => {
    const next = [...items];
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { ...empty }]);

  return (
    <Card
      title={title}
      actions={
        <button type="button" onClick={add} className="rounded-md border border-line-strong px-2 py-1 text-[11px] font-medium text-ink-2 hover:bg-surface-sunken">
          + {addLabel}
        </button>
      }
    >
      {items.length === 0 ? (
        <div className="px-4 py-4 text-xs text-ink-4">None on file.</div>
      ) : (
        <div className="divide-y divide-line">
          {items.map((item, i) => (
            <div key={i} className="grid items-end gap-2 p-3" style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr) auto` }}>
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-3">{f.label}</label>
                  {f.select ? (
                    <select value={item[f.key] ?? f.select[0]} onChange={(e) => update(i, f.key, e.target.value)} className={selectCls}>
                      {f.select.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type || 'text'}
                      value={item[f.key] ?? ''}
                      onChange={(e) => update(i, f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={`${inputCls} ${f.mono ? 'g-mono' : ''}`}
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => remove(i)}
                className="h-8 rounded-md border border-line-strong px-2 text-[11px] text-ink-3 hover:bg-danger-soft hover:text-danger"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
