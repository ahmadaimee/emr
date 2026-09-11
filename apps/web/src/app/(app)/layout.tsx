import type { ReactNode } from 'react';
import { eq, schema, sql } from '@grove/db';
import { Shell } from '@/components/shell';
import { pageContext } from '@/lib/session';

// Authenticated pages carry PHI. Never statically render or cache them.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { session, run } = await pageContext();
  const { user, org, openTasks } = await run('/layout', async (ctx) => {
    const [user] = await ctx.tx.select({ firstName: schema.users.firstName, lastName: schema.users.lastName, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, session.actor.userId));
    const [org] = await ctx.tx.select({ name: schema.organizations.name }).from(schema.organizations).where(eq(schema.organizations.id, session.tenant.orgId));
    const [t] = await ctx.tx.select({ n: sql<number>`count(*)::int` }).from(schema.tasks).where(sql`status in ('open','in_progress')`);
    return { user: { name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(), email: user?.email ?? '' }, org: { name: org?.name ?? 'PracticeOS' }, openTasks: Number(t?.n ?? 0) };
  });
  return (
    <Shell user={user} org={org} openTasks={openTasks}>
      {children}
    </Shell>
  );
}
