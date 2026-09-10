import Link from 'next/link';
import { Card, Kpi, PageHeader } from '@/components/ui';
import { pageContext } from '@/lib/session';

export const metadata = { title: 'Organization & Practice Setup' };

export default async function OrganizationPage() {
  const { run } = await pageContext();

  const data = await run('/settings/organization', async () => {
    return {
      organization: {
        legalName: 'Orchard Health Systems, LLC',
        dba: 'Orchard Medical & RCM Group',
        taxId: '36-4928190',
        groupNpi: '1982736450',
        taxonomyCode: '193200000X',
        phone: '(555) 234-8900',
        fax: '(555) 234-8999',
        email: 'billing@orchardhealth.internal',
        physicalAddress: {
          line1: '100 Medical Center Parkway',
          suite: 'Suite 400',
          city: 'Springfield',
          state: 'IL',
          zip: '62704',
        },
        payToAddress: {
          line1: 'PO Box 88910',
          city: 'Springfield',
          state: 'IL',
          zip: '62791',
        },
      },
      practices: [],
    };
  });

  const { organization, practices = [] } = data;

  return (
    <>
      <PageHeader
        title="Organization & Practice Locations"
        subtitle="Manage master legal entity credentials, Group Type-2 NPI, CLIA certifications, and physical service facilities."
      />

      {/* Top Organization KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Legal Entity"
          value={organization.legalName}
          hint={`DBA: ${organization.dba}`}
          badge="Group"
        />
        <Kpi
          variant="secondary"
          label="Group NPI (Type 2)"
          value={organization.groupNpi}
          hint="Billing NPI Box 33a"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Federal Tax ID (EIN)"
          value={organization.taxId}
          hint="EIN for Box 25"
        />
        <Kpi
          variant="secondary"
          label="Practice Facilities"
          value={practices.length}
          hint="Active clinical centers"
          tone="ok"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Organization Details Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Billing Entity Profile">
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-ink-4 block font-medium">Legal Name</span>
                <span className="font-semibold text-ink">{organization.legalName}</span>
              </div>

              <div>
                <span className="text-ink-4 block font-medium">DBA / Practice Trade Name</span>
                <span className="text-ink">{organization.dba}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-ink-4 block font-medium">Federal EIN</span>
                  <span className="font-mono font-bold text-ink">{organization.taxId}</span>
                </div>
                <div>
                  <span className="text-ink-4 block font-medium">Group NPI</span>
                  <span className="font-mono font-bold text-ink">{organization.groupNpi}</span>
                </div>
              </div>

              <div>
                <span className="text-ink-4 block font-medium">Group Taxonomy Code</span>
                <span className="font-mono text-ink">{organization.taxonomyCode}</span>
              </div>

              <div>
                <span className="text-ink-4 block font-medium">Physical Headquarters</span>
                <div className="text-ink">
                  {organization.physicalAddress?.line1}, {organization.physicalAddress?.suite}
                  <br />
                  {organization.physicalAddress?.city}, {organization.physicalAddress?.state} {organization.physicalAddress?.zip}
                </div>
              </div>

              <div className="border-t border-line pt-2">
                <span className="text-ink-4 block font-medium">Pay-To Address (Remit Checks / 835)</span>
                <div className="text-ink font-medium">
                  {organization.payToAddress?.line1}
                  <br />
                  {organization.payToAddress?.city}, {organization.payToAddress?.state} {organization.payToAddress?.zip}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Practice Locations Directory */}
        <div className="lg:col-span-2">
          <Card title={`Practice Care Centers & Service Facilities (${practices.length})`}>
            <div className="space-y-4">
              {practices.map((prac: any) => (
                <div
                  key={prac.id}
                  className="rounded-lg border border-line bg-surface p-4 text-xs hover:border-line-strong transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-ink text-sm">{prac.name}</h4>
                        <span className="font-mono text-[10px] text-ink-3">({prac.code})</span>
                        {prac.isDefaultBilling && (
                          <span className="rounded bg-grove-soft px-1.5 py-0.5 text-[10px] font-bold text-grove-strong">
                            Default Billing
                          </span>
                        )}
                      </div>
                      <p className="text-ink-3 mt-0.5">{prac.address}</p>
                    </div>

                    <div className="text-right">
                      <span className="rounded bg-surface-sunken px-2 py-0.5 font-mono text-[11px] font-semibold text-ink border border-line">
                        POS: {prac.posCode} ({prac.posDescription})
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-2 text-[11px]">
                    <div>
                      <span className="text-ink-4 block">CLIA Certification</span>
                      <span className="font-mono font-medium text-ink">{prac.cliaNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="text-ink-4 block">Direct Telephone</span>
                      <span className="text-ink">{prac.phone}</span>
                    </div>
                    <div>
                      <span className="text-ink-4 block">Active Encounter Volume</span>
                      <span className="font-mono font-semibold text-grove-strong">{prac.activeClaimsCount} claims</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
