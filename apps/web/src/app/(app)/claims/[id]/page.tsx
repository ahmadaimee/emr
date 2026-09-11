import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, inArray, schema } from '@grove/db';
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

    const customStatuses = await ctx.tx
      .select({ id: schema.claimCustomStatuses.id, label: schema.claimCustomStatuses.label, color: schema.claimCustomStatuses.color })
      .from(schema.claimCustomStatuses)
      .where(and(eq(schema.claimCustomStatuses.orgId, ctx.tenant.orgId), eq(schema.claimCustomStatuses.active, true)))
      .orderBy(schema.claimCustomStatuses.sortOrder);

    // Follow-up: the work-queue task carrying this claim, if any human work has been
    // filed against it (by automation or manually).
    const [taskRow] = await ctx.tx
      .select({ t: schema.tasks, queueName: schema.workQueues.name })
      .from(schema.tasks)
      .leftJoin(schema.workQueues, eq(schema.workQueues.id, schema.tasks.workQueueId))
      .where(and(eq(schema.tasks.orgId, ctx.tenant.orgId), eq(schema.tasks.subjectType, 'claim'), eq(schema.tasks.subjectId, id)))
      .orderBy(desc(schema.tasks.createdAt))
      .limit(1);
    const assignee = taskRow?.t.assignedTo
      ? (await ctx.tx.select({ firstName: schema.users.firstName, lastName: schema.users.lastName }).from(schema.users).where(eq(schema.users.id, taskRow.t.assignedTo)))[0]
      : null;
    const followUpTask = taskRow
      ? { ...taskRow.t, queueName: taskRow.queueName, assigneeName: assignee ? `${assignee.firstName} ${assignee.lastName}` : null }
      : null;

    const orgUsers = await ctx.tx
      .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users)
      .where(and(eq(schema.users.orgId, ctx.tenant.orgId), eq(schema.users.status, 'active')))
      .orderBy(schema.users.firstName);

    const workQueues = await ctx.tx
      .select({ key: schema.workQueues.key, name: schema.workQueues.name })
      .from(schema.workQueues)
      .where(and(eq(schema.workQueues.orgId, ctx.tenant.orgId), eq(schema.workQueues.active, true)))
      .orderBy(schema.workQueues.name);

    // Insurance eligibility: the most recent 270/271 check on file for this claim's coverage.
    const [eligibilityCheck] = await ctx.tx
      .select()
      .from(schema.eligibilityChecks)
      .where(eq(schema.eligibilityChecks.coverageId, a.coverage.id))
      .orderBy(desc(schema.eligibilityChecks.createdAt))
      .limit(1);

    // Every coverage on file for this patient, primary through tertiary — not just the
    // one this claim bills — so the operator can see the full COB picture at a glance.
    const patientCoverages = await ctx.tx
      .select({ c: schema.coverages, payerName: schema.payers.name })
      .from(schema.coverages)
      .innerJoin(schema.payers, eq(schema.payers.id, schema.coverages.payerId))
      .where(eq(schema.coverages.patientId, a.patient.id))
      .orderBy(schema.coverages.rank);

    const activeProviders = await ctx.tx
      .select({ id: schema.providers.id, firstName: schema.providers.firstName, lastName: schema.providers.lastName, npi: schema.providers.npi })
      .from(schema.providers)
      .where(and(eq(schema.providers.practiceId, a.practice.id), eq(schema.providers.active, true)))
      .orderBy(schema.providers.lastName);

    // The billing provider isn't part of the standard claim assembly (only rendering,
    // referring, and supervising are), so it's resolved separately here.
    const [billingProvider] = a.encounter.billingProviderId
      ? await ctx.tx.select().from(schema.providers).where(eq(schema.providers.id, a.encounter.billingProviderId))
      : [];

    // A provider assigned to this claim may since have been deactivated — still show
    // them in the picker (and by name) rather than silently blanking the field out.
    const assignedProviderIds = [a.encounter.renderingProviderId, a.encounter.billingProviderId, a.encounter.supervisingProviderId, a.encounter.referringProviderId].filter(
      (pid): pid is string => Boolean(pid) && !activeProviders.some((p) => p.id === pid),
    );
    const inactiveAssignedProviders = assignedProviderIds.length
      ? await ctx.tx
          .select({ id: schema.providers.id, firstName: schema.providers.firstName, lastName: schema.providers.lastName, npi: schema.providers.npi })
          .from(schema.providers)
          .where(inArray(schema.providers.id, assignedProviderIds))
      : [];
    const practiceProviders = [...activeProviders, ...inactiveAssignedProviders].sort((x, y) => x.lastName.localeCompare(y.lastName));

    const providerNames = {
      renderingProviderId: a.renderingProvider ? `${a.renderingProvider.lastName}, ${a.renderingProvider.firstName}` : null,
      billingProviderId: billingProvider ? `${billingProvider.lastName}, ${billingProvider.firstName}` : null,
      supervisingProviderId: a.supervisingProvider ? `${a.supervisingProvider.lastName}, ${a.supervisingProvider.firstName}` : null,
      referringProviderId: a.referringProvider ? `${a.referringProvider.lastName}, ${a.referringProvider.firstName}` : null,
    };

    const mockDetail = getMockClaimDetail(id);

    return {
      a,
      customStatuses,
      findings,
      versions,
      submissions,
      acks,
      transitions,
      remits,
      denials,
      activity,
      ledger,
      followUpTask,
      orgUsers,
      workQueues,
      eligibilityCheck: eligibilityCheck ?? null,
      patientCoverages,
      practiceProviders,
      providerNames,
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
