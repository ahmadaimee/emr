import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, schema } from '@grove/db';
import { loadClaimAssembly } from '@grove/domain';
import { Card, Code, Field, Money, PageHeader, Severity, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';
import { ClaimActions, FindingActions } from './actions-ui';

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { run } = await pageContext();

  const data = await run(`/claims/${id}`, async (ctx, phi) => {
    let a;
    try {
      a = await loadClaimAssembly(ctx, id);
    } catch {
      return null;
    }
    phi.touch([a.patient.id], ['demographics', 'financial']);
    const findings = await ctx.tx.select().from(schema.ruleFindings).where(and(eq(schema.ruleFindings.claimId, id), eq(schema.ruleFindings.status, 'open'))).orderBy(schema.ruleFindings.severity);
    const versions = await ctx.tx.select({ id: schema.claimVersions.id, versionNumber: schema.claimVersions.versionNumber, contentHash: schema.claimVersions.contentHash, createdAt: schema.claimVersions.createdAt, hasX12: schema.claimVersions.x12 }).from(schema.claimVersions).where(eq(schema.claimVersions.claimId, id)).orderBy(desc(schema.claimVersions.versionNumber));
    const submissions = await ctx.tx.select().from(schema.claimSubmissions).where(eq(schema.claimSubmissions.claimId, id)).orderBy(desc(schema.claimSubmissions.attemptNumber));
    const acks = await ctx.tx.select().from(schema.claimAcknowledgments).where(eq(schema.claimAcknowledgments.claimId, id)).orderBy(desc(schema.claimAcknowledgments.receivedAt));
    const transitions = await ctx.tx.select().from(schema.claimStateTransitions).where(eq(schema.claimStateTransitions.claimId, id)).orderBy(desc(schema.claimStateTransitions.occurredAt));
    const remits = await ctx.tx.select({ rc: schema.remittanceClaims, r: schema.remittances }).from(schema.remittanceClaims).innerJoin(schema.remittances, eq(schema.remittances.id, schema.remittanceClaims.remittanceId)).where(eq(schema.remittanceClaims.claimId, id)).orderBy(desc(schema.remittanceClaims.createdAt));
    const denials = await ctx.tx.select().from(schema.denials).where(eq(schema.denials.claimId, id));
    const activity = await ctx.tx.select().from(schema.activityEvents).where(and(eq(schema.activityEvents.subjectType, 'claim'), eq(schema.activityEvents.subjectId, id))).orderBy(desc(schema.activityEvents.occurredAt)).limit(30);
    const ledger = await ctx.tx.select().from(schema.ledgerEntries).where(eq(schema.ledgerEntries.claimId, id)).orderBy(desc(schema.ledgerEntries.createdAt));
    return { a, findings, versions, submissions, acks, transitions, remits, denials, activity, ledger };
  });
  if (!data) notFound();
  const { a, findings, versions, submissions, acks, transitions, remits, denials, activity, ledger } = data;
  const c = a.claim;
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/claims" className="hover:underline">Claims</Link> / <span className="g-mono">{c.claimNumber}</span></div>
      <PageHeader
        title={`${a.patient.lastName}, ${a.patient.firstName}`}
        subtitle={<span className="flex items-center gap-2"><StatusPill status={c.status} /> <span>{a.payer.name}</span> · <span>{c.coverageRank}</span> · DOS {date(c.serviceDateFrom)} · <Link href={`/patients/${a.patient.id}`} className="hover:underline">MRN {a.patient.mrn}</Link></span>}
        actions={<ClaimActions claimId={c.id} status={c.status} errors={errors} warnings={warnings} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={findings.length ? `${findings.length} finding${findings.length === 1 ? '' : 's'}` : 'Scrub findings'}>
            {findings.length === 0 ? (
              <div className="px-4 py-3 text-sm text-ink-3">{c.status === 'draft' ? 'Not yet scrubbed.' : 'No open findings. This claim is clean.'}</div>
            ) : (
              <ul className="divide-y divide-line">
                {findings.map((f) => {
                  const ev = (f.evidence ?? {}) as Record<string, unknown>;
                  const fix = f.suggestedFix as { action?: string; explanation?: string; value?: unknown } | null;
                  return (
                    <li key={f.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Severity severity={f.severity} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm">{f.message}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                            <span>{String(ev['ruleName'] ?? ev['ruleKey'] ?? 'rule')}</span>
                            <span className="text-ink-4">{String(ev['source'] ?? '')}</span>
                            {f.path ? <Code>{f.path}</Code> : null}
                          </div>
                          {fix?.explanation ? <div className="mt-2 rounded-md bg-surface-sunken px-3 py-2 text-xs text-ink-2"><span className="font-medium text-ink">Suggested fix:</span> {fix.explanation}{fix.value !== undefined ? <> <Code>{JSON.stringify(fix.value)}</Code></> : null}</div> : null}
                        </div>
                        <FindingActions findingId={f.id} claimId={c.id} severity={f.severity} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Service lines">
            <table className="g-table">
              <thead><tr><th>#</th><th>DOS</th><th>CPT</th><th>Modifiers</th><th>Dx</th><th>POS</th><th className="text-right">Units</th><th className="text-right">Charge</th><th className="text-right">Allowed</th><th className="text-right">Paid</th><th className="text-right">Adj</th><th className="text-right">Patient</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {a.lines.map((l) => (
                  <tr key={l.id} className={l.voidedAt ? 'line-through opacity-50' : ''}>
                    <td className="text-ink-3">{l.lineNumber}</td>
                    <td>{date(l.serviceDate)}</td>
                    <td><Code>{l.procedureCode}</Code></td>
                    <td><Code>{[l.modifier1, l.modifier2, l.modifier3, l.modifier4].filter(Boolean).join(' ')}</Code></td>
                    <td><Code>{l.diagnosisPointers.map((p) => 'ABCDEFGHIJKL'[p - 1]).join('')}</Code></td>
                    <td>{l.placeOfService ?? a.encounter.placeOfService}</td>
                    <td data-numeric>{l.units}</td>
                    <td data-type="money"><Money cents={l.chargeCents} /></td>
                    <td data-type="money"><Money cents={l.allowedCents || null} /></td>
                    <td data-type="money"><Money cents={l.paidCents || null} /></td>
                    <td data-type="money"><Money cents={l.adjustmentCents || null} /></td>
                    <td data-type="money"><Money cents={l.patientResponsibilityCents || null} /></td>
                    <td data-type="money"><Money cents={l.balanceCents} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-3">
              <span>Diagnoses: {a.encounter.diagnosisCodes.map((d, i) => <span key={d} className="ml-1"><span className="text-ink-4">{'ABCDEFGHIJKL'[i]}</span> <Code>{d}</Code></span>)}</span>
              <span>Rendering: {a.renderingProvider.lastName}, {a.renderingProvider.firstName} <Code>{a.renderingProvider.npi}</Code></span>
              <span>Billing: {a.practice.name} <Code>{a.practice.npi}</Code></span>
            </div>
          </Card>

          {remits.length ? (
            <Card title="Remittances">
              <table className="g-table">
                <thead><tr><th>Payer</th><th>Trace</th><th>Paid on</th><th>Result</th><th className="text-right">Charged</th><th className="text-right">Paid</th><th className="text-right">Patient</th><th>Crossover</th></tr></thead>
                <tbody>
                  {remits.map(({ rc, r }) => (
                    <tr key={rc.id}>
                      <td>{r.payerName}</td>
                      <td><Link href={`/remittances/${r.id}`} className="g-mono hover:underline">{r.traceNumber}</Link></td>
                      <td>{date(r.paymentDate)}</td>
                      <td>{rc.claimStatusCode === '4' ? <StatusPill status="denied" /> : rc.claimStatusCode === '22' ? <StatusPill status="appealed" /> : <StatusPill status="paid" />}{rc.outOfBalance ? <span className="ml-2 text-xs text-danger">out of balance</span> : null}</td>
                      <td data-type="money"><Money cents={rc.totalChargeCents} /></td>
                      <td data-type="money"><Money cents={rc.totalPaidCents} /></td>
                      <td data-type="money"><Money cents={rc.patientResponsibilityCents} /></td>
                      <td className="text-ink-3">{rc.crossoverCarrierName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}

          {denials.length ? (
            <Card title="Denials">
              <ul className="divide-y divide-line">
                {denials.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <div><Code>{d.groupCode}-{d.reasonCode}</Code> <span className="ml-2 capitalize text-ink-2">{d.category.replace('_', ' ')}</span>{d.remarkCodes?.length ? <span className="ml-2 text-xs text-ink-3">RARC {d.remarkCodes.join(', ')}</span> : null}</div>
                    <div className="flex items-center gap-3"><span className="text-xs text-ink-3">{d.suggestedAction?.replace('_', ' ')}</span><Money cents={d.deniedAmountCents} /><StatusPill status={d.status} /></div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Ledger">
            {ledger.length === 0 ? <div className="px-4 py-3 text-sm text-ink-3">No entries.</div> : (
              <table className="g-table">
                <thead><tr><th>Posted</th><th>Type</th><th>Responsibility</th><th>Source</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id}><td>{date(e.postingDate)}</td><td className="capitalize">{e.entryType.replace(/_/g, ' ')}</td><td className="text-ink-2">{e.responsibility}</td><td className="text-xs text-ink-3">{e.note ?? e.sourceType}</td><td data-type="money"><Money cents={e.amountCents} /></td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Summary">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
              <Field label="Charged"><Money cents={c.totalChargeCents} /></Field>
              <Field label="Paid"><Money cents={c.totalPaidCents} /></Field>
              <Field label="Adjusted"><Money cents={c.totalAdjustmentCents} /></Field>
              <Field label="Patient"><Money cents={c.patientResponsibilityCents} /></Field>
              <Field label="Balance"><Money cents={c.balanceCents} className="font-semibold" /></Field>
              <Field label="Filing deadline"><span className={c.timelyFilingDeadline && Date.parse(c.timelyFilingDeadline) - Date.now() < 14 * 86_400_000 && !['paid', 'closed'].includes(c.status) ? 'text-danger' : ''}>{date(c.timelyFilingDeadline)}</span></Field>
              <Field label="Payer control #"><Code>{c.payerClaimControlNumber ?? '—'}</Code></Field>
              <Field label="Member ID"><Code>{a.coverage.memberId}</Code></Field>
              <Field label="Coverage verified">{a.coverage.lastVerifiedAt ? <span>{date(a.coverage.lastVerifiedAt)} · <StatusPill status={a.coverage.lastVerifiedStatus ?? 'unknown'} /></span> : <span className="text-warn">never</span>}</Field>
              <Field label="Submitted">{c.submittedAt ? relative(c.submittedAt) : '—'}</Field>
            </div>
          </Card>

          <Card title="Submissions">
            {submissions.length === 0 ? <div className="px-4 py-3 text-sm text-ink-3">Not yet submitted.</div> : (
              <ul className="divide-y divide-line text-sm">
                {submissions.map((s) => (
                  <li key={s.id} className="px-4 py-2">
                    <div className="flex items-center justify-between"><span>Attempt {s.attemptNumber} · {s.connector}</span><StatusPill status={s.status === 'sent' ? 'submitted' : s.status} /></div>
                    <div className="mt-0.5 text-xs text-ink-3">ISA {s.isaControlNumber} · ST {s.stControlNumber} · {s.sentAt ? relative(s.sentAt) : 'queued'}{s.errorMessage ? <span className="ml-2 text-danger">{s.errorMessage}</span> : null}</div>
                  </li>
                ))}
              </ul>
            )}
            {acks.length ? (
              <ul className="divide-y divide-line border-t border-line text-xs">
                {acks.map((k) => (
                  <li key={k.id} className="flex items-start justify-between gap-2 px-4 py-1.5"><span><Code>{k.type.replace('x', '').toUpperCase()}</Code> {k.resultCode === 'A' ? <span className="text-ok">accepted</span> : k.resultCode === 'R' ? <span className="text-danger">rejected</span> : <span className="text-warn">accepted with errors</span>}{k.message ? <span className="ml-1 text-ink-2">— {k.message}</span> : null}</span><span className="shrink-0 text-ink-4">{relative(k.receivedAt)}</span></li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card title="Versions">
            <ul className="divide-y divide-line text-sm">
              {versions.length === 0 ? <li className="px-4 py-3 text-ink-3">No frozen versions yet.</li> : null}
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between px-4 py-2"><span>v{v.versionNumber} <span className="text-xs text-ink-4">{relative(v.createdAt)}</span></span><span className="flex items-center gap-2"><Code>{v.contentHash.slice(0, 10)}</Code>{v.hasX12 ? <Link href={`/claims/${c.id}/x12/${v.id}`} className="text-xs text-grove hover:underline">837</Link> : null}</span></li>
              ))}
            </ul>
          </Card>

          <Card title="History">
            <ul className="divide-y divide-line text-xs">
              {transitions.map((t) => (
                <li key={t.id} className="px-4 py-1.5"><span className="text-ink-4">{relative(t.occurredAt)}</span> <StatusPill status={t.toStatus} /> <span className="text-ink-3">via {t.trigger}</span>{t.reason ? <div className="text-ink-2">{t.reason}</div> : null}</li>
              ))}
            </ul>
          </Card>

          <Card title="Activity">
            <ul className="divide-y divide-line text-sm">
              {activity.map((e) => <li key={e.id} className="px-4 py-2"><span className="font-medium">{e.actorType === 'system' ? 'Grove' : e.actorLabel ?? 'Someone'}</span> <span className="text-ink-2">{e.summary}</span><div className="text-xs text-ink-4">{relative(e.occurredAt)}</div></li>)}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
