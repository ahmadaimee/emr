/**
 * X12 syntax layer: delimiters and segments.
 *
 * A segment is an ID plus a list of elements. Elements may contain components (split
 * by the component separator) and repetitions (split by the repetition separator). We
 * keep elements as raw strings and split components on demand, because most elements
 * are simple and most consumers want the raw value.
 */

export interface Delimiters {
  element: string;
  component: string;
  repetition: string;
  segment: string;
}

/** The 5010 defaults. ISA declares the real ones; these are used when generating. */
export const DEFAULT_DELIMITERS: Delimiters = {
  element: '*',
  component: ':',
  repetition: '^',
  segment: '~',
};

export class Segment {
  constructor(
    public readonly id: string,
    /** elements[0] is the first element AFTER the segment ID (i.e. XX01). */
    public readonly elements: readonly string[],
    private readonly delimiters: Delimiters = DEFAULT_DELIMITERS,
  ) {}

  /** Element by 1-based position, as written in the implementation guides (e.g. CLM02). */
  el(position: number): string {
    return this.elements[position - 1] ?? '';
  }

  /** Component by 1-based element and 1-based component position (e.g. SV101-2). */
  comp(position: number, component: number): string {
    const raw = this.el(position);
    if (raw === '') return '';
    return raw.split(this.delimiters.component)[component - 1] ?? '';
  }

  /** All components of an element. */
  comps(position: number): string[] {
    const raw = this.el(position);
    return raw === '' ? [] : raw.split(this.delimiters.component);
  }

  /** Repetitions of an element. */
  reps(position: number): string[] {
    const raw = this.el(position);
    return raw === '' ? [] : raw.split(this.delimiters.repetition);
  }

  has(position: number): boolean {
    return this.el(position) !== '';
  }

  get length(): number {
    return this.elements.length;
  }

  toString(): string {
    return [this.id, ...trimTrailingEmpty(this.elements)].join(this.delimiters.element);
  }
}

/** Build a segment from values. Nested arrays become composites. */
export function seg(
  id: string,
  ...values: Array<string | number | null | undefined | Array<string | number | null | undefined>>
): Segment {
  const elements = values.map((v) => {
    if (Array.isArray(v)) {
      return trimTrailingEmpty(v.map(stringify)).join(DEFAULT_DELIMITERS.component);
    }
    return stringify(v);
  });
  return new Segment(id, trimTrailingEmpty(elements));
}

function stringify(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function trimTrailingEmpty(values: readonly string[]): string[] {
  const out = [...values];
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out;
}
