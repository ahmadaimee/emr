import Link from 'next/link';
import { Card, Kpi, PageHeader } from '@/components/ui';
import { pageContext } from '@/lib/session';

export const metadata = { title: 'Billing & EDI Clearinghouse Setup' };

export default async function EdiSettingsPage() {
  const { run } = await pageContext();

  const data = await run('/settings/edi', async () => {
    return {
      edi: {
        clearinghouse: 'stedi_rest',
        clearinghouseName: 'Stedi Healthcare Cloud API (Active)',
        submitterId: 'GRV_SUB_99214',
        receiverId: 'STEDI_REC_001',
        isaQualifier: 'ZZ',
        isaSenderId: 'GROVEHEALTH    ',
        isaReceiverId: 'STEDICLEARING  ',
        gsSenderId: 'GROVEHEALTH',
        gsReceiverId: 'STEDICLEARING',
        defaultBillingPracticeId: 'prac-1',
        defaultRenderingProviderId: 'prv-1',
        autoAttachOriginalIcnOnResubmit: true,
        autoConvertFrequency7Replacement: true,
        autoPostEraRemittances: true,
        autoCheckEligibilityOnBooking: true,
        productionMode: false,
        lastPingAt: new Date(Date.now() - 1000 * 60 * 2),
      },
      practices: [],
      providers: [],
    };
  });

  const { edi, practices = [], providers = [] } = data;

  return (
    <>
      <PageHeader
        title="EDI Clearinghouse & Billing Setup"
        subtitle="Configure ANSI ASC X12 5010 transmission headers, interchange delimiters, and autonomous claim correction policies."
      />

      {/* Top EDI KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Active Clearinghouse"
          value="Stedi Cloud REST"
          hint="Direct REST connection"
          badge="EDI"
        />
        <Kpi
          variant="secondary"
          label="Submitter ISA ID"
          value={edi.isaSenderId.trim()}
          hint={`ISA05/06: ${edi.isaQualifier}/${edi.isaSenderId.trim()}`}
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Autonomous Correction"
          value="Enabled"
          hint="Type 7 replacement + ICN"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="Connection Health"
          value="24ms · 100%"
          hint="Clearinghouse heartbeat"
          tone="ok"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Interchange Envelope Configuration */}
        <Card title="ANSI ASC X12 Interchange Envelope (ISA / GS)">
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-ink-4 block font-medium mb-1">Clearinghouse Connector</label>
                <input
                  type="text"
                  readOnly
                  value={edi.clearinghouseName}
                  className="w-full h-8 rounded border border-line bg-surface-sunken px-2 text-ink font-semibold"
                />
              </div>
              <div>
                <label className="text-ink-4 block font-medium mb-1">Interchange Qualifier (ISA05)</label>
                <input
                  type="text"
                  readOnly
                  value="ZZ (Mutually Defined)"
                  className="w-full h-8 rounded border border-line bg-surface-sunken px-2 text-ink font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-ink-4 block font-medium mb-1">Interchange Sender ID (ISA06)</label>
                <input
                  type="text"
                  readOnly
                  value={edi.isaSenderId}
                  className="w-full h-8 rounded border border-line bg-surface-sunken px-2 font-mono text-ink"
                />
              </div>
              <div>
                <label className="text-ink-4 block font-medium mb-1">Interchange Receiver ID (ISA08)</label>
                <input
                  type="text"
                  readOnly
                  value={edi.isaReceiverId}
                  className="w-full h-8 rounded border border-line bg-surface-sunken px-2 font-mono text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-ink-4 block font-medium mb-1">Application Sender Code (GS02)</label>
                <input
                  type="text"
                  readOnly
                  value={edi.gsSenderId}
                  className="w-full h-8 rounded border border-line bg-surface-sunken px-2 font-mono text-ink"
                />
              </div>
              <div>
                <label className="text-ink-4 block font-medium mb-1">Application Receiver Code (GS03)</label>
                <input
                  type="text"
                  readOnly
                  value={edi.gsReceiverId}
                  className="w-full h-8 rounded border border-line bg-surface-sunken px-2 font-mono text-ink"
                />
              </div>
            </div>

            <div className="rounded-md bg-surface-sunken p-3 text-[11px] text-ink-3">
              <span className="font-semibold text-ink">Supported EDI Transactions:</span> 837P (Professional Claims), 835 (Remittance Advice), 270/271 (Eligibility & Benefit), 276/277 (Claim Status Inquiries), 999 (Implementation Acknowledgment).
            </div>
          </div>
        </Card>

        {/* Autonomous Autopilot & Denial Rules Policies */}
        <Card title="Autonomous RCM & Denial Submission Policies">
          <div className="space-y-4 text-xs">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <div className="font-semibold text-ink">Auto-Attach Original ICN Number (Loop 2300 REF*F8)</div>
                <div className="text-ink-3 text-[11px]">
                  When a denial or appeal is corrected, automatically pull the original Payer Claim Control Number (ICN/CCN) from the 835 remittance and inject it into Box 22.
                </div>
              </div>
              <span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok text-[11px]">Active</span>
            </div>

            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <div className="font-semibold text-ink">Auto-Convert to Frequency Code 7 (Replacement Claim)</div>
                <div className="text-ink-3 text-[11px]">
                  Automatically sets CLM05-3 to &apos;7&apos; on resubmissions so payers process as a corrected claim rather than rejecting as a duplicate (CO-18).
                </div>
              </div>
              <span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok text-[11px]">Active</span>
            </div>

            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <div className="font-semibold text-ink">Auto-Post Balanced 835 Electronic Remittances</div>
                <div className="text-ink-3 text-[11px]">
                  Automatically reconcile matching claim payments and ledger entries when variance is $0.00.
                </div>
              </div>
              <span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok text-[11px]">Active</span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-ink">Auto-Check 270 Eligibility on Patient Booking</div>
                <div className="text-ink-3 text-[11px]">
                  Sweep appointments 48 hours prior to DOS and trigger real-time 270 inquiry.
                </div>
              </div>
              <span className="rounded bg-ok-soft px-2 py-0.5 font-bold text-ok text-[11px]">Active</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
