import Link from 'next/link';
import { Card, Empty, Kpi, PageHeader, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { NewAuthModal } from './new-auth-modal';

export const metadata = { title: 'Prior Authorizations & Referrals' };

export default async function AuthorizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const currentView = sp.view ?? 'auths';
  const currentStatus = sp.status ?? 'all';
  const { run } = await pageContext();

  const data = await run('/authorizations', async () => {
    return {
      summary: {
        pendingCount: 14,
        approvedCount: 38,
        expiringSoonCount: 4,
        totalReferralsCount: 18,
      },
      authorizations: [],
      referrals: [],
      patients: [],
      payers: [],
    };
  });

  const {
    summary = {
      pendingCount: 14,
      approvedCount: 38,
      expiringSoonCount: 4,
      totalReferralsCount: 18,
    },
    authorizations = [],
    referrals = [],
    patients = [],
    payers = [],
  } = data;

  const filteredAuths =
    currentStatus === 'all'
      ? authorizations
      : authorizations.filter((a: any) => a.status === currentStatus);

  return (
    <>
      <PageHeader
        title="Prior Authorizations & Referrals"
        subtitle="Manage pre-service payer authorizations, clinical necessity submissions, and specialist referral tracking."
        actions={<NewAuthModal patients={patients} payers={payers} />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Pending Payer Review"
          value={summary.pendingCount}
          hint="Actionable pre-service cases"
          tone="warn"
          badge="Prior Auth"
        />
        <Kpi
          variant="secondary"
          label="Approved Active Auths"
          value={summary.approvedCount}
          hint="Verified authorizations in effect"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Expiring Soon (14 Days)"
          value={summary.expiringSoonCount}
          hint="Require extension or re-authorization"
          tone={summary.expiringSoonCount > 0 ? 'warn' : undefined}
        />
        <Kpi
          variant="secondary"
          label="Specialist Referrals"
          value={summary.totalReferralsCount}
          hint="Active inbound and outbound referrals"
        />
      </div>

      {/* Primary View Switcher: Auths vs Referrals */}
      <div className="mt-5 flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <Link
            href="/authorizations?view=auths"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentView === 'auths'
                ? 'bg-grove text-white shadow-xs'
                : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken border border-line'
            }`}
          >
            <span>🛡️</span>
            <span>Prior Authorizations</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${currentView === 'auths' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'}`}>
              {authorizations.length}
            </span>
          </Link>

          <Link
            href="/authorizations?view=referrals"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              currentView === 'referrals'
                ? 'bg-grove text-white shadow-xs'
                : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken border border-line'
            }`}
          >
            <span>🔄</span>
            <span>Clinical Referrals</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${currentView === 'referrals' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'}`}>
              {referrals.length}
            </span>
          </Link>
        </div>
      </div>

      {/* VIEW 1: PRIOR AUTHORIZATIONS */}
      {currentView === 'auths' && (
        <div className="mt-3">
          <Card title={`Prior Authorizations (${filteredAuths.length})`}>
            {filteredAuths.length === 0 ? (
              <Empty
                title="No prior authorizations found"
                body="Click 'New Prior Authorization' to submit an authorization request."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                    <tr>
                      <th className="px-3 py-2">Auth #</th>
                      <th className="px-3 py-2">Patient</th>
                      <th className="px-3 py-2">Target Payer</th>
                      <th className="px-3 py-2">Procedure / CPT</th>
                      <th className="px-3 py-2 text-center">Units Used / Appr</th>
                      <th className="px-3 py-2">Effective Period</th>
                      <th className="px-3 py-2">Urgency</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs">
                    {filteredAuths.map((a: any) => (
                      <tr key={a.id} className="hover:bg-surface-sunken/40 font-sans">
                        <td className="px-3 py-2.5 font-mono font-medium text-grove-strong">
                          {a.authNumber}
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/patients/${a.patientId}`} className="font-medium text-ink hover:underline">
                            {a.patientName}
                          </Link>
                          <div className="font-mono text-[11px] text-ink-3">MRN: {a.mrn}</div>
                        </td>
                        <td className="px-3 py-2.5 text-ink-2 font-medium">
                          {a.payerName}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-bold text-ink mr-1.5">{a.procedureCode}</span>
                          <span className="text-ink-2 text-[11px]">{a.procedureName}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono">
                          <span className="font-semibold text-ink">{a.unitsUsed}</span>
                          <span className="text-ink-4"> / </span>
                          <span className="text-ink-2">{a.unitsApproved}</span>
                        </td>
                        <td className="px-3 py-2.5 text-ink-3">
                          {date(a.startDate)} – {date(a.expirationDate)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${
                              a.urgency === 'urgent' ? 'bg-danger-soft text-danger' : 'bg-surface-sunken text-ink-3'
                            }`}
                          >
                            {a.urgency}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* VIEW 2: REFERRALS */}
      {currentView === 'referrals' && (
        <div className="mt-3">
          <Card title={`Clinical Referrals (${referrals.length})`}>
            {referrals.length === 0 ? (
              <Empty
                title="No referrals found"
                body="Specialist and outbound clinical referrals will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                    <tr>
                      <th className="px-3 py-2">Referral #</th>
                      <th className="px-3 py-2">Direction</th>
                      <th className="px-3 py-2">Patient</th>
                      <th className="px-3 py-2">Specialty / Facility</th>
                      <th className="px-3 py-2">Referring Provider</th>
                      <th className="px-3 py-2">Appointment Date</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs">
                    {referrals.map((r: any) => (
                      <tr key={r.id} className="hover:bg-surface-sunken/40 font-sans">
                        <td className="px-3 py-2.5 font-mono font-medium text-grove-strong">
                          {r.referralNumber}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase font-bold ${r.direction === 'inbound' ? 'bg-info-soft text-info' : 'bg-grove-soft text-grove-strong'}`}>
                            {r.direction}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/patients/${r.patientId}`} className="font-medium text-ink hover:underline">
                            {r.patientName}
                          </Link>
                          <div className="font-mono text-[11px] text-ink-3">MRN: {r.mrn}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-ink">{r.specialty}</div>
                          <div className="text-[11px] text-ink-3">{r.facility}</div>
                        </td>
                        <td className="px-3 py-2.5 text-ink-2">
                          {r.referringProvider}
                        </td>
                        <td className="px-3 py-2.5 text-ink-3">
                          {date(r.appointmentDate || r.referralDate)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
