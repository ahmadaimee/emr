import { toCents } from '../envelope';
import type { Segment } from '../segment';
import type { TransactionSet } from '../tokenizer';
import type { ClaimStatus, ClaimStatusRecord, ClaimStatusResponse277, Person } from '../types';

/**
 * 277 parser — 005010X212. The reply to a 276, walking the same payer / provider /
 * subscriber / dependent loop shape `generate276` sends.
 *
 * A claim can carry more than one STC — the payer restates history (received →
 * pending → finalized) rather than only the current state — so statuses accumulate
 * on the claim in the order the payer sent them; the last one is the current status.
 */
export function parse277(ts: TransactionSet): ClaimStatusResponse277 {
  if (ts.type !== '277') throw new Error(`Expected a 277, got ${ts.type}`);

  const r: ClaimStatusResponse277 = {
    transactionControlNumber: ts.controlNumber,
    traceNumbers: [],
    payer: { name: '' },
    subscriber: { person: { lastName: '', firstName: '' } },
    claims: [],
  };

  type Loop = 'none' | 'payer' | 'provider' | 'subscriber' | 'dependent';
  let loop: Loop = 'none';
  let claim: ClaimStatusRecord | null = null;
  let line: { procedureCode?: string; statuses: ClaimStatus[] } | null = null;

  const openClaim = (): ClaimStatusRecord => {
    const c: ClaimStatusRecord = { statuses: [], serviceLines: [] };
    r.claims.push(c);
    return c;
  };

  for (const s of ts.segments) {
    switch (s.id) {
      case 'HL': {
        const level = s.el(3);
        loop = level === '20' ? 'payer' : level === '21' ? 'provider' : level === '22' ? 'subscriber' : level === '23' ? 'dependent' : 'none';
        if (loop === 'subscriber' || loop === 'dependent') {
          claim = openClaim();
          line = null;
        }
        break;
      }

      case 'NM1':
        if (loop === 'payer' && s.el(1) === 'PR') {
          r.payer = { name: s.el(3) };
        } else if (loop === 'subscriber' && s.el(1) === 'IL') {
          r.subscriber.person = nm1Person(s);
          if (s.el(8) === 'MI') r.subscriber.memberId = s.el(9);
        }
        break;

      case 'TRN':
        r.traceNumbers.push(s.el(2));
        break;

      case 'REF':
        if (!claim) break;
        if (s.el(1) === 'EJ') claim.patientControlNumber = s.el(2);
        else if (s.el(1) === '1K') claim.payerClaimControlNumber = s.el(2);
        break;

      case 'SVC':
        line = { procedureCode: s.comp(1, 2) || undefined, statuses: [] };
        claim?.serviceLines.push(line);
        break;

      case 'STC': {
        const status = parseStc(s);
        if (line) line.statuses.push(status);
        else if (claim) claim.statuses.push(status);
        break;
      }
    }
  }

  return r;
}

function parseStc(s: Segment): ClaimStatus {
  const [categoryCode = '', statusCode = '', entityCode = ''] = s.comps(1);
  return {
    categoryCode,
    statusCode,
    entityCode: entityCode || undefined,
    effectiveDate: s.el(2) ? isoFromD8(s.el(2)) : undefined,
    totalChargeCents: s.has(4) ? toCents(s.el(4)) : undefined,
    totalPaidCents: s.has(5) ? toCents(s.el(5)) : undefined,
    patientResponsibilityCents: s.has(6) ? toCents(s.el(6)) : undefined,
    freeFormMessage: s.el(12) || undefined,
  };
}

function isoFromD8(v: string): string {
  return v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
}

function nm1Person(s: Segment): Person {
  return { lastName: s.el(3), firstName: s.el(4), middleName: s.el(5) || undefined, suffix: s.el(7) || undefined };
}
