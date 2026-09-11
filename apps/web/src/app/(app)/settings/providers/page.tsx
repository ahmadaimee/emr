import Link from 'next/link';
import { Empty, Kpi, PageHeader, selectCls } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { NewProviderModal } from './new-provider-modal';
import { EditProviderModal } from './edit-provider-modal';
import { DeleteProviderButton, ProviderStatusSelect } from './provider-row-actions';

export const metadata = { title: 'Provider Directory & NPI Roster' };

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const { run } = await pageContext();

  const data = await run('/settings/providers', async () => {
    return {
      providers: [],
      practices: [],
      statuses: [],
    };
  });

  const { providers = [], practices = [], statuses = [] } = data;

  const filteredProviders = providers.filter((p: any) => {
    if (sp.q) {
      const q = sp.q.toLowerCase();
      const match =
        p.firstName?.toLowerCase().includes(q) ||
        p.lastName?.toLowerCase().includes(q) ||
        p.npi?.includes(q) ||
        p.taxonomyDescription?.toLowerCase().includes(q) ||
        p.taxonomyCode?.toLowerCase().includes(q) ||
        p.licenseNumber?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (sp.role && p.billingRole !== sp.role) {
      return false;
    }
    if (sp.status) {
      if (sp.status === 'active' && (p.status || 'active') !== 'active') return false;
      if (sp.status === 'rendering_and_billing' && p.billingRole !== 'rendering_and_billing') return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Provider Directory & Billing Credentials"
        subtitle="Manage clinician rosters, individual NPI identifiers, specialty taxonomy codes, and clearinghouse billing privileges."
        actions={<NewProviderModal practices={practices} />}
      />

      {/* KPI Cards - Uniform Small */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Active Clinical Providers"
          value={providers.filter((p: any) => (p.status || 'active') === 'active').length}
          hint={`${providers.length} on the roster`}
          badge="Roster"
        />
        <Kpi
          variant="secondary"
          label="Rendering & Billing"
          value={providers.filter((p: any) => p.billingRole === 'rendering_and_billing').length}
          hint="Eligible for primary Box 33 billing"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Accepting Patients"
          value={providers.filter((p: any) => p.acceptingNewPatients).length}
          hint="Active for appointments & booking"
        />
        <Kpi
          variant="secondary"
          label="State Jurisdictions"
          value="IL (IDFPR)"
          hint="Active state medical licenses"
        />
      </div>

      {/* Search & Filters */}
      <form className="mt-5 mb-3 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Provider name, NPI, or specialty..."
          className="h-8 w-64 rounded-md border border-line-strong bg-surface-raised px-2.5 text-sm"
        />
        <select
          name="role"
          defaultValue={sp.role ?? ''}
          className={`${selectCls} w-52`}
        >
          <option value="">All billing roles</option>
          <option value="rendering_and_billing">Rendering & Billing (Box 33)</option>
          <option value="rendering">Rendering only (Box 24J)</option>
          <option value="billing">Billing only</option>
        </select>
        <button className="h-8 rounded-md border border-line-strong bg-surface-raised px-3 text-sm font-medium hover:bg-surface-sunken transition-colors">
          Filter
        </button>
      </form>

      {/* Quick Status Filter Chips */}
      <div className="mb-3 flex flex-wrap gap-1">
        <Link
          href="/settings/providers"
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            !sp.status ? 'bg-ink text-ink-inverse' : 'bg-surface-sunken text-ink-2 hover:bg-line'
          }`}
        >
          All <span className="g-num opacity-60">{providers.length}</span>
        </Link>
        <Link
          href="/settings/providers?status=active"
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            sp.status === 'active'
              ? 'bg-ink text-ink-inverse'
              : 'bg-surface-sunken text-ink-2 hover:bg-line'
          }`}
        >
          Active <span className="g-num opacity-60">{providers.filter((p: any) => (p.status || 'active') === 'active').length}</span>
        </Link>
        <Link
          href="/settings/providers?status=rendering_and_billing"
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            sp.status === 'rendering_and_billing'
              ? 'bg-ink text-ink-inverse'
              : 'bg-surface-sunken text-ink-2 hover:bg-line'
          }`}
        >
          Rendering & Billing <span className="g-num opacity-60">{providers.filter((p: any) => p.billingRole === 'rendering_and_billing').length}</span>
        </Link>
      </div>

      {/* Providers Data Table List - Identical to Claims */}
      {filteredProviders.length === 0 ? (
        <Empty
          title="No providers match"
          body="Try clearing your search query or role filter to view clinical providers."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised shadow-xs">
          <table className="g-table" data-bulk>
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Provider</th>
                <th>NPI (Type 1)</th>
                <th>Specialty / Taxonomy</th>
                <th>State License & DEA</th>
                <th>EDI Billing Role</th>
                <th>Practice Affiliations</th>
                <th>Contact</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProviders.map((p: any) => (
                <tr key={p.id} tabIndex={0} className="hover:bg-surface-sunken">
                  <td>
                    <input
                      type="checkbox"
                      name="provider"
                      value={p.id}
                      className="accent-[var(--g-grove-500)]"
                      aria-label={`Select ${p.firstName} ${p.lastName}`}
                    />
                  </td>
                  <td>
                    <Link href={`/settings/providers/${p.id}`} className="font-medium text-ink hover:underline">
                      Dr. {p.firstName} {p.lastName}, <span className="font-semibold text-grove-strong">{p.credentials}</span>
                    </Link>
                  </td>
                  <td>
                    <span className="g-mono font-bold text-xs bg-grove-soft text-grove-strong px-2 py-0.5 rounded border border-grove-line">
                      {p.npi}
                    </span>
                  </td>
                  <td>
                    <div>
                      <div className="text-xs text-ink font-medium">{p.taxonomyDescription}</div>
                      <div className="g-mono text-[10px] text-ink-3">{p.taxonomyCode}</div>
                    </div>
                  </td>
                  <td>
                    <div className="g-mono text-xs text-ink">
                      {p.licenseNumber || '—'}
                    </div>
                    <div className="text-[10px] text-ink-3">
                      DEA: {p.deaNumber || '—'}
                    </div>
                  </td>
                  <td>
                    <span className="capitalize text-xs font-medium text-ink">
                      {p.billingRole?.replace(/_/g, ' ') || 'Rendering'}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(p.practiceNames || ['Orchard Family Practice']).map((prac: string) => (
                        <span
                          key={prac}
                          className="rounded bg-surface-sunken px-1.5 py-0.2 text-[10px] text-ink-2 border border-line truncate max-w-[140px]"
                        >
                          {prac}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-ink truncate max-w-[160px]">{p.email}</div>
                    <div className="text-[11px] text-ink-3">{p.phone}</div>
                  </td>
                  <td>
                    <ProviderStatusSelect id={p.id} status={p.status || 'active'} statuses={statuses} />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/settings/providers/${p.id}`}
                        className="rounded-md border border-line-strong px-2 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-surface-sunken"
                      >
                        Full profile
                      </Link>
                      <EditProviderModal provider={p} practices={practices} />
                      <DeleteProviderButton
                        id={p.id}
                        name={`Dr. ${p.firstName} ${p.lastName}`}
                        references={p.references ?? { claims: 0, appointments: 0, total: 0, deletable: false }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
