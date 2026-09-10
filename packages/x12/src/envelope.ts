import { seg, Segment } from './segment';

/**
 * Interchange and functional-group envelopes.
 *
 * ISA is the one fixed-width segment in X12: every element must be padded to its exact
 * width or the receiver cannot locate the delimiters. Everything here is deliberately
 * strict about that.
 */

export type UsageIndicator = 'T' | 'P';

/** GS01 functional identifier codes for the transactions we exchange. */
export const FUNCTIONAL_IDS = {
  '837': 'HC', // health care claim
  '835': 'HP', // health care claim payment/advice
  '270': 'HS', // eligibility inquiry
  '271': 'HB', // eligibility response
  '276': 'HR', // claim status request
  '277': 'HN', // claim status notification
  '278': 'HI', // services review
  '999': 'FA', // implementation acknowledgment
} as const;

/** ST03 / GS08 implementation convention references (5010). */
export const IMPLEMENTATIONS = {
  '837P': '005010X222A1',
  '837I': '005010X223A2',
  '835': '005010X221A1',
  '270': '005010X279A1',
  '271': '005010X279A1',
  '276': '005010X212',
  '277': '005010X212',
  '277CA': '005010X214',
  '278': '005010X217',
  '999': '005010X231A1',
} as const;

export interface TradingPartner {
  /** ISA05/ISA07 qualifier: ZZ mutually defined, 30 US federal tax ID, 01 DUNS. */
  qualifier: string;
  /** ISA06/ISA08 — padded to 15. */
  id: string;
  /** GS02/GS03 application code. Often the same as the ISA ID. */
  applicationId?: string;
}

export interface InterchangeOptions {
  sender: TradingPartner;
  receiver: TradingPartner;
  controlNumber: number;
  usage: UsageIndicator;
  /** Defaults to now. Injectable for deterministic tests. */
  timestamp?: Date;
  /** ISA14 acknowledgment requested. 0 = no, 1 = yes (TA1). */
  ackRequested?: boolean;
}

export interface FunctionalGroupOptions {
  functionalId: string;
  controlNumber: number;
  version: string;
  sender: TradingPartner;
  receiver: TradingPartner;
  timestamp?: Date;
}

const pad = (v: string, width: number): string => v.padEnd(width, ' ').slice(0, width);
const num = (v: number, width: number): string => String(v).padStart(width, '0').slice(-width);

export function isaSegment(o: InterchangeOptions): Segment {
  const ts = o.timestamp ?? new Date();
  return new Segment('ISA', [
    '00', // ISA01 authorization qualifier
    pad('', 10), // ISA02 authorization information
    '00', // ISA03 security qualifier
    pad('', 10), // ISA04 security information
    pad(o.sender.qualifier, 2), // ISA05
    pad(o.sender.id, 15), // ISA06
    pad(o.receiver.qualifier, 2), // ISA07
    pad(o.receiver.id, 15), // ISA08
    yymmdd(ts), // ISA09
    hhmm(ts), // ISA10
    '^', // ISA11 repetition separator (5010)
    '00501', // ISA12 version
    num(o.controlNumber, 9), // ISA13
    o.ackRequested ? '1' : '0', // ISA14
    o.usage, // ISA15
    ':', // ISA16 component separator
  ]);
}

export function ieaSegment(groupCount: number, controlNumber: number): Segment {
  return seg('IEA', groupCount, num(controlNumber, 9));
}

export function gsSegment(o: FunctionalGroupOptions): Segment {
  const ts = o.timestamp ?? new Date();
  return seg(
    'GS',
    o.functionalId,
    o.sender.applicationId ?? o.sender.id.trim(),
    o.receiver.applicationId ?? o.receiver.id.trim(),
    ccyymmdd(ts),
    hhmm(ts),
    o.controlNumber,
    'X',
    o.version,
  );
}

export function geSegment(transactionCount: number, controlNumber: number): Segment {
  return seg('GE', transactionCount, controlNumber);
}

export function stSegment(type: string, controlNumber: number, implementation: string): Segment {
  return seg('ST', type, num(controlNumber, 4), implementation);
}

/** SE01 is the count of segments INCLUDING ST and SE. */
export function seSegment(segmentCountIncludingStSe: number, controlNumber: number): Segment {
  return seg('SE', segmentCountIncludingStSe, num(controlNumber, 4));
}

/**
 * Wrap one or more transaction-set bodies (each excluding ST/SE) in a full envelope.
 * Returns the complete segment list ISA..IEA.
 */
export function buildInterchange(
  interchange: InterchangeOptions,
  group: Omit<FunctionalGroupOptions, 'sender' | 'receiver' | 'timestamp'>,
  transactions: Array<{ type: string; implementation: string; controlNumber: number; body: Segment[] }>,
): Segment[] {
  const ts = interchange.timestamp ?? new Date();
  const out: Segment[] = [
    isaSegment({ ...interchange, timestamp: ts }),
    gsSegment({ ...group, sender: interchange.sender, receiver: interchange.receiver, timestamp: ts }),
  ];
  for (const t of transactions) {
    out.push(stSegment(t.type, t.controlNumber, t.implementation));
    out.push(...t.body);
    out.push(seSegment(t.body.length + 2, t.controlNumber));
  }
  out.push(geSegment(transactions.length, group.controlNumber));
  out.push(ieaSegment(1, interchange.controlNumber));
  return out;
}

// --- date helpers ------------------------------------------------------------

export function ccyymmdd(d: Date): string {
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}`;
}
export function yymmdd(d: Date): string {
  return ccyymmdd(d).slice(2);
}
export function hhmm(d: Date): string {
  return `${two(d.getUTCHours())}${two(d.getUTCMinutes())}`;
}
/** ISO date (YYYY-MM-DD) → CCYYMMDD. */
export function isoToCcyymmdd(iso: string): string {
  return iso.replace(/-/g, '').slice(0, 8);
}
/** CCYYMMDD → ISO date. */
export function ccyymmddToIso(v: string): string {
  return v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
}
const two = (n: number) => String(n).padStart(2, '0');

/** Cents → X12 decimal amount. X12 does not want thousands separators or currency symbols. */
export function amount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return rem === 0 ? `${sign}${dollars}` : `${sign}${dollars}.${String(rem).padStart(2, '0')}`;
}

/** X12 decimal amount → cents, exactly. */
export function toCents(v: string): number {
  if (v === '' || v === undefined) return 0;
  const neg = v.startsWith('-');
  const [whole = '0', frac = ''] = v.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return neg ? -cents : cents;
}
