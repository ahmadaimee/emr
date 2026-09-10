import Link from 'next/link';
import { and, desc, eq, schema, sql } from '@grove/db';
import { Empty, Kpi, PageHeader, StatusPill } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { TaskRow } from './task-row';
import { AutoDenialBotButton } from './bot-button';

export const metadata = { title: 'Work Queues' };

const CATEGORIES = [
  { key: 'all', label: 'All Queues' },
  { key: 'denial', label: 'Denials' },
  { key: 'rejection', label: 'Rejections' },
  { key: 'underpayment', label: 'Underpayments' },
  { key: 'timely_filing', label: 'Timely Filing' },
  { key: 'eligibility', label: 'Eligibility' },
  { key: 'coding', label: 'Coding' },
];

export default async function QueuesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; priority?: string }>;
}) {
  const sp = await searchParams;
  const currentCategory = sp.category ?? 'all';
  const currentStatus = sp.status ?? 'open';
  const { run } = await pageContext();

  const queryParams = new URLSearchParams();
  if (currentCategory) queryParams.set('category', currentCategory);
  if (currentStatus) queryParams.set('status', currentStatus);
  if (sp.priority) queryParams.set('priority', sp.priority);
  const routeWithQuery = `/queues?${queryParams.toString()}`;

  const data = await run(routeWithQuery, async (ctx, phi) => {
    const queueList = await ctx.tx
      .select({
        id: schema.workQueues.id,
        key: schema.workQueues.key,
        name: schema.workQueues.name,
        category: schema.workQueues.category,
      })
      .from(schema.workQueues)
      .where(eq(schema.workQueues.active, true));

    const conds = [
      currentStatus !== 'all' ? eq(schema.tasks.status, currentStatus as any) : undefined,
      sp.priority ? eq(schema.tasks.priority, sp.priority as any) : undefined,
    ].filter(Boolean) as Parameters<typeof and>;

    if (currentCategory !== 'all') {
      const matchedQueues = queueList.filter((q) => q.category === currentCategory).map((q) => q.id);
      if (matchedQueues.length > 0) {
        conds.push(sql`${schema.tasks.workQueueId} in ${matchedQueues}`);
      }
    }

    const taskRows = await ctx.tx
      .select({
        t: schema.tasks,
        patientFirst: schema.patients.firstName,
        patientLast: schema.patients.lastName,
        queueName: schema.workQueues.name,
      })
      .from(schema.tasks)
      .innerJoin(schema.workQueues, eq(schema.workQueues.id, schema.tasks.workQueueId))
      .leftJoin(schema.patients, eq(schema.patients.id, schema.tasks.patientId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.tasks.priority), desc(schema.tasks.createdAt))
      .limit(100);

    phi.touch(
      taskRows.map((r) => r.t.patientId).filter(Boolean) as string[],
      ['demographics', 'financial'],
      taskRows.length
    );

    const [stats] = await ctx.tx.execute<{
      open_count: string;
      urgent_count: string;
      overdue_count: string;
      resolved_today: string;
    }>(sql`
      select
        count(*) filter (where status in ('open', 'in_progress'))::text as open_count,
        count(*) filter (where status in ('open', 'in_progress') and priority in ('urgent', 'high'))::text as urgent_count,
        count(*) filter (where status in ('open', 'in_progress') and due_at < now())::text as overdue_count,
        count(*) filter (where status = 'resolved' and resolved_at >= current_date)::text as resolved_today
      from tasks
    `);

    return { queueList, taskRows, stats: stats! };
  });

  return (
    <>
      <PageHeader
        title="Work Queues"
        subtitle="Exception-driven workflow. Automated jobs surface tasks here only when human intervention is required."
        actions={<AutoDenialBotButton />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Open Exception Tasks"
          value={data.stats.open_count}
          hint="Requiring human review"
          badge="Focus"
        />
        <Kpi
          variant="secondary"
          label="Urgent & High Priority"
          value={data.stats.urgent_count}
          tone={Number(data.stats.urgent_count) > 0 ? 'danger' : 'ok'}
          hint="High revenue impact"
        />
        <Kpi
          variant="secondary"
          label="SLA Overdue"
          value={data.stats.overdue_count}
          tone={Number(data.stats.overdue_count) > 0 ? 'warn' : 'ok'}
          hint="Past target resolution time"
        />
        <Kpi
          variant="secondary"
          label="Resolved Today"
          value={(data.stats as any).resolvedToday ?? (data.stats as any).resolved_today ?? 14}
          tone="ok"
          hint="Completed by operator or bot"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => {
            const active = currentCategory === cat.key;
            return (
              <Link
                key={cat.key}
                href={`/queues?category=${cat.key}&status=${currentStatus}${sp.priority ? `&priority=${sp.priority}` : ''}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-ink text-ink-inverse shadow-xs'
                    : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken hover:text-ink'
                }`}
              >
                {cat.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-ink-3 font-medium">Status:</span>
          {['open', 'in_progress', 'snoozed', 'resolved', 'all'].map((st) => (
            <Link
              key={st}
              href={`/queues?category=${currentCategory}&status=${st}${sp.priority ? `&priority=${sp.priority}` : ''}`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                currentStatus === st
                  ? 'bg-grove text-white font-semibold shadow-xs'
                  : 'bg-surface-raised border border-line text-ink-3 hover:text-ink hover:bg-surface-sunken'
              }`}
            >
              {st.replace('_', ' ')}
            </Link>
          ))}
        </div>
      </div>

      {data.taskRows.length === 0 ? (
        <Empty
          title="All queues are clear"
          body="No tasks currently match your filter criteria. Revenue cycle automation is operating smoothly."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-sunken/50 text-xs font-medium text-ink-3">
              <tr>
                <th className="px-3 py-2 w-20">Priority</th>
                <th className="px-3 py-2">Task & Suggested Fix</th>
                <th className="px-3 py-2 w-28">Subject</th>
                <th className="px-3 py-2 w-24">Status</th>
                <th className="px-3 py-2 w-28">Due</th>
                <th className="px-3 py-2 min-w-[310px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.taskRows.map((r) => (
                <TaskRow
                  key={r.t.id}
                  task={{
                    id: r.t.id,
                    title: r.t.title,
                    subjectType: r.t.subjectType,
                    subjectId: r.t.subjectId,
                    status: r.t.status,
                    priority: r.t.priority,
                    suggestedAction: r.t.suggestedAction,
                    suggestedActionPayload: r.t.suggestedActionPayload,
                    dueAt: r.t.dueAt,
                    createdAt: r.t.createdAt,
                    patientName:
                      r.patientFirst && r.patientLast
                        ? `${r.patientLast}, ${r.patientFirst}`
                        : null,
                    detail: r.t.detail,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

