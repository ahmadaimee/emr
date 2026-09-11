import type { TransactionSet } from '../tokenizer';
import type { FunctionalAcknowledgment999, TransactionSetAck } from '../types';

/**
 * 999 parser — 005010X231A1. A functional acknowledgement covers exactly one GS
 * functional group (AK1) and repeats AK2..AK5 once per transaction set inside it, so
 * one 999 can report on many 837s (or 835s, 270s, ...) from a single batch.
 *
 * This says nothing about whether a claim was ACCEPTED for adjudication — only
 * whether the interchange was syntactically valid X12. See `parse277CA` for that.
 */
export function parse999(ts: TransactionSet): FunctionalAcknowledgment999 {
  if (ts.type !== '999') throw new Error(`Expected a 999, got ${ts.type}`);

  const r: FunctionalAcknowledgment999 = {
    functionalIdCode: '',
    groupControlNumber: '',
    statusCode: '',
    transactionSets: [],
    accepted: false,
  };

  let current: TransactionSetAck | null = null;

  for (const s of ts.segments) {
    switch (s.id) {
      case 'AK1':
        r.functionalIdCode = s.el(1);
        r.groupControlNumber = s.el(2);
        break;

      case 'AK2':
        current = { transactionSetIdCode: s.el(1), transactionSetControlNumber: s.el(2), statusCode: '', errorCodes: [], segmentErrors: [] };
        r.transactionSets.push(current);
        break;

      case 'AK3':
        current?.segmentErrors.push({
          segmentIdCode: s.el(1) || undefined,
          segmentPosition: s.has(2) ? Number(s.el(2)) : undefined,
          errorCode: s.el(4),
        });
        break;

      case 'AK4':
        if (current && s.el(4)) current.errorCodes.push(s.el(4));
        break;

      case 'AK5':
        if (current) {
          current.statusCode = s.el(1);
          for (let i = 2; i <= 6; i++) if (s.has(i)) current.errorCodes.push(s.el(i));
        }
        break;

      case 'AK9':
        r.statusCode = s.el(1);
        break;
    }
  }

  r.accepted = r.statusCode === 'A' && r.transactionSets.every((t) => t.statusCode === 'A');
  return r;
}
