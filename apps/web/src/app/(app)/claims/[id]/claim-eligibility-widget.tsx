'use client';

import { useState, useTransition } from 'react';
import { Card, StatusPill } from '@/components/ui';
import { money, relative } from '@/lib/format';
import { checkClaimEligibilityAction } from './follow-up-actions';

interface EligibilityCheck {
  status: string;
  respondedAt: string | Date | null;
  requestedAt: string | Date | null;
  parsed: { summary?: { copayCents?: number; deductibleRemainingCents?: number; authorizationRequired?: boolean } } | null;
}

export function ClaimEligibilityWidget({ claimId, payerName, memberId, check }: { claimId: string; payerName: string; memberId: string; check: EligibilityCheck | null }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ status: string } | null>(null);

  const summary = check?.parsed?.summary;

  return (
    <Card title="Insurance Eligibility">
      <div className="p-3.5 space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-ink">{payerName}</div>
            <div className="text-ink-3 g-mono">{memberId}</div>
          </div>
          {(result?.status ?? check?.status) ? (
            <StatusPill status={result?.status ?? check!.status} />
          ) : (
            <span className="inline-flex items-center rounded-sm border border-transparent bg-danger-soft px-1.5 py-0.5 text-xs font-medium leading-none text-danger">
              Not Checked
            </span>
          )}
        </div>

        {summary && (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line">
            {summary.copayCents !== undefined && (
              <div>
                <span className="text-[10px] uppercase text-ink-4 block">Copay</span>
                <span className="font-mono font-semibold text-ink">{money(summary.copayCents)}</span>
              </div>
            )}
            {summary.deductibleRemainingCents !== undefined && (
              <div>
                <span className="text-[10px] uppercase text-ink-4 block">Deductible Remaining</span>
                <span className="font-mono font-semibold text-ink">{money(summary.deductibleRemainingCents)}</span>
              </div>
            )}
          </div>
        )}

        {check?.respondedAt && (
          <div className="text-ink-4 text-[11px]">Last checked {relative(check.respondedAt)}</div>
        )}

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const r = await checkClaimEligibilityAction(claimId);
              if (r && 'status' in r) setResult({ status: r.status });
            })
          }
          className="w-full h-8 rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors disabled:opacity-50"
        >
          {isPending ? 'Checking…' : 'Check Eligibility'}
        </button>
      </div>
    </Card>
  );
}
