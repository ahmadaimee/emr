import Link from 'next/link';
import { notFound } from 'next/navigation';
import { appendAuditEvent } from '@grove/audit';
import { and, eq, schema } from '@grove/db';
import { PageHeader } from '@/components/ui';
import { pageContext } from '@/lib/session';

/** The exact 837 sent. Viewing it is an audited PHI export. */
export default async function X12Page({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const { run, session } = await pageContext();
  const v = await run(`/claims/${id}/x12`, async (ctx, phi) => {
    const [row] = await ctx.tx.select({ v: schema.claimVersions, claimNumber: schema.claims.claimNumber, patientId: schema.claims.patientId }).from(schema.claimVersions).innerJoin(schema.claims, eq(schema.claims.id, schema.claimVersions.claimId)).where(and(eq(schema.claimVersions.id, versionId), eq(schema.claimVersions.claimId, id)));
    if (!row) return null;
    phi.touch([row.patientId], ['demographics', 'financial']);
    phi.markExport();
    await appendAuditEvent(ctx.tx, { orgId: ctx.tenant.orgId, action: 'export', resourceType: 'claim_version', resourceId: versionId, patientId: row.patientId, actorUserId: session.actor.userId, sessionId: session.sessionId, requestId: ctx.tenant.requestId, context: { format: 'x12_837' } });
    return row;
  });
  if (!v) notFound();
  const segments = (v.v.x12 ?? '').split('~').filter(Boolean);
  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/claims/${id}`} className="hover:underline">{v.claimNumber}</Link> / version {v.v.versionNumber}</div>
      <PageHeader title="837P as transmitted" subtitle={<span>Content hash <span className="g-mono">{v.v.contentHash}</span></span>} />
      <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
        <ol className="divide-y divide-line font-mono text-xs">
          {segments.map((s, i) => {
            const [id0, ...rest] = s.split('*');
            return (
              <li key={i} className="flex gap-3 px-4 py-1">
                <span className="w-8 shrink-0 text-ink-4">{i + 1}</span>
                <span className="w-10 shrink-0 font-semibold text-grove-strong">{id0}</span>
                <span className="whitespace-pre-wrap break-all text-ink-2">{rest.join('*')}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
