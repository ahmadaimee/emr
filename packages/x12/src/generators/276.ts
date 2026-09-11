import { amount, ccyymmdd, hhmm, isoToCcyymmdd } from '../envelope';
import { seg, type Segment } from '../segment';
import type { ClaimStatusInquiry276 } from '../types';

/**
 * 276 generator — 005010X212. Produces the transaction-set body for one claim status
 * inquiry.
 *
 * Mirrors the loop shape of `generate270` (payer / provider / subscriber / dependent)
 * rather than the full five-level X212 hierarchy some companion guides show — Grove
 * doesn't submit through a separate "service provider" loop, so folding that into the
 * information-receiver loop, exactly as `generate270` already does, keeps the two
 * inquiry transactions structurally consistent.
 */
export function generate276(q: ClaimStatusInquiry276, opts: { timestamp?: Date } = {}): Segment[] {
  const ts = opts.timestamp ?? new Date();
  const out: Segment[] = [];

  // BHT — 0010 = claim status inquiry, 13 = request
  out.push(seg('BHT', '0010', '13', q.traceNumber, ccyymmdd(ts), hhmm(ts)));

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

  const claimStatusSegments = (): Segment[] => {
    const c = q.claim;
    const seglist: Segment[] = [
      seg('TRN', '1', q.traceNumber),
      seg('REF', 'EJ', c.patientControlNumber),
    ];
    if (c.totalChargeCents !== undefined) seglist.push(seg('AMT', 'T3', amount(c.totalChargeCents)));
    seglist.push(
      c.serviceDateThrough
        ? seg('DTP', '472', 'RD8', `${isoToCcyymmdd(c.serviceDateFrom)}-${isoToCcyymmdd(c.serviceDateThrough)}`)
        : seg('DTP', '472', 'D8', isoToCcyymmdd(c.serviceDateFrom)),
    );
    return seglist;
  };

  // 2000C Subscriber
  const hasDependent = Boolean(q.dependent);
  out.push(seg('HL', 3, 2, '22', hasDependent ? '1' : '0'));
  const s = q.subscriber;
  out.push(seg('NM1', 'IL', '1', s.person.lastName, s.person.firstName, s.person.middleName ?? '', '', s.person.suffix ?? '', 'MI', s.memberId));
  if (!hasDependent) out.push(...claimStatusSegments());

  // 2000D Dependent
  if (q.dependent) {
    const d = q.dependent;
    out.push(seg('HL', 4, 3, '23', '0'));
    out.push(seg('NM1', 'QC', '1', d.person.lastName, d.person.firstName, d.person.middleName ?? '', '', d.person.suffix ?? ''));
    out.push(...claimStatusSegments());
  }

  return out;
}
