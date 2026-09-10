'use client';

import { useState } from 'react';
import Link from 'next/link';

interface HcfaFormViewerProps {
  claimId: string;
  claimNumber: string;
  claimType: string;
  claimFrequencyCode: string;
  data: any;
}

export function HcfaFormViewer({
  claimId,
  claimNumber,
  claimType,
  claimFrequencyCode,
  data,
}: HcfaFormViewerProps) {
  const [viewMode, setViewMode] = useState<'standard_red' | 'data_only'>('standard_red');
  const [zoom, setZoom] = useState<number>(100);

  const { a } = data;
  const c = a.claim || {};
  const p = a.patient || {};
  const cov = a.coverage || {};
  const pyr = a.payer || {};
  const prc = a.practice || {};
  const doc = a.renderingProvider || {};
  const lines = a.lines || [];

  const dobParts = (p.dateOfBirth || p.dob || '1982-05-14').split('-');
  const dobMm = dobParts[1] || '05';
  const dobDd = dobParts[2] || '14';
  const dobYy = (dobParts[0] || '1982').slice(-2);

  const totalChargeCents =
    c.totalChargeCents || lines.reduce((acc: number, l: any) => acc + (l.chargeCents || 0), 0);
  const paidCents = c.paidCents || 0;
  const balanceCents = totalChargeCents - paidCents;

  const dxCodes: string[] = c.diagnosisCodes && c.diagnosisCodes.length > 0 ? c.diagnosisCodes : ['M54.5', 'M25.561'];

  const isRed = viewMode === 'standard_red';
  const borderColor = isRed ? 'border-red-600' : 'border-transparent';
  const labelColor = isRed ? 'text-red-700' : 'opacity-0';
  const shadedBg = isRed ? 'bg-red-50/80' : 'bg-transparent';

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 py-6 px-2 sm:px-4 print:bg-white print:p-0 print:m-0">
      {/* Top Controls Toolbar (Hidden in Print) */}
      <div className="mx-auto max-w-[920px] mb-4 flex flex-wrap items-center justify-between gap-3 bg-surface-raised p-3 rounded-lg border border-line shadow-xs print:hidden">
        <div className="flex items-center gap-2">
          <Link
            href={`/claims/${claimId}`}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
          >
            ← Back to Claim
          </Link>
          <span className="text-ink-4">|</span>
          <span className="text-xs font-bold text-ink">
            CMS-1500 (HCFA-1500 02/12) · {claimNumber}
          </span>
          <span className="rounded-full bg-grove-soft px-2 py-0.5 text-[11px] font-semibold text-grove-strong">
            {claimType || '837P'} {claimFrequencyCode === '7' ? '· Corrected (7)' : ''}
          </span>
        </div>

        {/* View Modes & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center rounded-md border border-line bg-surface text-xs text-ink overflow-hidden">
            <button
              onClick={() => setZoom((z) => Math.max(75, z - 10))}
              className="px-2 py-1 hover:bg-surface-sunken"
              title="Zoom Out"
            >
              -
            </button>
            <span className="px-2 py-1 font-mono text-[11px] border-x border-line">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(125, z + 10))}
              className="px-2 py-1 hover:bg-surface-sunken"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex rounded-md border border-line bg-surface p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('standard_red')}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                isRed
                  ? 'bg-red-600 text-white font-semibold shadow-xs'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              Standard Red Form
            </button>
            <button
              type="button"
              onClick={() => setViewMode('data_only')}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                !isRed
                  ? 'bg-grove text-white font-semibold shadow-xs'
                  : 'text-ink-2 hover:text-ink'
              }`}
              title="Hides red template lines for printing onto official pre-printed red paper sheets"
            >
              Data Only (Pre-printed Paper)
            </button>
          </div>

          {/* Direct PDF Download */}
          <a
            href={`/claims/${claimId}/cms1500`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink hover:bg-surface-sunken"
          >
            <span>📄</span>
            <span>Download PDF</span>
          </a>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong shadow-xs transition-colors"
          >
            <span>🖨️</span>
            <span>Print Form</span>
          </button>
        </div>
      </div>

      {/* Main Standard CMS-1500 Sheet Container */}
      <div
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
        className="mx-auto max-w-[880px] bg-white border border-neutral-300 shadow-xl p-4 sm:p-6 print:border-none print:shadow-none print:p-0 print:m-0 print:transform-none text-[10px] leading-tight font-sans text-neutral-900 transition-transform"
      >
        {/* TOP CARRIER & PICA BANNER */}
        <div className="flex justify-between items-start mb-2 border-b-2 border-red-600 pb-2">
          <div className="w-1/2">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[9px] font-bold border border-red-500 px-1 text-red-700">PICA</span>
              <span className="font-mono text-[9px] text-neutral-400">1 2</span>
            </div>
            <h1 className="font-black text-red-700 text-sm tracking-wider uppercase">
              Health Insurance Claim Form
            </h1>
            <p className="text-[8px] font-bold text-red-600 uppercase tracking-widest">
              Approved by National Uniform Claim Committee (NUCC) 02/12
            </p>
          </div>

          {/* CARRIER ENVELOPE WINDOW BOX (TOP RIGHT) */}
          <div className="w-1/2 max-w-[320px] border border-red-500 rounded p-2 bg-neutral-50/50">
            <span className="text-[8px] font-bold text-red-700 uppercase block mb-0.5">CARRIER</span>
            <div className="font-mono font-bold text-xs uppercase text-neutral-950">
              {pyr.name || 'BLUE CROSS BLUE SHIELD'}
            </div>
            <div className="font-mono text-[10px] text-neutral-800 uppercase mt-0.5">
              PO BOX 79042
            </div>
            <div className="font-mono text-[10px] text-neutral-800 uppercase">
              INDIANAPOLIS, IN 46206-9042
            </div>
          </div>
        </div>

        {/* BOX 1 & 1a */}
        <div className={`grid grid-cols-12 border-2 ${borderColor} mb-0.5`}>
          <div className={`col-span-8 p-1 border-r-2 ${borderColor} ${shadedBg}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              1. MEDICARE / MEDICAID / TRICARE / CHAMPVA / GROUP / FECA / OTHER
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-[9px] font-bold uppercase text-neutral-900">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  readOnly
                  checked={pyr.name?.toLowerCase().includes('medicare')}
                  className="accent-red-600"
                />{' '}
                Medicare #
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  readOnly
                  checked={pyr.name?.toLowerCase().includes('medicaid')}
                  className="accent-red-600"
                />{' '}
                Medicaid #
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  readOnly
                  checked={pyr.name?.toLowerCase().includes('tricare')}
                  className="accent-red-600"
                />{' '}
                TRICARE DoD#
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  readOnly
                  checked={
                    !pyr.name?.toLowerCase().includes('medicare') &&
                    !pyr.name?.toLowerCase().includes('medicaid') &&
                    !pyr.name?.toLowerCase().includes('tricare')
                  }
                  className="accent-red-600"
                />{' '}
                Group Health Plan
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" readOnly className="accent-red-600" /> Other
              </label>
            </div>
          </div>
          <div className="col-span-4 p-1">
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              1a. INSURED&apos;S I.D. NUMBER (For Program in Item 1)
            </span>
            <div className="font-mono font-bold text-xs uppercase text-neutral-950 mt-0.5">
              {cov?.memberId || 'BCBS-992812'}
            </div>
          </div>
        </div>

        {/* BOXES 2, 3, 4 */}
        <div className={`grid grid-cols-12 border-2 ${borderColor} mb-0.5`}>
          <div className={`col-span-5 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              2. PATIENT&apos;S NAME (Last Name, First Name, Middle Initial)
            </span>
            <div className="font-mono font-bold text-xs uppercase text-neutral-950 mt-0.5">
              {p.lastName || 'MILLER'}, {p.firstName || 'ELEANOR'}
            </div>
          </div>
          <div className={`col-span-3 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              3. PATIENT&apos;S BIRTH DATE &amp; SEX
            </span>
            <div className="flex items-center justify-between mt-0.5 font-mono font-bold text-[10px]">
              <span>
                {dobMm} {dobDd} {dobYy}
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-0.5">
                  <input
                    type="checkbox"
                    readOnly
                    checked={p.sex === 'M' || p.gender === 'M'}
                    className="accent-red-600"
                  />{' '}
                  M
                </label>
                <label className="flex items-center gap-0.5">
                  <input
                    type="checkbox"
                    readOnly
                    checked={p.sex === 'F' || p.gender === 'F' || !p.gender}
                    className="accent-red-600"
                  />{' '}
                  F
                </label>
              </div>
            </div>
          </div>
          <div className="col-span-4 p-1">
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              4. INSURED&apos;S NAME (Last Name, First Name, Middle Initial)
            </span>
            <div className="font-mono font-bold text-xs uppercase text-neutral-950 mt-0.5">
              SAME
            </div>
          </div>
        </div>

        {/* BOXES 5, 6, 7 */}
        <div className={`grid grid-cols-12 border-2 ${borderColor} mb-0.5`}>
          <div className={`col-span-5 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              5. PATIENT&apos;S ADDRESS (No., Street)
            </span>
            <div className="font-mono font-bold text-[10px] uppercase text-neutral-950">
              {p.addressLine1 || '742 EVERGREEN TERRACE'}
            </div>
            <div className="flex justify-between font-mono text-[9px] font-bold text-neutral-900 mt-0.5">
              <span>CITY: {p.city || 'SPRINGFIELD'}</span>
              <span>STATE: {p.state || 'IL'}</span>
              <span>ZIP: {p.postalCode || '62704'}</span>
            </div>
            <div className="font-mono text-[9px] text-neutral-800">
              TELEPHONE: {p.phoneMobile || '(555) 234-8901'}
            </div>
          </div>
          <div className={`col-span-3 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              6. PATIENT RELATION TO INSURED
            </span>
            <div className="grid grid-cols-2 gap-1 mt-1 font-mono text-[9px] font-bold">
              <label className="flex items-center gap-1">
                <input type="checkbox" readOnly checked className="accent-red-600" /> Self
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" readOnly className="accent-red-600" /> Spouse
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" readOnly className="accent-red-600" /> Child
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" readOnly className="accent-red-600" /> Other
              </label>
            </div>
          </div>
          <div className="col-span-4 p-1">
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              7. INSURED&apos;S ADDRESS (No., Street)
            </span>
            <div className="font-mono font-bold text-xs uppercase text-neutral-950 mt-0.5">
              SAME
            </div>
            <span className={`text-[8px] font-black uppercase mt-1 block ${labelColor}`}>
              8. RESERVED FOR NUCC USE
            </span>
          </div>
        </div>

        {/* BOXES 9, 10, 11 */}
        <div className={`grid grid-cols-12 border-2 ${borderColor} mb-0.5`}>
          <div className={`col-span-5 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              9. OTHER INSURED&apos;S NAME (Last Name, First Name, Middle Initial)
            </span>
            <div className="font-mono text-[9px] text-neutral-400">NONE</div>
            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>
                9a. OTHER INSURED&apos;S POLICY OR GROUP NUMBER
              </span>
            </div>
            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>
                9b. RESERVED FOR NUCC USE
              </span>
            </div>
            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>
                9d. INSURANCE PLAN NAME OR PROGRAM NAME
              </span>
            </div>
          </div>

          <div className={`col-span-3 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              10. IS PATIENT&apos;S CONDITION RELATED TO:
            </span>
            <div className="text-[8px] font-bold mt-0.5 space-y-0.5">
              <div className="flex justify-between">
                <span>a. EMPLOYMENT?</span>
                <span className="font-mono">NO [X]</span>
              </div>
              <div className="flex justify-between">
                <span>b. AUTO ACCIDENT?</span>
                <span className="font-mono">NO [X]</span>
              </div>
              <div className="flex justify-between">
                <span>c. OTHER ACCIDENT?</span>
                <span className="font-mono">NO [X]</span>
              </div>
              <div className="border-t border-red-300 pt-0.5">
                <span className={`text-[7px] uppercase ${labelColor}`}>10d. CLAIM CODES (NUCC)</span>
              </div>
            </div>
          </div>

          <div className="col-span-4 p-1">
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              11. INSURED&apos;S POLICY GROUP OR FECA NUMBER
            </span>
            <div className="font-mono font-bold text-xs uppercase text-neutral-950">
              {cov?.groupNumber || 'GRP-10492'}
            </div>
            <div className="border-t border-red-300 mt-1 pt-0.5 flex justify-between">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>11a. INSURED&apos;S DOB &amp; SEX</span>
              <span className="font-mono text-[8px] text-neutral-600">SAME</span>
            </div>
            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>
                11c. INSURANCE PLAN NAME OR PROGRAM NAME
              </span>
              <div className="font-mono font-bold text-[10px] uppercase text-neutral-950">
                {pyr.name || 'BLUE CROSS BLUE SHIELD'}
              </div>
            </div>
            <div className="border-t border-red-300 mt-1 pt-0.5 flex justify-between">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>
                11d. IS THERE ANOTHER HEALTH BENEFIT PLAN?
              </span>
              <span className="font-mono text-[8px] font-bold">NO [X]</span>
            </div>
          </div>
        </div>

        {/* BOXES 12 & 13 (SIGNATURES) */}
        <div className={`grid grid-cols-12 border-2 ${borderColor} mb-0.5`}>
          <div className={`col-span-8 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[7px] font-black uppercase ${labelColor} block`}>
              12. PATIENT&apos;S OR AUTHORIZED PERSON&apos;S SIGNATURE (Release of Information)
            </span>
            <p className="text-[7px] text-neutral-600 leading-tight">
              I authorize the release of any medical or other information necessary to process this claim. I also request payment of government benefits either to myself or to the party who accepts assignment below.
            </p>
            <div className="flex justify-between items-center mt-1 font-mono font-bold text-[10px] text-neutral-950">
              <span>SIGNED: SIGNATURE ON FILE</span>
              <span>DATE: {c.serviceDateFrom || '2026-03-01'}</span>
            </div>
          </div>

          <div className="col-span-4 p-1">
            <span className={`text-[7px] font-black uppercase ${labelColor} block`}>
              13. INSURED&apos;S OR AUTHORIZED PERSON&apos;S SIGNATURE (Assignment of Benefits)
            </span>
            <p className="text-[7px] text-neutral-600 leading-tight">
              I authorize payment of medical benefits to the undersigned physician or supplier for services described below.
            </p>
            <div className="font-mono font-bold text-[10px] text-neutral-950 mt-1">
              SIGNED: SIGNATURE ON FILE
            </div>
          </div>
        </div>

        {/* BOXES 14, 15, 16, 17, 18, 19, 20 */}
        <div className={`grid grid-cols-12 border-2 ${borderColor} mb-0.5`}>
          <div className={`col-span-3 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              14. DATE OF CURRENT ILLNESS / INJURY / LMP
            </span>
            <div className="font-mono font-bold text-[10px] text-neutral-950 mt-0.5">
              QUAL: 431 · {c.serviceDateFrom || '2026-03-01'}
            </div>
            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>15. OTHER DATE</span>
            </div>
          </div>

          <div className={`col-span-6 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              17. NAME OF REFERRING PROVIDER OR OTHER SOURCE
            </span>
            <div className="font-mono font-bold text-xs uppercase text-neutral-950 mt-0.5">
              {doc.lastName || 'VANCE'}, {doc.firstName || 'MARCUS'} MD
            </div>
            <div className="flex justify-between items-center border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-bold ${labelColor}`}>17a. QUAL:</span>
              <span className="font-mono text-[9px] font-bold">17b. NPI: {doc.npi || prc.npi || '1487654323'}</span>
            </div>
            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>
                19. ADDITIONAL CLAIM INFORMATION (Designated by NUCC)
              </span>
            </div>
          </div>

          <div className="col-span-3 p-1">
            <span className={`text-[8px] font-black uppercase ${labelColor}`}>
              16. DATES PATIENT UNABLE TO WORK
            </span>
            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>
                18. HOSPITALIZATION DATES
              </span>
            </div>
            <div className="border-t border-red-300 mt-1 pt-0.5 flex justify-between">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>20. OUTSIDE LAB?</span>
              <span className="font-mono text-[8px] font-bold">NO [X]</span>
            </div>
          </div>
        </div>

        {/* BOXES 21, 22, 23 (DIAGNOSIS CODES) */}
        <div className={`grid grid-cols-12 border-2 ${borderColor} mb-0.5`}>
          <div className={`col-span-7 p-1 border-r-2 ${borderColor}`}>
            <div className="flex justify-between items-center">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>
                21. DIAGNOSIS OR NATURE OF ILLNESS OR INJURY
              </span>
              <span className="font-mono font-bold text-[8px] text-neutral-950 bg-neutral-100 px-1 rounded">
                ICD Ind: [0] (ICD-10-CM)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-1 font-mono font-bold text-xs text-neutral-950">
              {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((letter, idx) => {
                const code = dxCodes[idx] || '';
                return (
                  <div key={letter} className="flex items-center gap-1 border-b border-neutral-200 pb-0.5">
                    <span className="text-red-700 font-black">{letter}.</span>
                    <span>{code}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="col-span-5 p-1">
            <span className={`text-[8px] font-black uppercase ${labelColor} block`}>
              22. RESUBMISSION CODE &amp; ORIGINAL REF. NO. (ICN/CCN)
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[10px] font-bold bg-neutral-100 px-1 border border-neutral-300">
                Code: {c.claimFrequencyCode || '1'}
              </span>
              <span className="font-mono text-[10px] font-bold text-neutral-950 truncate">
                ORIG REF: {c.originalPayerControlNumber || c.payerClaimControlNumber || 'PAY-8849201'}
              </span>
            </div>
            <div className="border-t border-red-300 mt-2 pt-1">
              <span className={`text-[8px] font-black uppercase ${labelColor} block`}>
                23. PRIOR AUTHORIZATION NUMBER
              </span>
              <div className="font-mono font-bold text-xs text-neutral-950 mt-0.5">
                {c.priorAuthNumber || 'AUTH-99214-BCBS'}
              </div>
            </div>
          </div>
        </div>

        {/* BOX 24: 6 SERVICE LINES WITH OFFICIAL NUCC SPLIT ROWS */}
        <div className={`border-2 ${borderColor} mb-0.5`}>
          {/* Box 24 Header */}
          <div
            className={`grid grid-cols-12 text-[7px] font-black uppercase ${labelColor} ${shadedBg} border-b-2 ${borderColor} text-center py-0.5`}
          >
            <div className="col-span-3 text-left pl-1">24.A DATES OF SERVICE (MM DD YY)</div>
            <div className="col-span-1">24.B POS</div>
            <div className="col-span-1">24.C EMG</div>
            <div className="col-span-3 text-left pl-1">24.D PROCEDURES, SERVICES, SUPPLIES (CPT / MODIFIERS)</div>
            <div className="col-span-1">24.E DX PTR</div>
            <div className="col-span-1 text-right">24.F CHARGES</div>
            <div className="col-span-1">24.G DAYS</div>
            <div className="col-span-1">24.J NPI</div>
          </div>

          {/* 6 Standard Lines */}
          {Array.from({ length: 6 }).map((_, idx) => {
            const line = lines[idx];
            const hasData = Boolean(line);
            const dosFrom = (line?.serviceDateFrom || c.serviceDateFrom || '2026-03-01').replace(/-/g, ' ');
            const dosTo = (line?.serviceDateTo || c.serviceDateTo || '2026-03-01').replace(/-/g, ' ');
            const mods = [line?.modifier1, line?.modifier2].filter(Boolean).join(' ');

            return (
              <div key={idx} className={`border-b ${borderColor} last:border-b-0`}>
                {/* UPPER SUB-ROW (PINK SHADED): NDC / QUAL / LEGACY ID */}
                <div className={`grid grid-cols-12 text-[8px] font-mono py-0.2 px-1 ${shadedBg} text-neutral-600`}>
                  <div className="col-span-3 text-[7px] text-neutral-500">
                    {hasData && idx === 0 ? 'N4 00069-3150-83 UN1.0' : ''}
                  </div>
                  <div className="col-span-1"></div>
                  <div className="col-span-1"></div>
                  <div className="col-span-3 text-[7px] text-neutral-400">
                    {hasData ? 'SUPPLEMENTAL INFO' : ''}
                  </div>
                  <div className="col-span-1"></div>
                  <div className="col-span-1"></div>
                  <div className="col-span-1"></div>
                  <div className="col-span-1 text-right text-[7px]">
                    {hasData ? 'QUAL: 0B' : ''}
                  </div>
                </div>

                {/* LOWER SUB-ROW (WHITE): CPT / CHARGES / NPI */}
                <div className="grid grid-cols-12 text-[9px] font-mono font-bold py-0.5 px-1 bg-white items-center text-center text-neutral-950">
                  <div className="col-span-3 text-left">
                    {hasData ? `${dosFrom} - ${dosTo}` : '· · · · · · · · · · · ·'}
                  </div>
                  <div className="col-span-1">{hasData ? line.placeOfService || '11' : '· ·'}</div>
                  <div className="col-span-1 text-neutral-400">{hasData ? '—' : '·'}</div>
                  <div className="col-span-3 text-left">
                    {hasData ? (
                      <span>
                        {line.cptCode || '99214'} {mods ? <span className="text-red-700 ml-1">{mods}</span> : null}
                      </span>
                    ) : (
                      '· · · · ·'
                    )}
                  </div>
                  <div className="col-span-1">{hasData ? (line.diagnosisPointers || ['A']).join('') : '·'}</div>
                  <div className="col-span-1 text-right font-black">
                    {hasData ? `$${((line.chargeCents || 25000) / 100).toFixed(2)}` : '0.00'}
                  </div>
                  <div className="col-span-1">{hasData ? line.units || 1 : '·'}</div>
                  <div className="col-span-1 font-mono text-[8px] text-neutral-800">
                    {hasData ? doc.npi || '1487654323' : '· · · · · · · · · ·'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM SECTION: BOXES 25 - 33 */}
        <div className={`grid grid-cols-12 border-2 ${borderColor}`}>
          {/* BOXES 25, 26, 27 */}
          <div className={`col-span-4 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor} block`}>
              25. FEDERAL TAX I.D. NUMBER
            </span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-mono font-bold text-xs uppercase text-neutral-950">
                {prc.taxId || 'XX-XXX1234'}
              </span>
              <div className="flex items-center gap-2 text-[9px] font-bold">
                <label className="flex items-center gap-0.5">
                  <input type="checkbox" readOnly checked className="accent-red-600" /> EIN
                </label>
                <label className="flex items-center gap-0.5">
                  <input type="checkbox" readOnly className="accent-red-600" /> SSN
                </label>
              </div>
            </div>

            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor} block`}>
                26. PATIENT&apos;S ACCOUNT NO.
              </span>
              <div className="font-mono font-bold text-xs text-neutral-950">
                {p.mrn || 'MRN-44910'}
              </div>
            </div>

            <div className="border-t border-red-300 mt-1 pt-0.5 flex justify-between items-center">
              <span className={`text-[8px] font-black uppercase ${labelColor}`}>
                27. ACCEPT ASSIGNMENT?
              </span>
              <span className="font-mono font-bold text-[9px]">YES [X]</span>
            </div>
          </div>

          {/* BOXES 28, 29, 30 (TOTALS) */}
          <div className={`col-span-3 p-1 border-r-2 ${borderColor}`}>
            <span className={`text-[8px] font-black uppercase ${labelColor} block`}>
              28. TOTAL CHARGE
            </span>
            <div className="font-mono font-black text-xs text-neutral-950">
              ${(totalChargeCents / 100).toFixed(2)}
            </div>

            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor} block`}>
                29. AMOUNT PAID
              </span>
              <div className="font-mono font-bold text-[11px] text-neutral-900">
                ${(paidCents / 100).toFixed(2)}
              </div>
            </div>

            <div className="border-t border-red-300 mt-1 pt-0.5">
              <span className={`text-[8px] font-black uppercase ${labelColor} block`}>
                30. RSVD FOR NUCC USE / BALANCE DUE
              </span>
              <div className="font-mono font-black text-xs text-neutral-950">
                ${(balanceCents / 100).toFixed(2)}
              </div>
            </div>
          </div>

          {/* BOXES 31, 32, 33 (SIGNATURE & PROVIDER/FACILITY) */}
          <div className="col-span-5 p-1">
            <span className={`text-[8px] font-black uppercase ${labelColor} block`}>
              31. SIGNATURE OF PHYSICIAN OR SUPPLIER INCLUDING DEGREES OR CREDENTIALS
            </span>
            <p className="text-[7px] text-neutral-600">
              I certify that the statements on the reverse apply to this bill and are made a part thereof.
            </p>
            <div className="flex justify-between items-center mt-1 font-mono font-bold text-[10px] text-neutral-950">
              <span>{doc.firstName || 'MARCUS'} {doc.lastName || 'VANCE'}, MD</span>
              <span>DATE: {c.serviceDateFrom || '2026-03-01'}</span>
            </div>

            <div className="grid grid-cols-2 gap-1 border-t border-red-300 mt-1 pt-1 text-[8px]">
              <div>
                <span className={`font-black uppercase ${labelColor} block`}>
                  32. SERVICE FACILITY LOCATION
                </span>
                <div className="font-mono font-bold text-neutral-950 uppercase">
                  {c.facilityName || 'ORCHARD MEDICAL CLINIC'}
                </div>
                <div className="font-mono text-neutral-700">100 MEDICAL CENTER DR</div>
                <div className="font-mono text-neutral-700">SPRINGFIELD, IL 62704</div>
                <div className="font-mono font-bold text-neutral-950 mt-0.5">
                  a. NPI: {c.facilityNpi || '1992837462'}
                </div>
              </div>

              <div>
                <span className={`font-black uppercase ${labelColor} block`}>
                  33. BILLING PROVIDER INFO &amp; PH #
                </span>
                <div className="font-mono font-bold text-neutral-950 uppercase">
                  {prc.name || 'ORCHARD FAMILY PRACTICE'}
                </div>
                <div className="font-mono text-neutral-700">742 EVERGREEN TERRACE</div>
                <div className="font-mono text-neutral-700">TEL: (555) 234-8901</div>
                <div className="font-mono font-bold text-neutral-950 mt-0.5">
                  a. NPI: {prc.npi || '1487654323'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OFFICIAL NUCC FOOTER */}
        <div className="mt-2 text-center text-[7px] font-mono text-neutral-500 uppercase tracking-wider">
          FORM CMS-1500 (02/12) · APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) · ANSI ASC X12 837P COMPLIANT
        </div>
      </div>
    </div>
  );
}

