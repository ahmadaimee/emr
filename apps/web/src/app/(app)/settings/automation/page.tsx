import { schema, sql } from '@grove/db';
import { PageHeader } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { AutomationControls } from './controls';

export const metadata = { title: 'Automation Controls' };

export default async function AutomationSettingsPage() {
  const { run } = await pageContext();

  const settings = await run('/settings/automation', async (ctx) => {
    const [row] = await ctx.tx
      .select()
      .from(schema.automationSettings)
      .where(sql`practice_id is null`);

    return (
      row ?? {
        globalPaused: false,
        pausedReason: null,
        dryRun: true,
        autoEligibilityPreVisit: true,
        autoSecondaryClaims: true,
        autoSubmitSecondary: false,
        autoTransferPatientResponsibility: true,
        autoCorrectedClaims: false,
      }
    );
  });

  return (
    <>
      <PageHeader
        title="Revenue Cycle Automation"
        subtitle="Configure autonomous billing agents, eligibility pre-fetchers, COB generation, and emergency circuit breakers."
      />

      <div className="max-w-3xl">
        <AutomationControls settings={settings} />
      </div>
    </>
  );
}

