'use client';

import { useState } from 'react';
import Link from 'next/link';

/** Revenue lines printed per sheet. Line 23 is the 0001 totals line, not a revenue line. */
const LINES_PER_PAGE = 22;

const money = (cents: number) => (cents / 100).toFixed(2);
const mmddyy = (iso?: string) => (iso ? `${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(2, 4)}` : '');
const nodot = (code?: string) => (code || '').replace('.', '');

export function Ub04FormViewer({ claimId, data }: { claimId: string; data: any }) {
  const [viewMode, setViewMode] = useState<'standard_red' | 'data_only'>('standard_red');
  const [zoom, setZoom] = useState(100);

  const a = data.a ?? {};
  const c = a.claim ?? {};
  const fac = a.facility ?? {};
  const pt = a.patient ?? {};
  const payers: any[] = a.payers ?? [];
  const prov = a.providers ?? {};
  const lines: any[] = a.lines ?? [];

  const isRed = viewMode === 'standard_red';
  const border = isRed ? 'border-red-600' : 'border-neutral-300';
  const label = isRed ? 'text-red-700' : 'text-neutral-500';
  const shaded = isRed ? 'bg-red-50/70' : 'bg-neutral-50';

  const pages = Math.max(1, Math.ceil(lines.length / LINES_PER_PAGE));
  const nonCovered = lines.reduce((s, l) => s + (l.nonCoveredCents ?? 0), 0);

  // The form has a fixed number of boxes whether or not the claim fills them.
  const conditions: string[] = [...(c.conditionCodes ?? [])].concat(Array(11).fill('')).slice(0, 11);
  const occurrences: any[] = [...(c.occurrenceCodes ?? [])].concat(Array(4).fill(null)).slice(0, 4);
  const values: any[] = [...(c.valueCodes ?? [])].concat(Array(12).fill(null)).slice(0, 12);
  const otherDx: any[] = [...(c.otherDiagnoses ?? [])].concat(Array(17).fill(null)).slice(0, 17);

  const Cell = ({ n, children, className = '' }: { n: string; children?: React.ReactNode; className?: string }) => (
    <div className={`border-r ${border} px-1 py-0.5 ${className}`}>
      <div className={`text-[7px] font-bold uppercase leading-none ${label}`}>{n}</div>
      <div className="font-mono text-[9px] font-bold leading-tight text-neutral-950">{children || ' '}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <Link href={`/claims/${claimId}`} className="text-xs font-medium text-grove-strong hover:underline">
            ← Back to Claim
          </Link>
          <h1 className="font-display text-base font-semibold text-ink">
            UB-04 (CMS-1450) · {c.claimNumber} · TOB {c.typeOfBill}
          </h1>
          <p className="text-xs text-ink-3">
            Institutional claim · {pages} sheet{pages === 1 ? '' : 's'} · {lines.length} revenue lines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            className="h-8 rounded-md border border-line-strong bg-surface px-2 text-xs"
          >
            <option value="standard_red">Standard red form</option>
            <option value="data_only">Data only (pre-printed stock)</option>
          </select>
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-8 rounded-md border border-line-strong bg-surface px-2 text-xs"
          >
            {[75, 100, 125].map((z) => (
              <option key={z} value={z}>
                {z}%
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong"
          >
            Print UB-04 / Export PDF
          </button>
        </div>
      </div>

      {/* Zooming above 100% grows the sheet visually without changing its layout
          footprint, so it gets its own scroll container instead of bleeding into the
          page body. */}
      <div className="overflow-x-auto print:overflow-visible">
      <div
        className="origin-top bg-white p-3 text-neutral-950 shadow-sm"
        style={{ transform: `scale(${zoom / 100})` }}
      >
        {/* FL 1–6 */}
        <div className={`grid grid-cols-12 border-2 ${border}`}>
          <div className={`col-span-4 border-r ${border} p-1`}>
            <div className={`text-[7px] font-bold uppercase ${label}`}>1. Billing Provider</div>
            <div className="font-mono text-[10px] font-bold uppercase">{fac.name}</div>
            <div className="font-mono text-[9px]">{fac.address1}</div>
            <div className="font-mono text-[9px]">
              {fac.city} {fac.state} {fac.zip}
            </div>
            <div className="font-mono text-[9px]">{fac.phone}</div>
          </div>
          <div className={`col-span-3 border-r ${border} p-1`}>
            <div className={`text-[7px] font-bold uppercase ${label}`}>2. Pay-To</div>
            <div className="font-mono text-[9px] text-neutral-500">SAME</div>
          </div>
          <div className="col-span-5 grid grid-cols-2">
            <Cell n="3a. Pat. Cntl #">{c.patientControlNumber}</Cell>
            <Cell n="4. Type of Bill" className={shaded}>
              {c.typeOfBill}
            </Cell>
            <Cell n="3b. Med. Rec. #">{c.medicalRecordNumber}</Cell>
            <Cell n="5. Fed. Tax No.">{c.federalTaxNumber}</Cell>
            <Cell n="6. Statement From">{mmddyy(c.statementFrom)}</Cell>
            <Cell n="6. Through">{mmddyy(c.statementThrough)}</Cell>
          </div>
        </div>

        {/* FL 8–11 */}
        <div className={`grid grid-cols-12 border-x-2 border-b-2 ${border}`}>
          <Cell n="8a. Patient ID" className="col-span-2">
            {pt.patientId}
          </Cell>
          <Cell n="8b. Patient Name" className="col-span-4">
            {pt.lastName}, {pt.firstName} {pt.middleName}
          </Cell>
          <Cell n="9. Patient Address" className="col-span-4">
            {pt.address1}, {pt.city} {pt.state} {pt.zip} {pt.countryCode}
          </Cell>
          <Cell n="10. Birthdate" className="col-span-1">
            {mmddyy(pt.dateOfBirth)}
          </Cell>
          <Cell n="11. Sex" className="col-span-1">
            {pt.sex}
          </Cell>
        </div>

        {/* FL 12–17 + 18–28 + 29 */}
        <div className={`grid grid-cols-12 border-x-2 border-b-2 ${border}`}>
          <Cell n="12. Adm. Date">{mmddyy(c.admissionDate)}</Cell>
          <Cell n="13. Hr">{c.admissionHour}</Cell>
          <Cell n="14. Type">{c.admissionPriority}</Cell>
          <Cell n="15. Src">{c.pointOfOrigin}</Cell>
          <Cell n="16. DHr">{c.dischargeHour}</Cell>
          <Cell n="17. Stat">{c.patientStatus}</Cell>
          <div className={`col-span-5 border-r ${border} px-1 py-0.5`}>
            <div className={`text-[7px] font-bold uppercase leading-none ${label}`}>18–28. Condition Codes</div>
            <div className="flex gap-1 font-mono text-[9px] font-bold">
              {conditions.map((cc, i) => (
                <span key={i} className={`w-5 border-b ${border} text-center`}>
                  {cc || ' '}
                </span>
              ))}
            </div>
          </div>
          <Cell n="29. ACDT ST">{c.accidentState}</Cell>
        </div>

        {/* FL 31–36 + 38 + 39–41 */}
        <div className={`grid grid-cols-12 border-x-2 border-b-2 ${border}`}>
          <div className={`col-span-5 border-r ${border} p-1`}>
            <div className={`text-[7px] font-bold uppercase ${label}`}>31–34. Occurrence Codes & Dates</div>
            <div className="mt-0.5 grid grid-cols-4 gap-1">
              {occurrences.map((o, i) => (
                <div key={i} className={`border ${border} px-0.5 text-center font-mono text-[9px] font-bold`}>
                  {o ? `${o.code} ${mmddyy(o.date)}` : ' '}
                </div>
              ))}
            </div>
            <div className={`mt-1 text-[7px] font-bold uppercase ${label}`}>35–36. Occurrence Span</div>
            <div className="mt-0.5 grid grid-cols-2 gap-1">
              {[0, 1].map((i) => {
                const s = (c.occurrenceSpans ?? [])[i];
                return (
                  <div key={i} className={`border ${border} px-0.5 text-center font-mono text-[9px] font-bold`}>
                    {s ? `${s.code} ${mmddyy(s.from)}–${mmddyy(s.through)}` : ' '}
                  </div>
                );
              })}
            </div>
          </div>
          <div className={`col-span-3 border-r ${border} p-1`}>
            <div className={`text-[7px] font-bold uppercase ${label}`}>38. Responsible Party</div>
            <div className="font-mono text-[9px] font-bold uppercase">
              {pt.lastName}, {pt.firstName}
            </div>
            <div className="font-mono text-[9px]">{pt.address1}</div>
            <div className="font-mono text-[9px]">
              {pt.city} {pt.state} {pt.zip}
            </div>
          </div>
          <div className="col-span-4 p-1">
            <div className={`text-[7px] font-bold uppercase ${label}`}>39–41. Value Codes & Amounts</div>
            <div className="mt-0.5 grid grid-cols-3 gap-x-2">
              {values.map((v, i) => (
                <div key={i} className="flex justify-between font-mono text-[9px] font-bold">
                  <span>{v?.code || ' '}</span>
                  <span>{v ? money(v.amountCents) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FL 42–48 revenue grid */}
        <div className={`border-x-2 border-b-2 ${border}`}>
          <div className={`grid grid-cols-[54px_1fr_110px_60px_54px_88px_78px] ${shaded} border-b ${border}`}>
            {['42. Rev Cd', '43. Description', '44. HCPCS / Rate', '45. Serv Date', '46. Units', '47. Total Charges', '48. Non-Covered'].map((h) => (
              <div key={h} className={`border-r ${border} px-1 py-0.5 text-[7px] font-bold uppercase ${label}`}>
                {h}
              </div>
            ))}
          </div>
          {lines.map((l, i) => (
            <div key={i} className={`grid grid-cols-[54px_1fr_110px_60px_54px_88px_78px] border-b ${border} font-mono text-[9px] font-bold`}>
              <div className={`border-r ${border} px-1`}>{l.revenueCode}</div>
              <div className={`border-r ${border} px-1 uppercase`}>{l.description}</div>
              <div className={`border-r ${border} px-1`}>{[l.hcpcs, ...(l.modifiers ?? [])].filter(Boolean).join(' ')}</div>
              <div className={`border-r ${border} px-1`}>{mmddyy(l.serviceDate)}</div>
              <div className={`border-r ${border} px-1 text-right`}>{l.units}</div>
              <div className={`border-r ${border} px-1 text-right`}>{money(l.chargeCents)}</div>
              <div className="px-1 text-right">{l.nonCoveredCents ? money(l.nonCoveredCents) : ''}</div>
            </div>
          ))}
          {/* Line 23 — totals for the whole claim, not the page. */}
          <div className={`grid grid-cols-[54px_1fr_110px_60px_54px_88px_78px] ${shaded} font-mono text-[9px] font-bold`}>
            <div className={`border-r ${border} px-1`}>0001</div>
            <div className={`border-r ${border} px-1 uppercase`}>Total Charges</div>
            <div className={`border-r ${border} px-1`}>PAGE 1 OF {pages}</div>
            <div className={`border-r ${border} px-1`}>{mmddyy(c.statementThrough)}</div>
            <div className={`border-r ${border} px-1`} />
            <div className={`border-r ${border} px-1 text-right`}>{money(c.totalChargeCents ?? 0)}</div>
            <div className="px-1 text-right">{nonCovered ? money(nonCovered) : ''}</div>
          </div>
        </div>

        {/* FL 50–65 payer block */}
        <div className={`border-x-2 border-b-2 ${border}`}>
          <div className={`grid grid-cols-[24px_1fr_110px_40px_40px_90px_90px] ${shaded} border-b ${border}`}>
            {['', '50. Payer Name', '51. Health Plan ID', '52. Rel', '53. Asg', '54. Prior Pmts', '55. Est. Due'].map((h, i) => (
              <div key={i} className={`border-r ${border} px-1 py-0.5 text-[7px] font-bold uppercase ${label}`}>
                {h}
              </div>
            ))}
          </div>
          {['A', 'B', 'C'].map((row, i) => {
            const p = payers[i];
            return (
              <div key={row} className={`grid grid-cols-[24px_1fr_110px_40px_40px_90px_90px] border-b ${border} font-mono text-[9px] font-bold`}>
                <div className={`border-r ${border} px-1 ${label}`}>{row}</div>
                <div className={`border-r ${border} px-1 uppercase`}>{p?.name || ' '}</div>
                <div className={`border-r ${border} px-1`}>{p?.healthPlanId || ''}</div>
                <div className={`border-r ${border} px-1 text-center`}>{p?.releaseOfInformation || ''}</div>
                <div className={`border-r ${border} px-1 text-center`}>{p ? (p.benefitsAssigned ? 'Y' : 'N') : ''}</div>
                <div className={`border-r ${border} px-1 text-right`}>{p ? money(p.priorPaymentsCents ?? 0) : ''}</div>
                <div className="px-1 text-right">{p?.estimatedDueCents ? money(p.estimatedDueCents) : ''}</div>
              </div>
            );
          })}

          <div className={`grid grid-cols-[24px_1fr_50px_150px_130px_130px] ${shaded} border-b ${border}`}>
            {['', '58. Insured Name', '59. Rel', '60. Insured Unique ID', '61. Group Name', '62. Group Number'].map((h, i) => (
              <div key={i} className={`border-r ${border} px-1 py-0.5 text-[7px] font-bold uppercase ${label}`}>
                {h}
              </div>
            ))}
          </div>
          {['A', 'B', 'C'].map((row, i) => {
            const p = payers[i];
            return (
              <div key={row} className={`grid grid-cols-[24px_1fr_50px_150px_130px_130px] border-b ${border} font-mono text-[9px] font-bold`}>
                <div className={`border-r ${border} px-1 ${label}`}>{row}</div>
                <div className={`border-r ${border} px-1 uppercase`}>{p?.insuredName || ' '}</div>
                <div className={`border-r ${border} px-1 text-center`}>{p?.relationship || ''}</div>
                <div className={`border-r ${border} px-1`}>{p?.insuredId || ''}</div>
                <div className={`border-r ${border} px-1 uppercase`}>{p?.groupName || ''}</div>
                <div className="px-1">{p?.groupNumber || ''}</div>
              </div>
            );
          })}

          <div className={`grid grid-cols-[24px_1fr_1fr_1fr] border-b ${border}`}>
            <div className={`border-r ${border} px-1 py-0.5 text-[7px] ${label}`} />
            {['63. Treatment Auth Codes', '64. Document Control Number', '65. Employer Name'].map((h) => (
              <div key={h} className={`border-r ${border} px-1 py-0.5 text-[7px] font-bold uppercase ${label}`}>
                {h}
              </div>
            ))}
          </div>
          {['A', 'B', 'C'].map((row, i) => {
            const p = payers[i];
            return (
              <div key={row} className={`grid grid-cols-[24px_1fr_1fr_1fr] border-b ${border} font-mono text-[9px] font-bold`}>
                <div className={`border-r ${border} px-1 ${label}`}>{row}</div>
                <div className={`border-r ${border} px-1`}>{p?.treatmentAuthCode || ' '}</div>
                <div className={`border-r ${border} px-1`}>{p?.documentControlNumber || ''}</div>
                <div className="px-1 uppercase">{p?.employerName || ''}</div>
              </div>
            );
          })}
          <div className={`flex justify-end gap-2 px-1 py-0.5 font-mono text-[9px] font-bold`}>
            <span className={`text-[7px] font-bold uppercase ${label}`}>56. Billing NPI</span>
            {fac.npi}
          </div>
        </div>

        {/* FL 66–75 diagnoses and procedures */}
        <div className={`border-x-2 border-b-2 ${border} p-1`}>
          <div className="flex items-baseline gap-2">
            <span className={`text-[7px] font-bold uppercase ${label}`}>66. DX Ver</span>
            <span className="font-mono text-[9px] font-bold">{c.icdVersion}</span>
            <span className={`ml-2 text-[7px] font-bold uppercase ${label}`}>67. Principal DX</span>
            <span className="font-mono text-[10px] font-bold">
              {nodot(c.principalDiagnosis?.code)}
              <sup className="ml-0.5 text-[7px]">{c.principalDiagnosis?.presentOnAdmission}</sup>
            </span>
          </div>
          <div className={`mt-1 text-[7px] font-bold uppercase ${label}`}>67 A–Q. Other Diagnoses (POA superscript)</div>
          <div className="mt-0.5 grid grid-cols-9 gap-x-1 font-mono text-[9px] font-bold">
            {otherDx.map((d, i) => (
              <span key={i} className={`border-b ${border}`}>
                {d ? nodot(d.code) : ' '}
                {d?.presentOnAdmission ? <sup className="ml-0.5 text-[7px]">{d.presentOnAdmission}</sup> : null}
              </span>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span>
              <span className={`text-[7px] font-bold uppercase ${label}`}>69. Admitting DX </span>
              <span className="font-mono text-[9px] font-bold">{nodot(c.admittingDiagnosis)}</span>
            </span>
            <span>
              <span className={`text-[7px] font-bold uppercase ${label}`}>70. Reason for Visit </span>
              <span className="font-mono text-[9px] font-bold">{(c.reasonForVisit ?? []).map(nodot).join(' ')}</span>
            </span>
            <span>
              <span className={`text-[7px] font-bold uppercase ${label}`}>71. PPS </span>
              <span className="font-mono text-[9px] font-bold">{c.ppsCode || '—'}</span>
            </span>
            <span>
              <span className={`text-[7px] font-bold uppercase ${label}`}>74. Principal Procedure </span>
              <span className="font-mono text-[9px] font-bold">
                {c.principalProcedure ? `${c.principalProcedure.code} ${mmddyy(c.principalProcedure.date)}` : '—'}
              </span>
            </span>
            <span>
              <span className={`text-[7px] font-bold uppercase ${label}`}>74 a–e. Other </span>
              <span className="font-mono text-[9px] font-bold">
                {(c.otherProcedures ?? []).map((p: any) => `${p.code} ${mmddyy(p.date)}`).join(' · ') || '—'}
              </span>
            </span>
          </div>
        </div>

        {/* FL 76–81 providers and remarks */}
        <div className={`grid grid-cols-2 border-x-2 border-b-2 ${border}`}>
          {[
            ['76. Attending', prov.attending],
            ['77. Operating', prov.operating],
            ['78. Other', (prov.other ?? [])[0]],
            ['79. Other', (prov.other ?? [])[1]],
          ].map(([title, p]: any, i) => (
            <div key={i} className={`border-r border-b ${border} px-1 py-0.5`}>
              <div className={`text-[7px] font-bold uppercase ${label}`}>
                {title} · NPI <span className="font-mono text-neutral-950">{p?.npi || '—'}</span>
                {p?.qualifier ? (
                  <>
                    {' '}
                    · QUAL <span className="font-mono text-neutral-950">{p.qualifier}</span> {p.otherId}
                  </>
                ) : null}
              </div>
              <div className="font-mono text-[9px] font-bold uppercase">
                {p ? `${p.lastName}, ${p.firstName}` : ' '}
              </div>
            </div>
          ))}
          <div className={`col-span-2 flex items-baseline justify-between px-1 py-0.5`}>
            <span>
              <span className={`text-[7px] font-bold uppercase ${label}`}>80. Remarks </span>
              <span className="font-mono text-[9px] font-bold uppercase">{c.remarks}</span>
            </span>
            <span>
              <span className={`text-[7px] font-bold uppercase ${label}`}>81. Code-Code </span>
              <span className="font-mono text-[9px] font-bold">
                {(c.codeCode ?? []).map((cc: any) => `${cc.qualifier} ${cc.code}`).join(' · ')}
              </span>
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
