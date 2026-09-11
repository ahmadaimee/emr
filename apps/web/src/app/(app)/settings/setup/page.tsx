import Link from 'next/link';
import { eq, schema, sql } from '@grove/db';
import { Card, PageHeader } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { getMockProvidersData } from '@/lib/mock-data';

export const metadata = { title: 'Practice Setup' };

type StepStatus = 'done' | 'partial' | 'missing';

interface Step {
  key: string;
  title: string;
  detail: string;
  status: StepStatus;
  note: string;
  href: string;
  cta: string;
}

export default async function SetupWizardPage() {
  const { run } = await pageContext();

  const data = await run('/settings/setup', async (ctx) => {
    const [org] = await ctx.tx.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.tenant.orgId));
    const settings = (org?.settings ?? {}) as { phone?: string; email?: string };

    const practices = await ctx.tx.select().from(schema.practices).where(eq(schema.practices.orgId, ctx.tenant.orgId));
    const locationCount = practices.length
      ? Number((await ctx.tx.execute<{ n: string }>(sql`select count(*)::text as n from locations where org_id = ${ctx.tenant.orgId}`))[0]?.n ?? 0)
      : 0;

    const feeScheduleCount = Number((await ctx.tx.execute<{ n: string }>(sql`select count(*)::text as n from fee_schedules where org_id = ${ctx.tenant.orgId}`))[0]?.n ?? 0);
    const enrollmentCount = Number((await ctx.tx.execute<{ n: string }>(sql`select count(*)::text as n from provider_enrollments where org_id = ${ctx.tenant.orgId} and status = 'participating'`))[0]?.n ?? 0);
    const baaCount = Number((await ctx.tx.execute<{ n: string }>(sql`select count(*)::text as n from documents where org_id = ${ctx.tenant.orgId} and kind = 'baa'`))[0]?.n ?? 0);
    const patientCount = Number((await ctx.tx.execute<{ n: string }>(sql`select count(*)::text as n from patients where org_id = ${ctx.tenant.orgId}`))[0]?.n ?? 0);

    const practicesWithNpiAndTax = practices.filter((p) => p.npi && p.taxId).length;
    const eftActive = practices.filter((p) => p.eftEnrollmentStatus === 'active').length;
    const eftSubmitted = practices.filter((p) => p.eftEnrollmentStatus !== 'not_started').length;

    return {
      orgFilledIn: Boolean(org?.name && settings.phone && settings.email),
      practiceCount: practices.length,
      practicesWithNpiAndTax,
      locationCount,
      feeScheduleCount,
      enrollmentCount,
      baaCount,
      patientCount,
      eftActive,
      eftSubmitted,
      practiceTotal: practices.length,
      ediSubmitterId: org?.ediSubmitterId ?? null,
    };
  });

  const providersCount = (() => {
    try {
      return getMockProvidersData().providers.length;
    } catch {
      return 0;
    }
  })();

  const connector = process.env.CLEARINGHOUSE_PROVIDER ?? 'mock';
  const hasWebhook = Boolean(process.env.STEDI_WEBHOOK_SECRET);

  const steps: Step[] = [
    {
      key: 'org', title: '1. Billing company identity',
      detail: 'Legal name, DBA, phone, and billing email on file.',
      status: data?.orgFilledIn ? 'done' : 'missing',
      note: data?.orgFilledIn ? 'Complete.' : 'Fill in phone and billing email — claims correspondence needs somewhere to go back to.',
      href: '/settings/organization', cta: 'Edit identity',
    },
    {
      key: 'practices', title: '2. Client practices',
      detail: 'At least one practice with a group NPI and Tax ID — nothing can be billed without one.',
      status: !data?.practiceCount ? 'missing' : data.practicesWithNpiAndTax === data.practiceCount ? 'done' : 'partial',
      note: !data?.practiceCount ? 'No practices yet.' : `${data.practicesWithNpiAndTax} of ${data.practiceCount} practice(s) have both NPI and Tax ID set.`,
      href: '/settings/organization', cta: 'Manage practices',
    },
    {
      key: 'locations', title: '3. Service locations',
      detail: 'Every practice needs at least one physical location — it sets the MAC jurisdiction and place of service.',
      status: !data?.locationCount ? 'missing' : 'done',
      note: `${data?.locationCount ?? 0} location(s) on file.`,
      href: '/settings/organization', cta: 'Add a location',
    },
    {
      key: 'providers', title: '4. Providers',
      detail: 'NPI, taxonomy, DEA, state license, CAQH number, malpractice insurance, board certifications.',
      status: providersCount > 0 ? 'done' : 'missing',
      note: `${providersCount} provider(s) enrolled in the roster.`,
      href: '/settings/providers', cta: 'Enroll a provider',
    },
    {
      key: 'payer-enrollment', title: '5. Payer enrollment',
      detail: 'A provider isn’t billable to a payer until that payer confirms it — track PTAN, provider number, and status per payer.',
      status: (data?.enrollmentCount ?? 0) > 0 ? 'done' : 'missing',
      note: `${data?.enrollmentCount ?? 0} participating enrollment(s) recorded.`,
      href: '/settings/providers', cta: 'Record an enrollment',
    },
    {
      key: 'fee-schedules', title: '6. Fee schedules',
      detail: 'Contracted rates per payer — without these, underpayment detection has nothing to compare against.',
      status: data?.feeScheduleCount ? 'done' : 'missing',
      note: `${data?.feeScheduleCount ?? 0} fee schedule(s) loaded.`,
      href: '/settings/fee-schedules', cta: 'Load a fee schedule',
    },
    {
      key: 'edi', title: '7. EDI / clearinghouse',
      detail: 'Submitter ID, usage indicator, and an active clearinghouse connector.',
      status: data?.ediSubmitterId && connector !== 'mock' ? 'done' : data?.ediSubmitterId ? 'partial' : 'missing',
      note: !data?.ediSubmitterId ? 'No submitter ID configured yet.' : connector === 'mock' ? 'Submitter ID is set, but the connector is still Mock (offline).' : `Connected via ${connector}.`,
      href: '/settings/edi', cta: 'Configure EDI',
    },
    {
      key: 'realtime', title: '8. Real-time delivery (optional)',
      detail: 'A webhook accelerates ERA/277CA pickup from a schedule down to seconds. Polling works without it.',
      status: hasWebhook ? 'done' : 'partial',
      note: hasWebhook ? 'Webhook secret configured.' : 'Running on polling only — this is fine, just slower.',
      href: '/settings/edi', cta: 'Set up webhook',
    },
    {
      key: 'eft', title: '9. EFT enrollment',
      detail: 'Enroll each practice for electronic payer deposits — usually via CAQH EnrollHub, tracked here as a status only (Grove never stores the bank account/routing number itself).',
      status: data?.practiceTotal && data.eftActive === data.practiceTotal ? 'done' : (data?.eftSubmitted ?? 0) > 0 ? 'partial' : 'missing',
      note: `${data?.eftActive ?? 0} of ${data?.practiceTotal ?? 0} practice(s) actively enrolled for EFT.`,
      href: '/settings/organization', cta: 'Update EFT status',
    },
    {
      key: 'baa', title: '10. Business Associate Agreements',
      detail: 'A signed BAA is required before PHI can flow to this software or the clearinghouse.',
      status: (data?.baaCount ?? 0) > 0 ? 'done' : 'missing',
      note: `${data?.baaCount ?? 0} BAA document(s) on file.`,
      href: '/settings/organization', cta: 'Upload a BAA',
    },
    {
      key: 'migrate', title: '11. Migrate from a prior system (optional)',
      detail: 'Coming from another PM/EHR? Import existing patients, coverage, and opening balances by CSV instead of re-keying them.',
      status: (data?.patientCount ?? 0) > 0 ? 'done' : 'partial',
      note: `${data?.patientCount ?? 0} patient(s) on file.`,
      href: '/patients', cta: 'Import patients',
    },
  ];

  const done = steps.filter((s) => s.status === 'done').length;
  const pctComplete = Math.round((100 * done) / steps.length);

  return (
    <>
      <PageHeader
        title="Practice Setup"
        subtitle="Everything a new practice needs before it can bill — in order. Software configuration here takes minutes; payer enrollment (steps 5 and 9) runs on the payer's own clock, commonly 6–16+ weeks."
      />

      <Card title={`Setup progress — ${done} of ${steps.length} complete (${pctComplete}%)`}>
        <div className="h-2 w-full bg-surface-sunken">
          <div className="h-full bg-grove transition-all" style={{ width: `${pctComplete}%` }} />
        </div>
        <div className="divide-y divide-line">
          {steps.map((s) => (
            <div key={s.key} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusDot status={s.status} />
                  <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
                </div>
                <p className="mt-0.5 text-xs text-ink-3">{s.detail}</p>
                <p className="mt-1 text-xs font-medium text-ink-2">{s.note}</p>
              </div>
              <Link
                href={s.href}
                className="h-8 shrink-0 rounded-md border border-line-strong px-3 text-xs font-medium text-ink-2 hover:bg-surface-sunken flex items-center"
              >
                {s.cta} →
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function StatusDot({ status }: { status: StepStatus }) {
  const cls = status === 'done' ? 'bg-ok' : status === 'partial' ? 'bg-warn' : 'bg-line-strong';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}
