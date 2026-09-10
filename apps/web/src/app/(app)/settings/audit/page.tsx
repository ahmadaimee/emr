import { desc, schema } from '@grove/db';
import { Card, Code, Empty, PageHeader } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { VerifyButton } from './verify-button';

export const metadata = { title: 'Compliance Audit Trail' };

export default async function AuditSettingsPage() {
  const { run } = await pageContext();

  const events = await run('/settings/audit', async (ctx) => {
    return ctx.tx
      .select({
        sequence: schema.auditEvents.sequence,
        occurredAt: schema.auditEvents.occurredAt,
        action: schema.auditEvents.action,
        resourceType: schema.auditEvents.resourceType,
        resourceId: schema.auditEvents.resourceId,
        actorType: schema.auditEvents.actorType,
        actorUserId: schema.auditEvents.actorUserId,
        actorLabel: schema.auditEvents.actorLabel,
        ipAddress: schema.auditEvents.ipAddress,
        hash: schema.auditEvents.hash,
      })
      .from(schema.auditEvents)
      .orderBy(desc(schema.auditEvents.sequence))
      .limit(100);
  });

  return (
    <>
      <PageHeader
        title="Compliance Audit Trail (45 CFR §164.312(b))"
        subtitle="Append-only, HMAC-SHA256 hash-chained immutable log capturing every PHI access and financial mutation."
        actions={<VerifyButton />}
      />

      <Card>
        {events.length === 0 ? (
          <Empty title="No audit events recorded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                <tr>
                  <th className="px-3 py-2 w-20">Seq #</th>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Actor / IP</th>
                  <th className="px-3 py-2 text-right">HMAC Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((e) => (
                  <tr key={String(e.sequence)} className="hover:bg-surface-sunken/40 font-mono text-xs">
                    <td className="px-3 py-2 font-semibold text-ink-2">{String(e.sequence)}</td>
                    <td className="px-3 py-2 text-ink-3 font-sans text-xs">
                      {relative(e.occurredAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          e.action === 'export' || e.action === 'delete'
                            ? 'bg-danger-soft text-danger'
                            : e.action === 'read'
                            ? 'bg-surface-sunken text-ink-3'
                            : 'bg-grove-soft text-grove-strong'
                        }`}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-ink">{e.resourceType}</span>
                      {e.resourceId ? (
                        <span className="text-ink-4 ml-1.5 text-[11px]">
                          ({e.resourceId.slice(0, 8)})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-sans text-xs text-ink-3">
                      <span>{e.actorLabel || e.actorType}</span>
                      {e.ipAddress ? <span className="ml-1.5 opacity-60">[{e.ipAddress}]</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-4 text-[11px]">
                      {e.hash ? `${e.hash.slice(0, 12)}…` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
