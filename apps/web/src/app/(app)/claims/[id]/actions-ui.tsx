'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { overrideFindingAction, scrubAction, submitAction, voidClaimAction } from '../actions';

export function ClaimActions({ claimId, status, errors, warnings }: { claimId: string; status: string; errors: number; warnings: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const canSubmit = ['ready', 'needs_review', 'rejected', 'draft', 'secondary_ready'].includes(status) && errors === 0;

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className={`text-xs ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</span> : null}
      <Button disabled={pending} onClick={() => start(async () => { await scrubAction(claimId); setMsg({ ok: true, text: 'Scrubbed' }); })}>Scrub</Button>
      <Button variant="primary" disabled={pending || !canSubmit} title={errors ? `${errors} error(s) block submission` : undefined} onClick={() => start(async () => { const r = await submitAction(claimId, warnings > 0); setMsg({ ok: r.ok, text: r.message }); })}>
        {pending ? 'Working…' : warnings > 0 ? `Submit (${warnings} warning${warnings === 1 ? '' : 's'})` : 'Submit'}
      </Button>
      <a
        href={`/claims/${claimId}/cms1500`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface-raised px-3 text-sm font-medium text-ink hover:bg-surface-sunken"
      >
        CMS-1500 PDF
      </a>
      {!['voided', 'closed', 'paid'].includes(status) ? (
        <Button variant="danger" disabled={pending} onClick={() => { const reason = window.prompt('Reason for voiding this claim?'); if (reason) start(() => voidClaimAction(claimId, reason)); }}>Void</Button>
      ) : null}
    </div>
  );
}

export function FindingActions({ findingId, claimId, severity }: { findingId: string; claimId: string; severity: string }) {
  const [pending, start] = useTransition();
  if (severity === 'error') return null; // errors are fixed, never waved through
  return (
    <Button variant="ghost" disabled={pending} onClick={() => { const reason = window.prompt('Why is this finding acceptable? (recorded in the audit log)'); if (reason) start(() => overrideFindingAction(findingId, claimId, reason)); }}>
      Override
    </Button>
  );
}
