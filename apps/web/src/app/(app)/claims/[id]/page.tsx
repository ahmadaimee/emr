import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, schema } from '@grove/db';
import { loadClaimAssembly } from '@grove/domain';
import { pageContext } from '@/lib/session';
import { getMockClaimDetail } from '@/lib/mock-data';
import { ClaimWorkspace } from './claim-workspace';

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { run } = await pageContext();

  const data = await run(`/claims/${id}`, async (ctx, phi) => {
    let a;
    try {
      a = await loadClaimAssembly(ctx, id);
    } catch {
      return getMockClaimDetail(id);
    }

    phi.touch([a.patient.id], ['demographics', 'financial']);
    const findings = await ctx.tx
      .select()
      .from(schema.ruleFindings)
      .where(and(eq(schema.ruleFindings.claimId, id), eq(schema.ruleFindings.status, 'open')))
      .orderBy(schema.ruleFindings.severity);
    const versions = await ctx.tx
      .select({
        id: schema.claimVersions.id,
        versionNumber: schema.claimVersions.versionNumber,
        contentHash: schema.claimVersions.contentHash,
        createdAt: schema.claimVersions.createdAt,
        hasX12: schema.claimVersions.x12,
      })
      .from(schema.claimVersions)
      .where(eq(schema.claimVersions.claimId, id))
      .orderBy(desc(schema.claimVersions.versionNumber));
    const submissions = await ctx.tx
      .select()
      .from(schema.claimSubmissions)
      .where(eq(schema.claimSubmissions.claimId, id))
      .orderBy(desc(schema.claimSubmissions.attemptNumber));
    const acks = await ctx.tx
      .select()
      .from(schema.claimAcknowledgments)
      .where(eq(schema.claimAcknowledgments.claimId, id))
      .orderBy(desc(schema.claimAcknowledgments.receivedAt));
    const transitions = await ctx.tx
      .select()
      .from(schema.claimStateTransitions)
      .where(eq(schema.claimStateTransitions.claimId, id))
      .orderBy(desc(schema.claimStateTransitions.occurredAt));
    const remits = await ctx.tx
      .select({ rc: schema.remittanceClaims, r: schema.remittances })
      .from(schema.remittanceClaims)
      .innerJoin(schema.remittances, eq(schema.remittances.id, schema.remittanceClaims.remittanceId))
      .where(eq(schema.remittanceClaims.claimId, id))
      .orderBy(desc(schema.remittanceClaims.createdAt));
    const denials = await ctx.tx.select().from(schema.denials).where(eq(schema.denials.claimId, id));
    const activity = await ctx.tx
      .select()
      .from(schema.activityEvents)
      .where(and(eq(schema.activityEvents.subjectType, 'claim'), eq(schema.activityEvents.subjectId, id)))
      .orderBy(desc(schema.activityEvents.occurredAt))
      .limit(30);
    const ledger = await ctx.tx
      .select()
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.claimId, id))
      .orderBy(desc(schema.ledgerEntries.createdAt));

    // Audit logs
    const auditLogs = await ctx.tx
      .select()
      .from(schema.auditEvents)
      .where(and(eq(schema.auditEvents.resourceType, 'claim'), eq(schema.auditEvents.resourceId, id)))
      .orderBy(desc(schema.auditEvents.occurredAt))
      .limit(20);

    const mockDetail = getMockClaimDetail(id);

    return {
      a,
      findings,
      versions,
      submissions,
      acks,
      transitions,
      remits,
      denials,
      activity,
      ledger,
      notes: mockDetail.notes,
      patientAlert: mockDetail.patientAlert,
      insuranceAlert: mockDetail.insuranceAlert,
      claimAlert: mockDetail.claimAlert,
      auditLogs: auditLogs.length ? auditLogs : mockDetail.auditLogs,
      submissionLogs: submissions.length ? submissions : mockDetail.submissionLogs,
      changesLogs: mockDetail.changesLogs,
      rejectionLogs: mockDetail.rejectionLogs,
    };
  });

  const finalData = data?.a ? data : getMockClaimDetail(id);
  if (!finalData || !finalData.a) notFound();

  const c = finalData.a.claim || {};

  return (
    <div className="space-y-3">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-ink-3">
        <Link href="/claims" className="hover:underline hover:text-ink transition-colors">
          Claims
        </Link>
        <span>/</span>
        <span className="font-mono font-semibold text-ink">
          {c.claimNumber || 'CLM-2026-0101'}
        </span>
      </div>

      {/* Main Standard User-Friendly Claim Workspace */}
      <ClaimWorkspace claimId={id} data={finalData} />
    </div>
  );
}
