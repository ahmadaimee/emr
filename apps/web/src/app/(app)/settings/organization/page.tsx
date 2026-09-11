import { eq, schema, sql } from '@grove/db';
import { Card, Kpi, PageHeader } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { OrgIdentityForm } from './org-identity-form';
import { NewPracticeModal } from './new-practice-modal';
import { NewLocationModal } from './new-location-modal';

export const metadata = { title: 'Organization & Practice Setup' };

export default async function OrganizationPage() {
  const { run } = await pageContext();

  const data = await run('/settings/organization', async (ctx) => {
    const [org] = await ctx.tx.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.tenant.orgId));

    const practices = await ctx.tx.select().from(schema.practices).where(eq(schema.practices.orgId, ctx.tenant.orgId)).orderBy(schema.practices.name);
    const locations = await ctx.tx.select().from(schema.locations).where(eq(schema.locations.orgId, ctx.tenant.orgId));
    const [claimCounts] = practices.length
      ? [await ctx.tx.execute<{ practice_id: string; n: string }>(sql`select practice_id, count(*)::text as n from claims where org_id = ${ctx.tenant.orgId} group by practice_id`)]
      : [[]];

    return {
      org,
      practices: practices.map((p) => ({
        ...p,
        locations: locations.filter((l) => l.practiceId === p.id),
        claimsCount: Number(claimCounts.find((c) => c.practice_id === p.id)?.n ?? 0),
      })),
    };
  });

  const org = data?.org;
  const practices = data?.practices ?? [];
  const settings = (org?.settings ?? {}) as { dba?: string; phone?: string; fax?: string; email?: string; physicalAddress?: any; payToAddress?: any };

  return (
    <>
      <PageHeader
        title="Organization & Practice Locations"
        subtitle="The billing company's legal identity, and every client practice (group NPI) and service location it bills for."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi variant="primary" label="Legal Entity" value={org?.name ?? '—'} hint={settings.dba ? `DBA: ${settings.dba}` : 'No org record'} badge="Org" />
        <Kpi variant="secondary" label="Client Practices" value={practices.length} hint="Group NPI billing entities" tone={practices.length ? 'ok' : 'warn'} />
        <Kpi variant="secondary" label="Service Locations" value={practices.reduce((s, p) => s + p.locations.length, 0)} />
        <Kpi variant="secondary" label="EFT Enrolled" value={practices.filter((p) => p.eftEnrollmentStatus === 'active').length} hint={`of ${practices.length} practices`} tone={practices.length && practices.every((p) => p.eftEnrollmentStatus === 'active') ? 'ok' : 'warn'} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card title="Billing Company Identity">
            {org ? (
              <OrgIdentityForm org={{ name: org.name, ...settings }} />
            ) : (
              <p className="text-xs text-ink-3">No organization record found for this session.</p>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card
            title={`Client Practices (${practices.length})`}
            actions={<NewPracticeModal />}
          >
            {practices.length === 0 ? (
              <p className="text-xs text-ink-3">No practices yet. Click &quot;+ New Practice&quot; to add the first one — a claim can't be billed without a practice to bill it under.</p>
            ) : (
              <div className="space-y-4">
                {practices.map((prac) => (
                  <div key={prac.id} className="rounded-lg border border-line bg-surface p-4 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-ink">{prac.name}</h4>
                          {prac.npi && <span className="font-mono text-[10px] text-ink-3">NPI {prac.npi}</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-ink-3">
                          <span>EIN: <span className="font-mono text-ink-2">{prac.taxId || '—'}</span></span>
                          <span>CLIA: <span className="font-mono text-ink-2">{prac.cliaNumber || '—'}</span></span>
                          <span>Claims: <span className="font-mono font-medium text-grove-strong">{prac.claimsCount}</span></span>
                        </div>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${prac.eftEnrollmentStatus === 'active' ? 'bg-ok-soft text-ok' : prac.eftEnrollmentStatus === 'submitted' ? 'bg-warn-soft text-warn' : 'bg-surface-sunken text-ink-3'}`}>
                        EFT: {prac.eftEnrollmentStatus.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-3 border-t border-line pt-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-ink-3">Locations ({prac.locations.length})</span>
                        <NewLocationModal practiceId={prac.id} practiceName={prac.name} />
                      </div>
                      {prac.locations.length === 0 ? (
                        <p className="text-[11px] text-ink-4">No service locations yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {prac.locations.map((loc) => (
                            <div key={loc.id} className="flex items-center justify-between rounded bg-surface-sunken px-2 py-1">
                              <span className="text-ink-2">{loc.name} — {loc.line1}, {loc.city}, {loc.state} {loc.postalCode}</span>
                              {loc.placeOfService && <span className="font-mono text-[10px] text-ink-3">POS {loc.placeOfService}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
