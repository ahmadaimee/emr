import { desc, schema } from '@grove/db';
import { PageHeader } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { ClaimStatusesManager } from './claim-statuses-manager';

export const metadata = { title: 'Claim Statuses' };

export default async function ClaimStatusesPage() {
  const { run } = await pageContext();

  const statuses = await run('/settings/claim-statuses', async (ctx) => {
    const rows = await ctx.tx
      .select({ id: schema.claimCustomStatuses.id, label: schema.claimCustomStatuses.label, color: schema.claimCustomStatuses.color, active: schema.claimCustomStatuses.active })
      .from(schema.claimCustomStatuses)
      .orderBy(desc(schema.claimCustomStatuses.active), schema.claimCustomStatuses.sortOrder);
    return rows;
  });

  return (
    <>
      <PageHeader
        title="Claim Statuses"
        subtitle="System statuses (Ready, Submitted, Paid, Denied, ...) are fixed — real automation reads and writes them. These custom labels are yours to define, and never drive automation."
      />
      <div className="max-w-2xl">
        <ClaimStatusesManager statuses={statuses ?? []} />
      </div>
    </>
  );
}
