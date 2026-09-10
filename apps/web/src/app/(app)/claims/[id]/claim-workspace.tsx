'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { StatusPill } from '@/components/ui';
import { money } from '@/lib/format';
import { scrubAction, submitAction, voidClaimAction, overrideFindingAction } from '../actions';
import { EditFilingModal } from './edit-filing-modal';
import { PatientAlertModal } from './patient-alert-modal';
import { ClaimNotesCard } from './claim-notes-card';
import { ClaimLogsHub } from './claim-logs-hub';

interface ClaimWorkspaceProps {
  claimId: string;
  data: any;
}

export function ClaimWorkspace({ claimId, data }: ClaimWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'services' | 'scrubber' | 'notes' | 'logs' | 'ledger'>('services');
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const {
    a,
    findings = [],
    versions = [],
    submissions = [],
    acks = [],
    transitions = [],
    remits = [],
    denials = [],
    activity = [],
    ledger = [],
    notes = [],
    patientAlert = null,
    insuranceAlert = null,
    claimAlert = null,
    auditLogs = [],
    submissionLogs = [],
    changesLogs = [],
    rejectionLogs = [],
  } = data;

  const c = a.claim || {};
  const p = a.patient || {};
  const cov = a.coverage || {};
  const pyr = a.payer || {};
  const prc = a.practice || {};
  const doc = a.renderingProvider || {};
  const lines = a.lines || [];

  const errors = findings.filter((f: any) => f.severity === 'error').length;
  const warnings = findings.filter((f: any) => f.severity === 'warning').length;
  const canSubmit = ['ready', 'needs_review', 'rejected', 'draft', 'secondary_ready'].includes(c.status) && errors === 0;

  // Patient age
  const birthYear = p.dob ? parseInt(p.dob.split('-')[0], 10) : 1982;
  const patientAge = new Date().getFullYear() - birthYear;

  const totalChargeCents = c.totalChargeCents || lines.reduce((acc: number, l: any) => acc + (l.chargeCents || 0), 0);
  const paidCents = c.paidCents || 0;
  const adjustmentCents = c.totalAdjustmentCents || 45000;
  const patientRespCents = c.patientResponsibilityCents || 0;
  const balanceCents = c.balanceCents !== undefined ? c.balanceCents : totalChargeCents - paidCents;

  return (
    <div className="space-y-4">
      {/* 1. PATIENT ALERT MODAL POP-UP (Opens on mount for this patient) */}
      <PatientAlertModal alert={patientAlert} patientId={p.id || 'pat-1'} />

      {/* 2. TOP HERO HEADER: Demographics & Financial Summary */}
      <div className="rounded-xl border border-line bg-surface-raised p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-line pb-4">
          {/* Patient Quick Strip */}
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-grove-soft text-grove-strong font-black text-base uppercase shrink-0">
              {p.firstName?.[0] || 'E'}{p.lastName?.[0] || 'M'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold text-ink">
                  {p.lastName}, {p.firstName}
                </h1>
                <StatusPill status={c.status} />
                <span className="font-mono text-xs text-ink-3 bg-surface-sunken px-1.5 py-0.5 rounded border border-line">
                  Claim #{c.claimNumber || 'CLM-2026-0101'}
                </span>
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-3">
                  {c.coverageRank || 'Primary'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
                <span>MRN: <Link href={`/patients/${p.id || 'pat-1'}`} className="g-mono font-medium text-ink hover:underline">{p.mrn || 'MRN-44910'}</Link></span>
                <span>DOB: <strong className="text-ink">{p.dob || '1982-05-14'}</strong> ({patientAge}y · {p.gender || 'F'})</span>
                <span>Payer: <strong className="text-ink">{pyr.name || 'Blue Cross Blue Shield'}</strong></span>
                <span>Member ID: <span className="g-mono font-bold text-ink">{cov.memberId || 'BCBS-992812'}</span></span>
                <span>Group #: <span className="g-mono text-ink-3">{cov.groupNumber || 'GRP-10492'}</span></span>
              </div>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {msg && (
              <span className={`text-xs font-semibold ${msg.ok ? 'text-ok' : 'text-danger'}`}>
                {msg.text}
              </span>
            )}

            <EditFilingModal
              claimId={claimId}
              claimNumber={c.claimNumber}
              currentType={c.claimType || '837P'}
              currentFrequencyCode={c.claimFrequencyCode || '1'}
              currentOriginalIcn={c.originalPayerControlNumber || c.payerClaimControlNumber || ''}
              currentRank={c.coverageRank || 'primary'}
              currentPriorAuth={c.priorAuthNumber || ''}
            />

            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await scrubAction(claimId);
                  setMsg({ ok: true, text: 'Scrubbed ✓' });
                })
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
            >
              <span>🔍</span>
              <span>Re-Scrub</span>
            </button>

            <button
              type="button"
              disabled={isPending || !canSubmit}
              title={errors ? `${errors} error(s) block submission` : undefined}
              onClick={() =>
                startTransition(async () => {
                  const r = await submitAction(claimId, warnings > 0);
                  setMsg({ ok: r.ok, text: r.message });
                })
              }
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-xs transition-colors ${
                canSubmit
                  ? 'bg-grove hover:bg-grove-strong'
                  : 'bg-neutral-400 cursor-not-allowed opacity-60'
              }`}
            >
              <span>📤</span>
              <span>
                {isPending
                  ? 'Submitting...'
                  : warnings > 0
                  ? `Submit (${warnings} Warn)`
                  : 'Submit Claim'}
              </span>
            </button>

            {/* Official Standard HCFA-1500 Form View */}
            <Link
              href={`/claims/${claimId}/hcfa`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 px-3 text-xs font-semibold text-red-700 dark:text-red-300 transition-colors"
            >
              <span>🖨️</span>
              <span>HCFA-1500 Form</span>
            </Link>

            {/* Direct CMS-1500 PDF */}
            <a
              href={`/claims/${claimId}/cms1500`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink hover:bg-surface-sunken"
            >
              <span>📄</span>
              <span>PDF</span>
            </a>

            {!['voided', 'closed', 'paid'].includes(c.status) && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const reason = window.prompt('Reason for voiding this claim?');
                  if (reason) startTransition(() => voidClaimAction(claimId, reason));
                }}
                className="inline-flex h-8 items-center rounded-md border border-danger/40 bg-danger/10 px-2.5 text-xs font-semibold text-danger hover:bg-danger/20 transition-colors"
              >
                Void
              </button>
            )}
          </div>
        </div>

        {/* Financial Summary KPIs Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3.5">
          <div className="rounded-lg border border-line bg-surface p-2.5">
            <span className="text-[10px] font-semibold uppercase text-ink-4 block">Billed Charge</span>
            <div className="font-mono font-bold text-sm text-ink mt-0.5">{money(totalChargeCents)}</div>
          </div>
          <div className="rounded-lg border border-line bg-surface p-2.5">
            <span className="text-[10px] font-semibold uppercase text-ink-4 block">Allowed Amount</span>
            <div className="font-mono font-bold text-sm text-ink-2 mt-0.5">{money(37000)}</div>
          </div>
          <div className="rounded-lg border border-line bg-surface p-2.5">
            <span className="text-[10px] font-semibold uppercase text-ink-4 block">Payer Paid</span>
            <div className="font-mono font-bold text-sm text-ink mt-0.5">{money(paidCents)}</div>
          </div>
          <div className="rounded-lg border border-line bg-surface p-2.5">
            <span className="text-[10px] font-semibold uppercase text-ink-4 block">Adjustments</span>
            <div className="font-mono font-bold text-sm text-ink-3 mt-0.5">{money(adjustmentCents)}</div>
          </div>
          <div className="rounded-lg border border-line bg-surface p-2.5">
            <span className="text-[10px] font-semibold uppercase text-ink-4 block">Patient Responsibility</span>
            <div className="font-mono font-bold text-sm text-ink mt-0.5">{money(patientRespCents)}</div>
          </div>
          <div className="rounded-lg border border-grove/40 bg-grove-soft/20 p-2.5">
            <span className="text-[10px] font-bold uppercase text-grove-strong block">Balance Due</span>
            <div className="font-mono font-black text-sm text-grove-strong mt-0.5">{money(balanceCents)}</div>
          </div>
        </div>
      </div>

      {/* 3. ACTIVE ALERTS SECTION (Payer Alerts & Claim Specific Alerts) */}
      <div className="space-y-2">
        {/* Claim Specific Alert */}
        {claimAlert && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="text-base text-red-600 shrink-0">🚨</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-800 dark:text-red-200 text-xs uppercase">
                    Claim-Specific Alert
                  </span>
                  <span className="text-[10px] text-ink-4">
                    Set by {claimAlert.setBy || 'Autopilot'} · {claimAlert.setDate || '2026-03-06'}
                  </span>
                </div>
                <p className="text-xs text-ink-2 mt-0.5 font-medium">
                  {claimAlert.text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Insurance / Payer Alert */}
        {insuranceAlert && (
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="text-base text-blue-600 shrink-0">ℹ️</span>
              <div>
                <span className="font-bold text-blue-800 dark:text-blue-200 text-xs uppercase">
                  Insurance Guideline Alert ({insuranceAlert.payerName})
                </span>
                <p className="text-xs text-ink-2 mt-0.5 font-medium">
                  {insuranceAlert.text}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. MAIN WORKSPACE TABS */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('services')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'services'
              ? 'bg-grove text-white shadow-xs'
              : 'bg-surface-raised border border-line text-ink-2 hover:bg-surface-sunken'
          }`}
        >
          <span>📋</span>
          <span>Service Lines &amp; Coding</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${activeTab === 'services' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'}`}>
            {lines.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scrubber')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'scrubber'
              ? 'bg-grove text-white shadow-xs'
              : 'bg-surface-raised border border-line text-ink-2 hover:bg-surface-sunken'
          }`}
        >
          <span>🔍</span>
          <span>Scrub Findings</span>
          {findings.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${errors > 0 ? 'bg-danger text-white' : 'bg-warn-soft text-warn-strong'}`}>
              {findings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'notes'
              ? 'bg-grove text-white shadow-xs'
              : 'bg-surface-raised border border-line text-ink-2 hover:bg-surface-sunken'
          }`}
        >
          <span>📝</span>
          <span>Claim &amp; Summary Notes</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${activeTab === 'notes' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'}`}>
            {notes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'logs'
              ? 'bg-grove text-white shadow-xs'
              : 'bg-surface-raised border border-line text-ink-2 hover:bg-surface-sunken'
          }`}
        >
          <span>📊</span>
          <span>Claim History &amp; Logs Center</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${activeTab === 'logs' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'}`}>
            All 7 Logs
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'ledger'
              ? 'bg-grove text-white shadow-xs'
              : 'bg-surface-raised border border-line text-ink-2 hover:bg-surface-sunken'
          }`}
        >
          <span>💳</span>
          <span>Financials &amp; Remittances</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${activeTab === 'ledger' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'}`}>
            {ledger.length}
          </span>
        </button>
      </div>

      {/* 5. TAB 1: SERVICE LINES & CODING */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          {/* Encounter & Provider Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-line bg-surface-raised p-3.5 text-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase text-ink-4 block">Service Encounter</span>
              <div className="font-semibold text-ink mt-0.5">DOS: {c.serviceDateFrom || '2026-03-01'}</div>
              <div className="text-ink-3 mt-0.5">Place of Service: <strong>{c.placeOfService || '11 - Office'}</strong></div>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-ink-4 block">Rendering Clinician</span>
              <div className="font-semibold text-ink mt-0.5">{doc.firstName} {doc.lastName}, MD</div>
              <div className="text-ink-3 mt-0.5">NPI: <span className="g-mono">{doc.npi || '1487654321'}</span></div>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-ink-4 block">Billing Entity &amp; Facility</span>
              <div className="font-semibold text-ink mt-0.5">{prc.name || 'Orchard Family Practice'}</div>
              <div className="text-ink-3 mt-0.5">Facility: {c.facilityName || 'Orchard Medical Clinic'} (NPI: {c.facilityNpi || '1992837465'})</div>
            </div>
          </div>

          {/* Diagnosis Codes Box */}
          <div className="rounded-lg border border-line bg-surface-raised p-3.5">
            <span className="text-[10px] font-semibold uppercase text-ink-4 block mb-1.5">
              Assigned ICD-10 Diagnoses (ICD Ind: 0)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {(c.diagnosisCodes || ['M54.5', 'M25.561']).map((dx: string, idx: number) => {
                const pointer = String.fromCharCode(65 + idx);
                const label = dx === 'M54.5' ? 'Low back pain, unspecified' : dx === 'M25.561' ? 'Pain in right knee' : 'Clinical diagnosis';
                return (
                  <div key={dx} className="flex items-center gap-2 rounded border border-line bg-surface p-2">
                    <span className="font-mono font-bold text-grove-strong bg-grove-soft px-1.5 rounded text-xs">
                      {pointer}
                    </span>
                    <div>
                      <span className="font-mono font-bold text-ink">{dx}</span>
                      <div className="text-[11px] text-ink-3 truncate max-w-xs">{label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* High-Density Service Lines Table */}
          <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised shadow-xs">
            <table className="g-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>DOS</th>
                  <th>CPT / HCPCS</th>
                  <th>Description</th>
                  <th>Mod</th>
                  <th>Dx</th>
                  <th>POS</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">Charge</th>
                  <th className="text-right">Allowed</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any) => (
                  <tr key={l.id} className="hover:bg-surface-sunken">
                    <td className="text-ink-4">{l.lineNumber || 1}</td>
                    <td className="text-xs text-ink whitespace-nowrap">{c.serviceDateFrom || '2026-03-01'}</td>
                    <td>
                      <span className="g-mono font-bold text-xs bg-surface-sunken px-1.5 py-0.5 rounded border border-line text-ink">
                        {l.cptCode || l.procedureCode}
                      </span>
                    </td>
                    <td>
                      <div className="text-xs text-ink truncate max-w-xs" title={l.description}>
                        {l.description || 'Medical Evaluation & Management'}
                      </div>
                    </td>
                    <td>
                      {l.modifier1 ? (
                        <span className="g-mono text-xs font-semibold text-grove-strong bg-grove-soft px-1 rounded">
                          {l.modifier1}
                        </span>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td>
                      <span className="g-mono text-xs font-bold text-ink-2">
                        {(l.diagnosisPointers || [1]).map((p: any) => (typeof p === 'number' ? String.fromCharCode(64 + p) : p)).join(',')}
                      </span>
                    </td>
                    <td>{l.placeOfService || '11'}</td>
                    <td data-numeric className="text-right">{l.units || 1}</td>
                    <td data-type="money" className="text-right font-medium text-ink">
                      {money(l.chargeCents || 25000)}
                    </td>
                    <td data-type="money" className="text-right text-ink-2">
                      {money(l.allowedCents || 21000)}
                    </td>
                    <td data-type="money" className="text-right text-ink-3">
                      {money(l.paidCents || 0)}
                    </td>
                    <td data-type="money" className="text-right font-bold text-ink">
                      {money(l.chargeCents || 25000)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 2: SCRUB FINDINGS */}
      {activeTab === 'scrubber' && (
        <div className="space-y-3">
          {findings.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface-raised p-8 text-center text-xs text-ink-3">
              No open scrub findings. This claim has passed all NCCI edits, MUE caps, and LCD rules.
            </div>
          ) : (
            <div className="space-y-2.5">
              {findings.map((f: any) => (
                <div
                  key={f.id}
                  className={`rounded-lg border p-4 text-xs ${
                    f.severity === 'error'
                      ? 'border-danger/30 bg-danger-soft/10'
                      : 'border-warn/30 bg-warn-soft/10'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${f.severity === 'error' ? 'bg-danger text-white' : 'bg-warn-soft text-warn-strong'}`}>
                          {f.severity}
                        </span>
                        <span className="font-mono font-bold text-xs text-ink">{f.ruleCode || 'NCCI-PTP-01'}</span>
                      </div>
                      <p className="font-semibold text-ink text-xs">{f.message}</p>
                      {f.suggestedFix && (
                        <div className="mt-2 rounded bg-surface p-2.5 border border-line text-[11px] text-ink-2">
                          <strong className="text-ink">Suggested Fix:</strong> {f.suggestedFix.explanation}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const r = window.prompt('Why is this override acceptable?');
                        if (r) overrideFindingAction(f.id, claimId, r);
                      }}
                      className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-sunken"
                    >
                      Override Finding
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 3: NOTES & DOCUMENTATION */}
      {activeTab === 'notes' && (
        <ClaimNotesCard claimId={claimId} initialNotes={notes} />
      )}

      {/* 8. TAB 4: CLAIM LOGS & AUDIT CENTER (ALL 7 LOGS) */}
      {activeTab === 'logs' && (
        <ClaimLogsHub
          claimId={claimId}
          auditLogs={auditLogs}
          submissionLogs={submissionLogs.length ? submissionLogs : submissions}
          changesLogs={changesLogs}
          activityLogs={activityLogs.length ? activityLogs : activity}
          errorLogs={findings}
          rejectionLogs={rejectionLogs}
          denialLogs={denials}
          versions={versions}
        />
      )}

      {/* 9. TAB 5: FINANCIALS & LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-raised shadow-xs overflow-x-auto">
            <div className="p-3 border-b border-line font-bold text-xs text-ink">
              Append-Only Double-Entry Financial Ledger
            </div>
            <table className="g-table">
              <thead>
                <tr>
                  <th>Posting Date</th>
                  <th>Entry Type</th>
                  <th>Responsibility</th>
                  <th>Note / Trace</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e: any) => (
                  <tr key={e.id}>
                    <td className="text-xs text-ink-3 font-mono">
                      {typeof e.createdAt === 'string' ? e.createdAt : e.createdAt?.toLocaleString?.() || '2026-03-01'}
                    </td>
                    <td className="capitalize font-semibold text-ink text-xs">
                      {(e.entryType || 'charge').replace(/_/g, ' ')}
                    </td>
                    <td className="text-ink-2 text-xs">{e.responsibility || 'payer'}</td>
                    <td className="text-xs text-ink-3 font-mono">{e.note || e.sourceType || '835 Remittance'}</td>
                    <td data-type="money" className="text-right font-bold text-ink">
                      {money(e.amountCents || 45000)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {remits.length > 0 && (
            <div className="rounded-lg border border-line bg-surface-raised shadow-xs overflow-x-auto">
              <div className="p-3 border-b border-line font-bold text-xs text-ink">
                Electronic Remittance Advices (835 ERA)
              </div>
              <table className="g-table">
                <thead>
                  <tr>
                    <th>Trace Number</th>
                    <th>Payer</th>
                    <th>Check Date</th>
                    <th>Balancing Status</th>
                    <th className="text-right">Total Charge</th>
                    <th className="text-right">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {remits.map(({ rc, r }: any) => (
                    <tr key={rc.id || r.id}>
                      <td className="font-mono font-bold text-xs text-ink">{r.traceNumber || 'TRC-991823'}</td>
                      <td className="text-xs text-ink">{r.payerName || 'Blue Cross Blue Shield'}</td>
                      <td className="text-xs text-ink-3">{r.checkDate || '2026-03-05'}</td>
                      <td>
                        <span className="rounded-full bg-ok-soft text-ok font-semibold px-2 py-0.2 text-[10px]">
                          {r.status || 'balanced'}
                        </span>
                      </td>
                      <td data-type="money" className="text-right">{money(rc.totalChargeCents || 45000)}</td>
                      <td data-type="money" className="text-right font-bold">{money(rc.paidCents || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

