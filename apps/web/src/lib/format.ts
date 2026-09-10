export function money(cents: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (cents === null || cents === undefined) return '—';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const rem = String(abs % 100).padStart(2, '0');
  const sign = cents < 0 ? '−' : opts.sign && cents > 0 ? '+' : '';
  return `${sign}$${dollars}.${rem}`;
}

export function bps(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${(v / 100).toFixed(1)}%`;
}

export function date(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso) : iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function relative(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return date(d);
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', scrubbing: 'Scrubbing', needs_review: 'Needs review', ready: 'Ready', queued: 'Queued', submitted: 'Submitted',
  acknowledged: 'Accepted', rejected: 'Rejected', in_process: 'In process', paid: 'Paid', partially_paid: 'Partially paid', denied: 'Denied',
  appealed: 'Appealed', secondary_ready: 'Secondary ready', secondary_submitted: 'Secondary sent', patient_responsibility: 'Patient balance', closed: 'Closed', voided: 'Voided',
  active: 'Active', inactive: 'Inactive', not_found: 'Not found', payer_error: 'Payer error', invalid_request: 'Invalid request', transport_error: 'Transport error', sent: 'Sent',
  open: 'Open', in_progress: 'In progress', waiting: 'Waiting', snoozed: 'Snoozed', resolved: 'Resolved', cancelled: 'Cancelled',
  received: 'Received', parsed: 'Parsed', posted: 'Posted', partially_posted: 'Partially posted', out_of_balance: 'Out of balance', failed: 'Failed', posting: 'Posting', balanced: 'Balanced',
  running: 'Running', completed: 'Completed', completed_with_errors: 'Completed with errors',
};

/** Colour marks exceptions. Normal states are neutral. */
export function statusTone(status: string): 'neutral' | 'ok' | 'warn' | 'danger' | 'info' {
  if (['rejected', 'denied', 'not_found', 'inactive', 'out_of_balance', 'failed', 'transport_error', 'payer_error', 'invalid_request'].includes(status)) return 'danger';
  if (['needs_review', 'secondary_ready', 'partially_paid', 'partially_posted', 'completed_with_errors', 'appealed', 'waiting'].includes(status)) return 'warn';
  if (['paid', 'active', 'posted', 'balanced', 'resolved', 'completed'].includes(status)) return 'ok';
  if (['in_process', 'submitted', 'acknowledged', 'running', 'sent'].includes(status)) return 'info';
  return 'neutral';
}
