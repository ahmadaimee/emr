import { DEFAULT_DELIMITERS, Segment, type Delimiters } from './segment';

export interface X12Document {
  delimiters: Delimiters;
  segments: Segment[];
}

export class X12SyntaxError extends Error {
  constructor(
    message: string,
    public readonly position?: number,
  ) {
    super(message);
    this.name = 'X12SyntaxError';
  }
}

/**
 * Tokenize a raw X12 interchange into segments.
 *
 * The ISA segment is fixed-width (106 characters) and DECLARES the delimiters used by
 * the rest of the document:
 *   - the element separator is the character at index 3
 *   - the repetition separator is ISA11 (index 82)
 *   - the component separator is ISA16 (index 104)
 *   - the segment terminator is the character at index 105
 *
 * Reading them from the ISA rather than assuming `*`/`:`/`~` is what makes this work
 * against every payer and clearinghouse, several of which use unusual choices.
 */
export function tokenize(raw: string): X12Document {
  const input = raw.replace(/^﻿/, ''); // strip BOM

  if (!input.startsWith('ISA')) {
    throw new X12SyntaxError('Interchange must begin with ISA', 0);
  }
  if (input.length < 106) {
    throw new X12SyntaxError('ISA segment is shorter than 106 characters', 0);
  }

  const delimiters: Delimiters = {
    element: input.charAt(3),
    repetition: input.charAt(82),
    component: input.charAt(104),
    segment: input.charAt(105),
  };

  if (delimiters.element === delimiters.segment || delimiters.element === delimiters.component) {
    throw new X12SyntaxError('ISA declares conflicting delimiters', 0);
  }

  const segments: Segment[] = [];
  let cursor = 0;
  const len = input.length;

  while (cursor < len) {
    const end = input.indexOf(delimiters.segment, cursor);
    const slice = end === -1 ? input.slice(cursor) : input.slice(cursor, end);
    cursor = end === -1 ? len : end + 1;

    // Tolerate CR/LF between segments; many trading partners emit them.
    const text = slice.replace(/^[\r\n\s]+|[\r\n\s]+$/g, '');
    if (text === '') continue;

    const parts = text.split(delimiters.element);
    const id = parts[0];
    if (!id) throw new X12SyntaxError('Empty segment identifier', cursor);
    segments.push(new Segment(id, parts.slice(1), delimiters));
  }

  const last = segments[segments.length - 1];
  if (!last || last.id !== 'IEA') {
    throw new X12SyntaxError('Interchange does not end with IEA');
  }

  return { delimiters, segments };
}

/**
 * Split a document into its transaction sets (ST..SE), preserving envelope context.
 * A single interchange commonly carries many 835s or many 271s.
 */
export interface TransactionSet {
  /** ST01 — 837, 835, 271, ... */
  type: string;
  /** ST02 */
  controlNumber: string;
  /** ST03 implementation convention reference, e.g. 005010X222A1 */
  implementation: string;
  segments: Segment[];
  /** GS08 from the enclosing functional group. */
  groupVersion: string;
  groupControlNumber: string;
  interchangeControlNumber: string;
  senderId: string;
  receiverId: string;
}

export function splitTransactionSets(doc: X12Document): TransactionSet[] {
  const sets: TransactionSet[] = [];
  let isa: Segment | undefined;
  let gs: Segment | undefined;
  let current: Segment[] | null = null;
  let st: Segment | undefined;

  for (const s of doc.segments) {
    switch (s.id) {
      case 'ISA':
        isa = s;
        break;
      case 'GS':
        gs = s;
        break;
      case 'ST':
        st = s;
        current = [s];
        break;
      case 'SE':
        if (current && st) {
          current.push(s);
          const declared = Number(s.el(1));
          if (declared !== current.length) {
            throw new X12SyntaxError(
              `SE01 declares ${declared} segments but transaction set ${st.el(2)} has ${current.length}`,
            );
          }
          sets.push({
            type: st.el(1),
            controlNumber: st.el(2),
            implementation: st.el(3),
            segments: current,
            groupVersion: gs?.el(8) ?? '',
            groupControlNumber: gs?.el(6) ?? '',
            interchangeControlNumber: isa?.el(13).trim() ?? '',
            senderId: isa?.el(6).trim() ?? '',
            receiverId: isa?.el(8).trim() ?? '',
          });
        }
        current = null;
        st = undefined;
        break;
      default:
        if (current) current.push(s);
    }
  }

  return sets;
}

/** Serialize segments back to an X12 string using the given delimiters. */
export function serialize(segments: readonly Segment[], delimiters: Delimiters = DEFAULT_DELIMITERS): string {
  return segments
    .map((s) => {
      const parts = [s.id, ...s.elements];
      // Re-join with the target delimiters; composites were built with DEFAULT
      // component separator by seg(), so translate if the target differs.
      const els = parts.map((p, i) =>
        i === 0 || delimiters.component === DEFAULT_DELIMITERS.component
          ? p
          : p.split(DEFAULT_DELIMITERS.component).join(delimiters.component),
      );
      return els.join(delimiters.element) + delimiters.segment;
    })
    .join('');
}
