'use client';

import { useState, useTransition } from 'react';
import { money } from '@/lib/format';
import { removeClaimServiceLineAction } from './edit-actions';
import { ServiceLineModal } from './claim-service-line-modal';

interface ServiceLine {
  id: string;
  lineNumber: number;
  cptCode?: string;
  procedureCode?: string;
  description?: string;
  modifier1: string | null;
  modifier2: string | null;
  modifier3: string | null;
  modifier4: string | null;
  diagnosisPointers: number[];
  placeOfService: string | null;
  units: number;
  chargeCents: number;
  allowedCents: number;
  paidCents: number;
}

export function ClaimServiceLinesTable({ claimId, lines, diagnosisCodes, serviceDate, editable }: { claimId: string; lines: ServiceLine[]; diagnosisCodes: string[]; serviceDate: string; editable: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRemove = (lineId: string) => {
    if (!window.confirm('Remove this service line from the claim?')) return;
    setError(null);
    startTransition(async () => {
      const r = await removeClaimServiceLineAction(claimId, lineId);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-danger text-[11px]">{error}</p>}
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
              {editable && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="hover:bg-surface-sunken">
                <td className="text-ink-4">{l.lineNumber || 1}</td>
                <td className="text-xs text-ink whitespace-nowrap">{serviceDate}</td>
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
                      {[l.modifier1, l.modifier2, l.modifier3, l.modifier4].filter(Boolean).join(' ')}
                    </span>
                  ) : (
                    <span className="text-ink-4">—</span>
                  )}
                </td>
                <td>
                  <span className="g-mono text-xs font-bold text-ink-2">
                    {(l.diagnosisPointers || [1]).map((p) => String.fromCharCode(64 + p)).join(',')}
                  </span>
                </td>
                <td>{l.placeOfService || '11'}</td>
                <td data-numeric className="text-right">{l.units || 1}</td>
                <td data-type="money" className="text-right font-medium text-ink">{money(l.chargeCents || 0)}</td>
                <td data-type="money" className="text-right text-ink-2">{money(l.allowedCents || 0)}</td>
                <td data-type="money" className="text-right text-ink-3">{money(l.paidCents || 0)}</td>
                <td data-type="money" className="text-right font-bold text-ink">{money((l.chargeCents || 0) - (l.paidCents || 0))}</td>
                {editable && (
                  <td className="text-right whitespace-nowrap">
                    <ServiceLineModal
                      claimId={claimId}
                      diagnosisCodes={diagnosisCodes}
                      line={{ ...l, procedureCode: l.procedureCode || l.cptCode || '' }}
                      trigger={(open) => (
                        <button type="button" onClick={open} className="text-xs text-ink-3 hover:text-ink hover:underline mr-2">
                          Edit
                        </button>
                      )}
                    />
                    <button type="button" disabled={isPending} onClick={() => handleRemove(l.id)} className="text-xs text-danger hover:underline">
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editable && (
        <ServiceLineModal
          claimId={claimId}
          diagnosisCodes={diagnosisCodes}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="h-8 rounded-md border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
            >
              + Add Service Line
            </button>
          )}
        />
      )}
    </div>
  );
}
