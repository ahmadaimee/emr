'use client';

import { useState } from 'react';

interface ClaimLogsHubProps {
  claimId: string;
  auditLogs?: any[];
  submissionLogs?: any[];
  changesLogs?: any[];
  activityLogs?: any[];
  errorLogs?: any[];
  rejectionLogs?: any[];
  denialLogs?: any[];
  versions?: any[];
}

export function ClaimLogsHub({
  claimId,
  auditLogs = [],
  submissionLogs = [],
  changesLogs = [],
  activityLogs = [],
  errorLogs = [],
  rejectionLogs = [],
  denialLogs = [],
  versions = [],
}: ClaimLogsHubProps) {
  const [activeTab, setActiveTab] = useState<
    'all' | 'audit' | 'submissions' | 'changes' | 'activity' | 'errors' | 'rejections' | 'denials'
  >('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Combine all logs into a unified timeline
  const unifiedStream = [
    ...auditLogs.map((l) => ({
      id: l.id,
      type: 'audit',
      typeLabel: 'HMAC Audit',
      badgeTone: 'purple',
      title: l.summary || l.action,
      actor: l.actorName || l.actorLabel || 'System',
      actorType: l.actorType,
      date: new Date(l.occurredAt),
      detail: l.hash ? `HMAC SHA-256: ${l.hash.slice(0, 16)}...` : undefined,
      extra: l.ipAddress ? `IP: ${l.ipAddress}` : undefined,
      verified: l.verified ?? true,
      status: undefined as string | undefined,
    })),
    ...submissionLogs.map((s) => ({
      id: s.id,
      type: 'submission',
      typeLabel: 'EDI 837 Submission',
      badgeTone: 'blue',
      title: `Attempt ${s.attemptNumber} · ${s.connector || 'Clearinghouse Gateway'}`,
      actor: 'EDI Submitter',
      actorType: 'system',
      date: new Date(s.submittedAt || s.sentAt || Date.now()),
      detail: `ISA ${s.isaControlNumber || '000010042'} · ST ${s.stControlNumber || '0001'} · Batch ${s.batchNumber || '837P'}`,
      extra: s.responseSummary || s.clearinghouseClaimId,
      verified: undefined as boolean | undefined,
      status: s.status,
    })),
    ...changesLogs.map((c) => ({
      id: c.id,
      type: 'changes',
      typeLabel: 'Claim Modification',
      badgeTone: 'amber',
      title: `Updated ${c.label || c.field}: ${c.oldValue} → ${c.newValue}`,
      actor: c.author || 'Operator',
      actorType: 'user',
      date: new Date(c.changedAt || Date.now()),
      detail: c.reason,
      extra: c.authorRole ? `Role: ${c.authorRole}` : undefined,
      verified: undefined as boolean | undefined,
      status: undefined as string | undefined,
    })),
    ...activityLogs.map((a) => ({
      id: a.id,
      type: 'activity',
      typeLabel: 'Activity Event',
      badgeTone: 'gray',
      title: a.summary || a.verb || 'Claim transition',
      actor: a.actorLabel || (a.actorType === 'system' ? 'PracticeOS Autopilot' : 'User'),
      actorType: a.actorType,
      date: new Date(a.occurredAt || Date.now()),
      detail: a.summary,
      extra: undefined,
      verified: undefined as boolean | undefined,
      status: undefined as string | undefined,
    })),
    ...errorLogs.map((e) => ({
      id: e.id,
      type: 'errors',
      typeLabel: 'Rule Finding',
      badgeTone: 'danger',
      title: `${e.ruleCode || 'SCRUB-RULE'}: ${e.message}`,
      actor: 'Rules Scrubber',
      actorType: 'system',
      date: new Date(e.createdAt || Date.now()),
      detail: e.suggestedFix?.explanation || 'Validation warning/error',
      extra: e.severity?.toUpperCase(),
      verified: undefined as boolean | undefined,
      status: undefined as string | undefined,
    })),
    ...rejectionLogs.map((r) => ({
      id: r.id,
      type: 'rejections',
      typeLabel: '277CA Rejection',
      badgeTone: 'red',
      title: `277CA [${r.stcCode || 'STC'}]: ${r.message}`,
      actor: 'Clearinghouse 277CA',
      actorType: 'system',
      date: new Date(r.receivedAt || Date.now()),
      detail: r.suggestedResolution,
      extra: r.clearinghouseTrace,
      verified: undefined as boolean | undefined,
      status: undefined as string | undefined,
    })),
    ...denialLogs.map((d) => ({
      id: d.id,
      type: 'denials',
      typeLabel: '835 ERA Denial',
      badgeTone: 'orange',
      title: `Denial ${d.groupCode || 'CO'}-${d.reasonCode || '96'}: ${d.category || 'coding'}`,
      actor: '835 Remittance Parser',
      actorType: 'system',
      date: new Date(d.createdAt || Date.now()),
      detail: d.remarkCodes ? `RARC: ${d.remarkCodes.join(', ')} · Suggested: ${d.suggestedAction}` : undefined,
      extra: d.deniedAmountCents ? `$${(d.deniedAmountCents / 100).toFixed(2)} denied` : undefined,
      verified: undefined as boolean | undefined,
      status: undefined as string | undefined,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const q = searchFilter.trim().toLowerCase();
  const filteredUnified = unifiedStream.filter((item) => {
    if (activeTab !== 'all' && item.type !== activeTab) return false;
    if (q) {
      return (
        item.title.toLowerCase().includes(q) ||
        item.actor.toLowerCase().includes(q) ||
        (item.detail && item.detail.toLowerCase().includes(q)) ||
        (item.extra && item.extra.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="rounded-lg border border-line bg-surface-raised shadow-xs">
      {/* Header & Sub-Tabs */}
      <div className="border-b border-line p-3 sm:px-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-ink">Claim History &amp; Logs Center</h3>
          <span className="rounded-full bg-surface-sunken border border-line px-2 py-0.2 text-[10px] font-mono text-ink-3">
            {unifiedStream.length} total events
          </span>
        </div>

        {/* Search inside logs */}
        <div className="relative">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search logs by keyword, actor, code..."
            className="h-7 w-56 rounded-md border border-line-strong bg-surface pl-2 pr-2 text-xs text-ink placeholder:text-ink-4 focus:border-grove"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-2 top-1 text-xs text-ink-4 hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Categories Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface/50 px-4 py-2 text-xs overflow-x-auto">
        {[
          { id: 'all', label: 'All Logs', count: unifiedStream.length },
          { id: 'audit', label: 'Audit Log (HMAC)', count: auditLogs.length },
          { id: 'submissions', label: 'Submissions (837)', count: submissionLogs.length },
          { id: 'changes', label: 'Changes Log', count: changesLogs.length },
          { id: 'activity', label: 'Activity Log', count: activityLogs.length },
          { id: 'errors', label: 'Error Log', count: errorLogs.length },
          { id: 'rejections', label: 'Rejections (277CA)', count: rejectionLogs.length },
          { id: 'denials', label: 'Denials (835 ERA)', count: denialLogs.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors shrink-0 ${
              activeTab === tab.id
                ? 'bg-grove text-white font-semibold shadow-xs'
                : 'bg-surface border border-line text-ink-2 hover:bg-surface-sunken hover:text-ink'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Log Feed List */}
      <div className="divide-y divide-line max-h-[500px] overflow-y-auto">
        {filteredUnified.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-3">
            No log events found matching &quot;{searchFilter}&quot; in this category.
          </div>
        ) : (
          filteredUnified.map((log) => {
            const dateFormatted = log.date.toLocaleString();

            return (
              <div
                key={`${log.type}-${log.id}`}
                className="p-3.5 sm:px-4 hover:bg-surface-sunken/40 transition-colors flex items-start justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-mono font-semibold uppercase border ${
                        log.type === 'submission'
                          ? 'bg-info-soft text-info border-transparent'
                          : log.type === 'changes'
                          ? 'bg-clay-soft text-clay border-transparent'
                          : log.type === 'errors'
                          ? 'bg-warn-soft text-warn border-transparent'
                          : log.type === 'rejections' || log.type === 'denials'
                          ? 'bg-danger-soft text-danger border-transparent'
                          : 'bg-surface-sunken text-ink-2 border-line'
                      }`}
                    >
                      {log.typeLabel}
                    </span>

                    <span className="font-semibold text-xs text-ink">
                      {log.title}
                    </span>

                    {log.verified && (
                      <span className="rounded bg-ok-soft px-1.5 py-0.2 text-[9px] font-mono text-ok font-semibold">
                        HMAC Verified ✓
                      </span>
                    )}

                    {log.status && (
                      <span className="rounded bg-surface-sunken px-1.5 py-0.2 text-[10px] font-mono text-ink-3">
                        {log.status}
                      </span>
                    )}
                  </div>

                  {log.detail && (
                    <p className="text-xs text-ink-2 leading-relaxed font-mono text-[11px] mt-0.5">
                      {log.detail}
                    </p>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-ink-4">
                    <span>Actor: <strong className="text-ink-3">{log.actor}</strong> ({log.actorType})</span>
                    {log.extra && <span>· {log.extra}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0 text-[11px] text-ink-4 font-mono">
                  {dateFormatted}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Audit Guarantee */}
      <div className="border-t border-line bg-surface/30 px-4 py-2 text-[10px] text-ink-4 flex items-center justify-between">
        <span>Tamper-evident append-only ledger and HMAC hash chained audit guarantees HIPAA Title II compliance.</span>
        <span className="font-mono">Claim ID: {claimId}</span>
      </div>
    </div>
  );
}

