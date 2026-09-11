import Link from 'next/link';
import { Empty, Kpi, Money, PageHeader, StatusPill, selectCls } from '@/components/ui';
import { pageContext } from '@/lib/session';
import { NewFeeScheduleModal } from './new-fee-schedule-modal';
import { FeeScheduleSelector } from './fee-schedule-selector';
import { NewCptModal } from './new-cpt-modal';
import { NewDxModal } from './new-dx-modal';

export const metadata = { title: 'Fee Schedules, CPT & Dx Management' };

export default async function FeeSchedulesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string;
    scheduleId?: string;
    q?: string;
    category?: string;
    favorites?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const currentTab = sp.tab ?? 'fee_schedules';
  const { run } = await pageContext();

  const data = await run('/settings/fee-schedules', async () => {
    return {
      feeSchedules: [] as any[],
      feeScheduleLines: [] as any[],
      cptCodes: [] as any[],
      dxCodes: [] as any[],
    };
  });

  const {
    feeSchedules = [],
    feeScheduleLines = [],
    cptCodes = [],
    dxCodes = [],
  } = data;

  const activeScheduleId = sp.scheduleId ?? feeSchedules[0]?.id ?? 'fs-1';
  const activeSchedule = feeSchedules.find((s: any) => s.id === activeScheduleId) ?? feeSchedules[0];
  const activeScheduleLines = feeScheduleLines.filter(
    (l: any) => l.feeScheduleId === activeSchedule?.id || activeSchedule?.id === 'fs-1' || !l.feeScheduleId
  );

  // Filter CPT codes
  const filteredCptCodes = cptCodes.filter((c: any) => {
    if (sp.q) {
      const q = sp.q.toLowerCase();
      if (!c.code.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (sp.category && c.category !== sp.category) {
      return false;
    }
    return true;
  });

  // Filter Dx codes
  const filteredDxCodes = dxCodes.filter((d: any) => {
    if (sp.q) {
      const q = sp.q.toLowerCase();
      if (!d.code.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q) && !d.category.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (sp.category && d.category !== sp.category) {
      return false;
    }
    if (sp.favorites === '1' && !d.favorite) {
      return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Fee Schedules, CPT & Diagnosis (Dx) Management"
        subtitle="eCW-style clinical chargemaster, payer contract allowable schedules, CPT/HCPCS procedure codes, and ICD-10 diagnostic library."
        actions={
          <div className="flex items-center gap-2">
            {currentTab === 'fee_schedules' && <NewFeeScheduleModal />}
            {currentTab === 'cpt' && <NewCptModal />}
            {currentTab === 'dx' && <NewDxModal />}
          </div>
        }
      />

      {/* KPI Cards - Uniform Small */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <Kpi
          variant="primary"
          label="Payer Fee Schedules"
          value={feeSchedules.length}
          hint="Contracted rate sheets"
          badge="Pricing"
        />
        <Kpi
          variant="secondary"
          label="CPT / HCPCS Codes"
          value={cptCodes.length}
          hint="Active procedure catalog"
          tone="ok"
        />
        <Kpi
          variant="secondary"
          label="ICD-10 Diagnoses"
          value={dxCodes.length}
          hint={`${dxCodes.filter((d: any) => d.favorite).length} in Quick Favorites`}
        />
        <Kpi
          variant="secondary"
          label="Conversion Factor"
          value="$32.74 / RVU"
          hint="2026 CMS standard MPFS"
        />
      </div>

      {/* Main View Switcher Tabs (eCW Style) */}
      <div className="mt-5 mb-4 flex flex-wrap items-center gap-2 border-b border-line pb-2">
        <Link
          href="/settings/fee-schedules?tab=fee_schedules"
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            currentTab === 'fee_schedules'
              ? 'bg-grove text-white shadow-xs'
              : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken border border-line'
          }`}
        >
          <span>Payer Fee Schedules</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
              currentTab === 'fee_schedules' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'
            }`}
          >
            {feeSchedules.length}
          </span>
        </Link>

        <Link
          href="/settings/fee-schedules?tab=cpt"
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            currentTab === 'cpt'
              ? 'bg-grove text-white shadow-xs'
              : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken border border-line'
          }`}
        >
          <span>CPT / HCPCS Procedures</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
              currentTab === 'cpt' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'
            }`}
          >
            {cptCodes.length}
          </span>
        </Link>

        <Link
          href="/settings/fee-schedules?tab=dx"
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            currentTab === 'dx'
              ? 'bg-grove text-white shadow-xs'
              : 'bg-surface-raised text-ink-2 hover:bg-surface-sunken border border-line'
          }`}
        >
          <span>ICD-10 Diagnoses (Dx)</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
              currentTab === 'dx' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-ink-3'
            }`}
          >
            {dxCodes.length}
          </span>
        </Link>
      </div>

      {/* TAB 1: FEE SCHEDULES */}
      {currentTab === 'fee_schedules' && (
        <div className="space-y-4">
          {/* Fee Schedule Selector with Right-Click Context Menu & DOS Tenure Window */}
          <FeeScheduleSelector
            feeSchedules={feeSchedules}
            activeScheduleId={activeScheduleId}
            linesCount={activeScheduleLines.length}
          />

          {/* Priced Lines Table */}
          <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised shadow-xs">
            <table className="g-table">
              <thead>
                <tr>
                  <th>CPT Code</th>
                  <th>Mod</th>
                  <th>Description</th>
                  <th data-type="money">Non-Facility Allowed</th>
                  <th data-type="money">Facility Allowed</th>
                  <th data-type="money">Standard Billed</th>
                  <th data-align="right">Work RVU</th>
                  <th data-align="right">Total RVU</th>
                  <th>Effective Date</th>
                </tr>
              </thead>
              <tbody>
                {activeScheduleLines.map((line: any) => (
                  <tr key={line.id} tabIndex={0} className="hover:bg-surface-sunken">
                    <td>
                      <span className="g-mono font-bold text-xs bg-surface-sunken px-1.5 py-0.5 rounded border border-line text-ink">
                        {line.procedureCode}
                      </span>
                    </td>
                    <td>
                      {line.modifier1 ? (
                        <span className="g-mono text-xs font-semibold text-grove-strong bg-grove-soft px-1 rounded">
                          {line.modifier1}
                        </span>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td>
                      <div className="text-xs text-ink truncate max-w-sm" title={line.description}>
                        {line.description}
                      </div>
                    </td>
                    <td data-type="money" className="text-right font-medium text-ink">
                      <Money cents={line.nonFacilityRateCents} />
                    </td>
                    <td data-type="money" className="text-right font-medium text-ink">
                      <Money cents={line.facilityRateCents} />
                    </td>
                    <td data-type="money" className="text-right text-ink-3">
                      <Money cents={line.standardBilledCents} />
                    </td>
                    <td className="text-right g-num text-ink-2">
                      {Number(line.workRvu).toFixed(2)}
                    </td>
                    <td className="text-right g-num font-semibold text-ink">
                      {Number(line.totalRvu).toFixed(2)}
                    </td>
                    <td className="text-ink-3 text-xs">
                      {line.effectiveDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CPT PROCEDURES */}
      {currentTab === 'cpt' && (
        <div className="space-y-3">
          {/* Search & Category Filter Bar */}
          <form className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="tab" value="cpt" />
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Search CPT code or procedure description..."
              className="h-8 w-72 rounded-md border border-line-strong bg-surface-raised px-2.5 text-sm"
            />
            <select
              name="category"
              defaultValue={sp.category ?? ''}
              className={`${selectCls} w-56`}
            >
              <option value="">All categories</option>
              <option value="Evaluation & Management">Evaluation & Management (E&M)</option>
              <option value="Preventive Medicine">Preventive Medicine</option>
              <option value="Medicine & Injections">Medicine & Injections</option>
              <option value="Laboratory & Pathology">Laboratory & Pathology</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Telehealth">Telehealth</option>
            </select>
            <button className="h-8 rounded-md border border-line-strong bg-surface-raised px-3 text-sm font-medium hover:bg-surface-sunken transition-colors">
              Filter
            </button>
          </form>

          {filteredCptCodes.length === 0 ? (
            <Empty title="No procedure codes match" body="Try adjusting your search query or specialty category filter." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised shadow-xs">
              <table className="g-table">
                <thead>
                  <tr>
                    <th>CPT / HCPCS</th>
                    <th>System</th>
                    <th>Clinical Description</th>
                    <th>Category</th>
                    <th>Global Days</th>
                    <th data-align="right">Work RVU</th>
                    <th data-align="right">Total RVU</th>
                    <th data-type="money">Default Charge</th>
                    <th>Allowed POS</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCptCodes.map((cpt: any) => (
                    <tr key={cpt.code} tabIndex={0} className="hover:bg-surface-sunken">
                      <td>
                        <span className="g-mono font-bold text-xs bg-surface-sunken px-2 py-0.5 rounded border border-line text-ink">
                          {cpt.code}
                        </span>
                        {cpt.isAddOn && (
                          <span className="ml-1 text-[9px] font-bold text-clay bg-clay-soft px-1 rounded">
                            +ADDON
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-[11px] font-medium text-ink-3">
                          {cpt.codeSystem}
                        </span>
                      </td>
                      <td>
                        <div className="text-xs text-ink truncate max-w-md font-medium" title={cpt.description}>
                          {cpt.description}
                        </div>
                      </td>
                      <td>
                        <span className="rounded bg-surface-sunken px-1.5 py-0.2 text-[10px] text-ink-2 border border-line">
                          {cpt.category}
                        </span>
                      </td>
                      <td>
                        <span className="g-mono text-xs text-ink-3">
                          {cpt.globalDays}d
                        </span>
                      </td>
                      <td className="text-right g-num text-ink-2">
                        {Number(cpt.workRvu).toFixed(2)}
                      </td>
                      <td className="text-right g-num font-semibold text-ink">
                        {Number(cpt.totalRvu).toFixed(2)}
                      </td>
                      <td data-type="money" className="text-right font-semibold text-grove-strong">
                        <Money cents={cpt.defaultChargeCents} />
                      </td>
                      <td>
                        <div className="text-[11px] text-ink-3 truncate max-w-[150px]">
                          {cpt.allowedPlacesOfService?.join(', ') || '11 (Office)'}
                        </div>
                      </td>
                      <td>
                        <StatusPill status={cpt.status || 'active'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ICD-10 DIAGNOSES (Dx) */}
      {currentTab === 'dx' && (
        <div className="space-y-3">
          {/* Search & Favorites Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="tab" value="dx" />
              <input
                name="q"
                defaultValue={sp.q}
                placeholder="Search diagnosis code, term, or condition..."
                className="h-8 w-72 rounded-md border border-line-strong bg-surface-raised px-2.5 text-sm"
              />
              <select
                name="category"
                defaultValue={sp.category ?? ''}
                className={`${selectCls} w-52`}
              >
                <option value="">All specialties</option>
                <option value="Endocrine & Metabolic">Endocrine & Metabolic</option>
                <option value="Cardiovascular">Cardiovascular</option>
                <option value="Respiratory">Respiratory</option>
                <option value="Musculoskeletal">Musculoskeletal</option>
                <option value="Preventive Medicine">Preventive Medicine</option>
                <option value="Behavioral Health">Behavioral Health</option>
                <option value="Gastrointestinal">Gastrointestinal</option>
                <option value="Genitourinary">Genitourinary</option>
                <option value="Symptoms & Signs">Symptoms & Signs</option>
              </select>
              <button className="h-8 rounded-md border border-line-strong bg-surface-raised px-3 text-sm font-medium hover:bg-surface-sunken transition-colors">
                Filter
              </button>
            </form>

            <div className="flex items-center gap-1.5">
              <Link
                href={`/settings/fee-schedules?tab=dx${sp.favorites === '1' ? '' : '&favorites=1'}`}
                className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold border transition-colors ${
                  sp.favorites === '1'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-surface-raised border-line text-ink-2 hover:bg-surface-sunken'
                }`}
              >
                <span>★</span>
                <span>My Favorite Dx (Quick-Pick)</span>
                <span className="rounded bg-black/10 px-1.5 text-[10px] font-mono">
                  {dxCodes.filter((d: any) => d.favorite).length}
                </span>
              </Link>
            </div>
          </div>

          {filteredDxCodes.length === 0 ? (
            <Empty title="No diagnosis codes match" body="Try clearing your search query or specialty filter to view ICD-10 codes." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised shadow-xs">
              <table className="g-table">
                <thead>
                  <tr>
                    <th className="w-8">★</th>
                    <th>ICD-10-CM</th>
                    <th>Clinical Description</th>
                    <th>Specialty / System</th>
                    <th>Billable</th>
                    <th>Valid Principal</th>
                    <th>Specificity & Dual Coding Guidance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDxCodes.map((dx: any) => (
                    <tr key={dx.code} tabIndex={0} className="hover:bg-surface-sunken">
                      <td className="text-center">
                        <span
                          className={`text-sm ${
                            dx.favorite ? 'text-amber-500 font-bold' : 'text-ink-4 opacity-30'
                          }`}
                          title={dx.favorite ? 'In Favorite Superbill Quick-Pick' : 'Not starred'}
                        >
                          ★
                        </span>
                      </td>
                      <td>
                        <span className="g-mono font-bold text-xs bg-grove-soft text-grove-strong px-2 py-0.5 rounded border border-grove-line">
                          {dx.code}
                        </span>
                      </td>
                      <td>
                        <div className="text-xs font-semibold text-ink truncate max-w-sm" title={dx.description}>
                          {dx.description}
                        </div>
                      </td>
                      <td>
                        <span className="rounded bg-surface-sunken px-1.5 py-0.2 text-[10px] text-ink-2 border border-line">
                          {dx.category}
                        </span>
                      </td>
                      <td>
                        <span className="rounded bg-ok-soft px-1.5 py-0.2 text-[10px] font-semibold text-ok">
                          Yes (Billable)
                        </span>
                      </td>
                      <td>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                            dx.validAsPrincipal
                              ? 'bg-ok-soft text-ok'
                              : 'bg-surface-sunken text-ink-3'
                          }`}
                        >
                          {dx.validAsPrincipal ? 'Primary / Secondary' : 'Secondary Only'}
                        </span>
                      </td>
                      <td>
                        <div className="text-[11px] text-ink-3 truncate max-w-xs" title={dx.dualCodingNote || undefined}>
                          {dx.dualCodingNote || '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

