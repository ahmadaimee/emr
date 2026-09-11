import Link from 'next/link';

interface CoverageRow {
  c: { id: string; rank: string; memberId: string; groupNumber: string | null; active: boolean };
  payerName: string;
}

/** Every coverage on file for this patient, primary through tertiary — not just the one this claim bills. */
export function ClaimInsurancesCard({ patientId, coverages }: { patientId: string; coverages: CoverageRow[] }) {
  if (coverages.length === 0) return null;

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase text-ink-4">Insurances on File</span>
        <Link href={`/patients/${patientId}`} className="text-[11px] text-ink-3 hover:underline">Manage on patient chart</Link>
      </div>
      <div className="space-y-1.5">
        {coverages.map(({ c, payerName }) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded border border-line bg-surface p-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded bg-grove-soft text-grove-strong font-mono font-bold px-1.5 py-0.2 text-[10px] shrink-0">
                {c.rank === 'primary' ? 'P' : c.rank === 'secondary' ? 'S' : 'T'}
              </span>
              <span className="font-semibold text-ink truncate">{payerName}</span>
              {!c.active && <span className="text-ink-4 text-[10px] shrink-0">(inactive)</span>}
            </div>
            <div className="text-ink-3 g-mono text-[11px] shrink-0">
              {c.memberId}{c.groupNumber ? ` · ${c.groupNumber}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
