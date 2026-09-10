import { ccyymmdd, hhmm, isoToCcyymmdd } from '../envelope';
import { seg, type Segment } from '../segment';
import type { EligibilityInquiry270 } from '../types';

/**
 * 270 generator — 005010X279A1. Produces the transaction-set body for one inquiry.
 *
 * Batch eligibility is many 270 transaction sets in one interchange, not one giant
 * 270 — each ST/SE is independent, so a single bad member does not reject the batch.
 */
export function generate270(q: EligibilityInquiry270, opts: { timestamp?: Date } = {}): Segment[] {
  const ts = opts.timestamp ?? new Date();
  const out: Segment[] = [];

  // BHT — 0022 = information source/receiver hierarchy, 13 = request
  out.push(seg('BHT', '0022', '13', q.traceNumber, ccyymmdd(ts), hhmm(ts)));

  // 2000A Information source (payer)
  out.push(seg('HL', 1, '', '20', '1'));
  out.push(seg('NM1', 'PR', '2', q.payer.name, '', '', '', '', 'PI', q.payer.id));

  // 2000B Information receiver (provider)
  out.push(seg('HL', 2, 1, '21', '1'));
  if (q.provider.isPerson && q.provider.person) {
    const p = q.provider.person;
    out.push(seg('NM1', '1P', '1', p.lastName, p.firstName, p.middleName ?? '', '', p.suffix ?? '', 'XX', q.provider.npi));
  } else {
    out.push(seg('NM1', '1P', '2', q.provider.organization?.name ?? '', '', '', '', '', 'XX', q.provider.npi));
  }

  // 2000C Subscriber
  const hasDependent = Boolean(q.dependent);
  out.push(seg('HL', 3, 2, '22', hasDependent ? '1' : '0'));
  out.push(seg('TRN', '1', q.traceNumber, `9${q.provider.npi}`));
  const s = q.subscriber;
  out.push(seg('NM1', 'IL', '1', s.person.lastName, s.person.firstName, s.person.middleName ?? '', '', s.person.suffix ?? '', 'MI', s.memberId));
  if (!hasDependent) {
    if (s.dateOfBirth) out.push(seg('DMG', 'D8', isoToCcyymmdd(s.dateOfBirth), s.sex ?? ''));
    out.push(seg('DTP', '291', 'D8', isoToCcyymmdd(q.serviceDate)));
    for (const stc of q.serviceTypeCodes) out.push(seg('EQ', stc));
  }

  // 2000D Dependent
  if (q.dependent) {
    const d = q.dependent;
    out.push(seg('HL', 4, 3, '23', '0'));
    out.push(seg('TRN', '1', q.traceNumber, `9${q.provider.npi}`));
    out.push(seg('NM1', '03', '1', d.person.lastName, d.person.firstName, d.person.middleName ?? '', '', d.person.suffix ?? ''));
    out.push(seg('DMG', 'D8', isoToCcyymmdd(d.dateOfBirth), d.sex ?? ''));
    if (d.relationship) out.push(seg('INS', 'N', d.relationship));
    out.push(seg('DTP', '291', 'D8', isoToCcyymmdd(q.serviceDate)));
    for (const stc of q.serviceTypeCodes) out.push(seg('EQ', stc));
  }

  return out;
}
