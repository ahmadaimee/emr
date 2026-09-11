import { toCents } from '../envelope';
import type { Segment } from '../segment';
import type { TransactionSet } from '../tokenizer';
import type { ClaimAcknowledgment277CA, ClaimStatus } from '../types';

/**
 * 277CA parser — 005010X214.
 *
 * Unlike a 277 in reply to a 276, this arrives unsolicited after an 837 batch and has
 * no subscriber/dependent split: one HL loop per claim, with HL03 literally `PT`
 * rather than a numeric level code. TRN02 on that loop is OUR OWN patient control
 * number (the claim submitter's trace ID) — the payer's own control number, when it
 * assigns one this early, rides in REF*1K instead.
 */
export function parse277CA(ts: TransactionSet): ClaimAcknowledgment277CA {
  if (ts.type !== '277') throw new Error(`Expected a 277 (CA), got ${ts.type}`);

  const r: ClaimAcknowledgment277CA = {
    transactionControlNumber: ts.controlNumber,
    payer: { name: '' },
    submitter: { name: '' },
    claims: [],
  };

  type Loop = 'none' | 'payer' | 'submitter' | 'provider' | 'claim';
  let loop: Loop = 'none';
  let claim: ClaimAcknowledgment277CA['claims'][number] | null = null;

  for (const s of ts.segments) {
    switch (s.id) {
      case 'HL': {
        const level = s.el(3);
        if (level === 'PT') {
          loop = 'claim';
          claim = { patientControlNumber: '', status: { categoryCode: '', statusCode: '' } };
          r.claims.push(claim);
        } else {
          loop = level === '20' ? 'payer' : level === '21' ? 'submitter' : level === '19' ? 'provider' : 'none';
          claim = null;
        }
        break;
      }

      case 'NM1':
        if (loop === 'payer') r.payer.name = s.el(3);
        else if (loop === 'submitter') r.submitter.name = s.el(3);
        break;

      case 'TRN':
        if (loop === 'claim' && claim) claim.patientControlNumber = s.el(2);
        break;

      case 'REF':
        if (loop === 'claim' && claim && s.el(1) === '1K') claim.payerClaimControlNumber = s.el(2);
        break;

      case 'STC':
        if (loop === 'claim' && claim) claim.status = parseStc(s);
        break;
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
  };
}

function isoFromD8(v: string): string {
  return v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
}
