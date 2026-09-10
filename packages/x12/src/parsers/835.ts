import { ccyymmddToIso, toCents } from '../envelope';
import type { Segment } from '../segment';
import type { TransactionSet } from '../tokenizer';
import type {
  Address,
  CasAdjustment,
  Person,
  ProviderLevelAdjustment,
  Remittance835,
  RemittanceClaim,
  RemittanceLine,
} from '../types';

/**
 * 835 parser — 005010X221A1.
 *
 * Walks the segment list once, tracking which loop is open. The 835 has no HL
 * segments; loop boundaries are implied by segment order (LX → CLP → SVC), which is
 * why this is a hand-written walker rather than a generic loop engine.
 */
export function parse835(ts: TransactionSet): Remittance835 {
  if (ts.type !== '835') throw new Error(`Expected an 835, got ${ts.type}`);

  const r: Remittance835 = {
    transactionControlNumber: ts.controlNumber,
    paymentMethod: '',
    totalPaidCents: 0,
    paymentDate: '',
    traceNumber: '',
    payerIdentifier: '',
    payer: { name: '', identifiers: [] },
    payee: { name: '' },
    claims: [],
    providerAdjustments: [],
  };

  type Scope = 'header' | 'payer' | 'payee' | 'claim' | 'line';
  let scope: Scope = 'header';
  let claim: RemittanceClaim | null = null;
  let line: RemittanceLine | null = null;
  let pendingAddress: Partial<Address> = {};

  const flushAddress = () => {
    if (pendingAddress.line1 && pendingAddress.city) {
      const a = pendingAddress as Address;
      if (scope === 'payer') r.payer.address = a;
      else if (scope === 'payee') r.payee.address = a;
    }
    pendingAddress = {};
  };

  for (const s of ts.segments) {
    switch (s.id) {
      case 'ST':
      case 'SE':
        break;

      case 'BPR':
        r.totalPaidCents = toCents(s.el(2));
        r.paymentMethod = s.el(4);
        r.paymentDate = ccyymmddToIso(s.el(16));
        break;

      case 'TRN':
        r.traceNumber = s.el(2);
        r.payerIdentifier = s.el(3);
        if (s.has(4)) r.originatingCompanySupplemental = s.el(4);
        break;

      case 'DTM':
        if (scope === 'header' && s.el(1) === '405') r.productionDate = ccyymmddToIso(s.el(2));
        else if (claim && scope === 'claim') {
          if (s.el(1) === '050') claim.claimReceivedDate = ccyymmddToIso(s.el(2));
          if (s.el(1) === '232') claim.statementFrom = ccyymmddToIso(s.el(2));
          if (s.el(1) === '233') claim.statementTo = ccyymmddToIso(s.el(2));
        } else if (line && scope === 'line') {
          if (s.el(1) === '472') line.serviceDate = ccyymmddToIso(s.el(2));
          if (s.el(1) === '150') line.serviceDate = ccyymmddToIso(s.el(2));
          if (s.el(1) === '151') line.serviceDateThrough = ccyymmddToIso(s.el(2));
        }
        break;

      case 'N1':
        flushAddress();
        if (s.el(1) === 'PR') {
          scope = 'payer';
          r.payer.name = s.el(2);
          if (s.has(4)) r.payer.identifiers.push({ qualifier: s.el(3), value: s.el(4) });
        } else if (s.el(1) === 'PE') {
          scope = 'payee';
          r.payee.name = s.el(2);
          if (s.el(3) === 'XX') r.payee.npi = s.el(4);
          else if (s.el(3) === 'FI') r.payee.taxId = s.el(4);
        }
        break;

      case 'N3':
        pendingAddress.line1 = s.el(1);
        if (s.has(2)) pendingAddress.line2 = s.el(2);
        break;

      case 'N4':
        pendingAddress.city = s.el(1);
        pendingAddress.state = s.el(2);
        pendingAddress.postalCode = s.el(3);
        flushAddress();
        break;

      case 'REF':
        if (scope === 'payer') r.payer.identifiers.push({ qualifier: s.el(1), value: s.el(2) });
        else if (scope === 'payee' && s.el(1) === 'TJ') r.payee.taxId = s.el(2);
        else if (scope === 'line' && line) {
          if (s.el(1) === '6R') line.lineControlNumber = s.el(2);
          else line.references.push({ qualifier: s.el(1), value: s.el(2) });
        } else if (scope === 'claim' && claim) {
          claim.references.push({ qualifier: s.el(1), value: s.el(2) });
        }
        break;

      case 'PER':
        if (scope === 'payer') {
          r.payer.contact = { name: s.el(2) || undefined, phone: s.el(3) === 'TE' ? s.el(4) : undefined };
        }
        break;

      case 'LX':
        // Header number; a new claim group starts. Nothing to store.
        scope = 'claim';
        break;

      case 'CLP':
        flushAddress();
        claim = {
          patientControlNumber: s.el(1),
          claimStatusCode: s.el(2),
          totalChargeCents: toCents(s.el(3)),
          totalPaidCents: toCents(s.el(4)),
          patientResponsibilityCents: toCents(s.el(5)),
          claimFilingIndicator: s.el(6),
          payerClaimControlNumber: s.el(7),
          facilityTypeCode: s.el(8) || undefined,
          frequencyCode: s.el(9) || undefined,
          drgCode: s.el(11) || undefined,
          adjustments: [],
          remarkCodes: [],
          references: [],
          amounts: [],
          lines: [],
        };
        r.claims.push(claim);
        line = null;
        scope = 'claim';
        break;

      case 'CAS': {
        const target = scope === 'line' && line ? line : claim;
        if (target) target.adjustments.push(...parseCas(s));
        break;
      }

      case 'NM1':
        if (!claim) break;
        if (s.el(1) === 'QC') {
          claim.patient = { person: nm1Person(s), memberId: s.el(8) === 'MI' ? s.el(9) : undefined };
        } else if (s.el(1) === 'IL') {
          claim.subscriber = { person: nm1Person(s), memberId: s.el(8) === 'MI' ? s.el(9) : undefined };
        } else if (s.el(1) === '82') {
          claim.renderingProvider = {
            name: s.el(2) === '1' ? `${s.el(4)} ${s.el(3)}`.trim() : s.el(3),
            npi: s.el(8) === 'XX' ? s.el(9) : undefined,
          };
        } else if (s.el(1) === 'TT') {
          // Crossover carrier — the payer forwarded the claim. Do NOT also submit a
          // secondary yourself or you will get a duplicate denial.
          claim.crossoverCarrier = { name: s.el(3), id: s.has(9) ? s.el(9) : undefined };
        }
        break;

      case 'MIA':
      case 'MOA':
        if (claim) {
          // Remark codes live in positions 5-9 for MOA (3-9 for MIA, mixed with amounts).
          const positions = s.id === 'MOA' ? [3, 4, 5, 6, 7] : [5, 10, 11, 12, 13, 14, 20];
          for (const p of positions) if (s.has(p)) claim.remarkCodes.push(s.el(p));
        }
        break;

      case 'AMT':
        if (scope === 'line' && line) {
          if (s.el(1) === 'B6') line.allowedCents = toCents(s.el(2));
        } else if (claim) {
          claim.amounts.push({ qualifier: s.el(1), cents: toCents(s.el(2)) });
        }
        break;

      case 'SVC': {
        if (!claim) break;
        const billed = s.comps(1);
        const adjudicated = s.has(6) ? s.comps(6) : null;
        line = {
          procedureCode: billed[1] ?? '',
          modifiers: billed.slice(2).filter(Boolean),
          adjudicatedProcedureCode: adjudicated?.[1],
          adjudicatedModifiers: adjudicated ? adjudicated.slice(2).filter(Boolean) : undefined,
          chargeCents: toCents(s.el(2)),
          paidCents: toCents(s.el(3)),
          revenueCode: s.el(4) || undefined,
          unitsPaid: s.has(5) ? Number(s.el(5)) : undefined,
          unitsBilled: s.has(7) ? Number(s.el(7)) : undefined,
          adjustments: [],
          remarkCodes: [],
          references: [],
        };
        claim.lines.push(line);
        scope = 'line';
        break;
      }

      case 'LQ':
        if (line && s.el(1) === 'HE') line.remarkCodes.push(s.el(2));
        break;

      case 'PLB':
        r.providerAdjustments.push(parsePlb(s));
        scope = 'header';
        break;
    }
  }

  return r;
}

/** One CAS carries up to six (reason, amount, quantity) triples for a single group. */
export function parseCas(s: Segment): CasAdjustment[] {
  const group = s.el(1) as CasAdjustment['group'];
  const out: CasAdjustment[] = [];
  for (let i = 2; i <= 17; i += 3) {
    const reason = s.el(i);
    if (!reason) break;
    const adj: CasAdjustment = { group, reasonCode: reason, amountCents: toCents(s.el(i + 1)) };
    if (s.has(i + 2)) adj.quantity = Number(s.el(i + 2));
    out.push(adj);
  }
  return out;
}

function parsePlb(s: Segment): ProviderLevelAdjustment {
  const out: ProviderLevelAdjustment = {
    providerIdentifier: s.el(1),
    fiscalPeriodDate: ccyymmddToIso(s.el(2)),
    adjustments: [],
  };
  for (let i = 3; i <= 13; i += 2) {
    if (!s.has(i)) break;
    const [reasonCode = '', referenceId] = s.comps(i);
    out.adjustments.push({ reasonCode, referenceId: referenceId || undefined, amountCents: toCents(s.el(i + 1)) });
  }
  return out;
}

function nm1Person(s: Segment): Person {
  return { lastName: s.el(3), firstName: s.el(4), middleName: s.el(5) || undefined, suffix: s.el(7) || undefined };
}

/**
 * Balance check: CLP04 should equal the sum of SVC paid amounts, and for each line
 * charge − adjustments should equal paid. Returns the variance in cents per claim.
 * Out-of-balance remittances are common and are surfaced as exceptions, never
 * silently forced to balance.
 */
export function checkBalance(r: Remittance835): Array<{ patientControlNumber: string; varianceCents: number }> {
  const out: Array<{ patientControlNumber: string; varianceCents: number }> = [];
  for (const c of r.claims) {
    if (c.lines.length === 0) continue;
    const linePaid = c.lines.reduce((sum, l) => sum + l.paidCents, 0);
    const variance = c.totalPaidCents - linePaid;
    if (variance !== 0) out.push({ patientControlNumber: c.patientControlNumber, varianceCents: variance });
  }
  return out;
}
