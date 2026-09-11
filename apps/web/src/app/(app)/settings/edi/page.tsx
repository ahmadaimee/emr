import Link from 'next/link';
import { schema, sql } from '@grove/db';
import { Card, Kpi, PageHeader } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { EdiForm } from './edi-form';

export const metadata = { title: 'Billing & EDI Clearinghouse Setup' };

export default async function EdiSettingsPage() {
  const { run } = await pageContext();

  const data = await run('/settings/edi', async (ctx) => {
    const [org] = await ctx.tx.select().from(schema.organizations).where(sql`id = ${ctx.tenant.orgId}`);
    const [automation] = await ctx.tx.select().from(schema.automationSettings).where(sql`org_id = ${ctx.tenant.orgId} and practice_id is null`);
    return { org, automation };
  });

  const org = data?.org;
  const automation = data?.automation;

  const connector = process.env.CLEARINGHOUSE_PROVIDER ?? 'mock';
  const hasStediKey = Boolean(process.env.STEDI_API_KEY);
  const hasWebhookSecret = Boolean(process.env.STEDI_WEBHOOK_SECRET);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.<your-domain>';

  return (
    <>
      <div className="mb-2 text-xs text-ink-3">
        <Link href="/settings/setup" className="hover:underline">
          Practice Setup
        </Link>{' '}
        / EDI & Clearinghouse
      </div>

      <PageHeader
        title="EDI Clearinghouse & Billing Setup"
        subtitle="ANSI ASC X12 5010 submitter identity, connector status, and real-time delivery. See Clearinghouse Setup in the engineering vault for how to go live."
      />

      {/* Top EDI KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Active Connector"
          value={connector === 'mock' ? 'Mock (offline)' : connector === 'stedi' ? 'Stedi Cloud API' : connector}
          hint={connector === 'mock' ? 'No live transmission — set CLEARINGHOUSE_PROVIDER' : 'Direct REST connection'}
          badge="EDI"
          tone={connector === 'mock' ? 'warn' : 'ok'}
        />
        <Kpi
          variant="secondary"
          label="API Credential"
          value={connector === 'stedi' ? (hasStediKey ? 'Configured' : 'Missing') : '—'}
          tone={connector !== 'stedi' ? undefined : hasStediKey ? 'ok' : 'danger'}
        />
        <Kpi
          variant="secondary"
          label="Real-Time Webhook"
          value={hasWebhookSecret ? 'Configured' : 'Polling only'}
          hint={hasWebhookSecret ? 'Accelerates 835/277CA pickup' : 'Set STEDI_WEBHOOK_SECRET'}
          tone={hasWebhookSecret ? 'ok' : 'warn'}
        />
        <Kpi
          variant="secondary"
          label="Usage Indicator"
          value={org?.ediUsageIndicator === 'P' ? 'Production' : 'Test'}
          hint="ISA15 — governs every outbound envelope"
          tone={org?.ediUsageIndicator === 'P' ? 'ok' : 'warn'}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="ANSI ASC X12 Submitter Identity (ISA / GS)">
          {org ? (
            <EdiForm org={{ ediSubmitterId: org.ediSubmitterId ?? '', ediSubmitterName: org.ediSubmitterName ?? '', ediUsageIndicator: (org.ediUsageIndicator as 'T' | 'P') ?? 'T' }} />
          ) : (
            <p className="text-xs text-ink-3">No organization record found for this session.</p>
          )}
          <div className="mt-4 rounded-md bg-surface-sunken p-3 text-[11px] text-ink-3">
            <span className="font-semibold text-ink">Supported EDI Transactions:</span> 837P/837I (claims), 835 (remittance),
            270/271 (eligibility), 276/277 (claim status), 277CA (claim acknowledgement), 278 (prior authorization), 999
            (functional acknowledgement).
          </div>
        </Card>

        <Card title="Real-Time Delivery">
          <div className="space-y-3 text-xs text-ink-2">
            <p>
              Today's default is polling: eligibility and remittance jobs run on a schedule, and a rejected/accepted claim
              is picked up by a retrying background job. Configuring a webhook accelerates that — the clearinghouse tells
              Grove the moment a 999, 277CA, or 835 is ready, instead of waiting for the next scheduled check.
            </p>
            <div className="rounded-md border border-line bg-surface-sunken p-3">
              <div className="mb-1 font-semibold text-ink">Webhook endpoint to configure in Stedi</div>
              <code className="block break-all rounded bg-surface px-2 py-1 font-mono text-[11px] text-ink-2">{apiBase}/v1/webhooks/stedi</code>
              <div className="mt-2 text-[11px] text-ink-3">
                Set the event destination's credential to an API Key sending <code>Authorization: Bearer &lt;secret&gt;</code>,
                and set that same secret as <code>STEDI_WEBHOOK_SECRET</code> in this deployment's environment.
              </div>
            </div>
            <p className={hasWebhookSecret ? 'text-ok' : 'text-warn'}>
              {hasWebhookSecret ? '✓ A webhook secret is configured — real-time delivery is active.' : '○ No webhook secret configured — running on polling only, which still works, just slower.'}
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Autonomous RCM Policies">
          <p className="mb-3 text-xs text-ink-3">
            These are live settings, not decoration — change them on the{' '}
            <Link href="/settings/automation" className="text-grove-strong hover:underline">Automation</Link> page.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PolicyRow label="Auto-post balanced 835 remittances" active />
            <PolicyRow label="Auto-transfer patient responsibility (PR codes)" active={automation?.autoTransferPatientResponsibility ?? false} />
            <PolicyRow label="Auto-generate corrected claims (frequency 7)" active={automation?.autoCorrectedClaims ?? false} />
            <PolicyRow label="Auto-submit claims on schedule" active={automation?.autoSubmitReadyClaims ?? false} />
          </div>
        </Card>
      </div>
    </>
  );
}

function PolicyRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2 text-xs">
      <span className="text-ink-2">{label}</span>
      <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-ok-soft text-ok' : 'bg-surface-sunken text-ink-3'}`}>
        {active ? 'Active' : 'Off'}
      </span>
    </div>
  );
}
