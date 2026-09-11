import { ccyymmdd, hhmm, isoToCcyymmdd } from '../envelope';
import { seg, type Segment } from '../segment';
import type { Person, Provider } from '../types';

/**
 * 278 generator — 005010X217, the Health Care Services Review Request.
 *
 * Grove sends the request; a payer's response is not auto-ingested (unlike 271/277/
 * 277CA/835) because most payers still answer prior-auth by phone or portal rather
 * than a returned 278 — see [[Prior Authorization]] for why that's tracked as a
 * manually-recorded decision instead of a parsed transaction. What matters here is
 * having a real, TR3-shaped request artifact for the payer dispute trail.
 *
 * Loop shape mirrors `generate276`/`generate270` (payer / requester / subscriber /
 * dependent) rather than the full six-level X217 hierarchy — the same simplification,
 * for the same reason: Grove doesn't submit through a separate UMO-vs-payer split or a
 * standalone service-line loop, so the clinical ask (UM, HI, service line) nests
 * directly under whichever of subscriber/dependent is the patient.
 */
export interface AuthorizationRequest278 {
  payer: { name: string; id: string };
  requester: Provider;
  subscriber: { person: Person; memberId: string; dateOfBirth?: string };
  dependent?: { person: Person; dateOfBirth?: string };
  /** UM01 — I initial, R renewal, S extension. */
  certificationTypeCode: string;
  /** UM02 — HS service, or AR admission review; HC is the common "health care services review" code. */
  serviceTypeCode: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  serviceDateFrom: string;
  serviceDateThrough?: string;
  traceNumber: string;
}

export function generate278(q: AuthorizationRequest278, opts: { timestamp?: Date } = {}): Segment[] {
  const ts = opts.timestamp ?? new Date();
  const out: Segment[] = [];

  // BHT — 0019 = information/service review, 13 = request
  out.push(seg('BHT', '0019', '13', q.traceNumber, ccyymmdd(ts), hhmm(ts)));

  // 2000A UMO / payer
  out.push(seg('HL', 1, '', '20', '1'));
  out.push(seg('NM1', 'X3', '2', q.payer.name, '', '', '', '', 'PI', q.payer.id));

  // 2000B Requester
  out.push(seg('HL', 2, 1, '21', '1'));
  if (q.requester.isPerson && q.requester.person) {
    const p = q.requester.person;
    out.push(seg('NM1', '1P', '1', p.lastName, p.firstName, p.middleName ?? '', '', p.suffix ?? '', 'XX', q.requester.npi));
  } else {
    out.push(seg('NM1', '1P', '2', q.requester.organization?.name ?? '', '', '', '', '', 'XX', q.requester.npi));
  }

  const clinicalSegments = (): Segment[] => {
    const seglist: Segment[] = [
      seg('TRN', '1', q.traceNumber),
      seg('UM', q.certificationTypeCode, q.serviceTypeCode),
      // ABK = principal diagnosis, ABF = other; no decimal point on the wire.
      seg('HI', ...q.diagnosisCodes.map((code, i) => [i === 0 ? 'ABK' : 'ABF', code.replace('.', '')])),
      q.serviceDateThrough
        ? seg('DTP', '472', 'RD8', `${isoToCcyymmdd(q.serviceDateFrom)}-${isoToCcyymmdd(q.serviceDateThrough)}`)
        : seg('DTP', '472', 'D8', isoToCcyymmdd(q.serviceDateFrom)),
    ];
    for (const code of q.procedureCodes) seglist.push(seg('SV1', ['HC', code]));
    return seglist;
  };

  // 2000C Subscriber
  const hasDependent = Boolean(q.dependent);
  out.push(seg('HL', 3, 2, '22', hasDependent ? '1' : '0'));
  const s = q.subscriber;
  out.push(seg('NM1', 'IL', '1', s.person.lastName, s.person.firstName, s.person.middleName ?? '', '', s.person.suffix ?? '', 'MI', s.memberId));
  if (!hasDependent) out.push(...clinicalSegments());

  // 2000D Dependent
  if (q.dependent) {
    const d = q.dependent;
    out.push(seg('HL', 4, 3, '23', '0'));
    out.push(seg('NM1', 'QC', '1', d.person.lastName, d.person.firstName, d.person.middleName ?? '', '', d.person.suffix ?? ''));
    out.push(...clinicalSegments());
  }

  return out;
}
