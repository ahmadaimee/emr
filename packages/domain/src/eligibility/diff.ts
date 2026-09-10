import type { BenefitSummary } from '@grove/x12';

export type Materiality = 'critical' | 'notable' | 'minor';

export interface BenefitChange {
  field: keyof BenefitSummary;
  from: unknown;
  to: unknown;
  materiality: Materiality;
  label: string;
}

/**
 * What changed between two eligibility results — the answer the front desk actually
 * needs, instead of a fresh 271 to re-read. Ordered most material first.
 */
export function diffBenefits(prev: BenefitSummary | null, next: BenefitSummary): BenefitChange[] {
  if (!prev) return [];
  const changes: BenefitChange[] = [];
  const cmp = (field: keyof BenefitSummary, materiality: Materiality, label: (a: unknown, b: unknown) => string) => {
    const a = prev[field];
    const b = next[field];
    if (a === undefined && b === undefined) return;
    if (a !== b) changes.push({ field, from: a, to: b, materiality, label: label(a, b) });
  };

  cmp('active', 'critical', (a, b) => (b ? 'Coverage is now active' : 'Coverage is no longer active'));
  cmp('planEnd', 'critical', (_a, b) => (b ? `Plan now ends ${String(b)}` : 'Plan end date removed'));
  cmp('planDescription', 'notable', (a, b) => `Plan changed from ${String(a ?? '—')} to ${String(b ?? '—')}`);
  cmp('insuranceType', 'notable', (a, b) => `Plan type changed from ${String(a ?? '—')} to ${String(b ?? '—')}`);
  cmp('authorizationRequired', 'notable', (_a, b) => (b ? 'Authorization is now required' : 'Authorization no longer required'));
  cmp('copayCents', 'notable', (a, b) => `Copay changed from ${money(a)} to ${money(b)}`);
  cmp('coinsuranceBps', 'notable', (a, b) => `Coinsurance changed from ${pct(a)} to ${pct(b)}`);
  cmp('deductibleTotalCents', 'notable', (a, b) => `Deductible changed from ${money(a)} to ${money(b)}`);
  cmp('outOfPocketMaxCents', 'minor', (a, b) => `Out-of-pocket max changed from ${money(a)} to ${money(b)}`);

  // Remaining balances move as claims pay; only a RESET (remaining jumps up to the
  // total) is worth a human's attention, because it means a new plan year.
  const dedPrev = prev.deductibleRemainingCents;
  const dedNext = next.deductibleRemainingCents;
  if (dedPrev !== undefined && dedNext !== undefined && dedNext > dedPrev && next.deductibleTotalCents !== undefined && dedNext >= next.deductibleTotalCents - 100) {
    changes.push({ field: 'deductibleRemainingCents', from: dedPrev, to: dedNext, materiality: 'notable', label: `Deductible reset: ${money(dedNext)} remaining` });
  }

  const rank = { critical: 0, notable: 1, minor: 2 };
  return changes.sort((a, b) => rank[a.materiality] - rank[b.materiality]);
}

function money(v: unknown): string {
  return typeof v === 'number' ? `$${(v / 100).toFixed(2)}` : '—';
}
function pct(v: unknown): string {
  return typeof v === 'number' ? `${(v / 100).toFixed(0)}%` : '—';
}
