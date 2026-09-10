/**
 * Deterministic JSON serialisation for hashing.
 *
 * Follows the shape of RFC 8785 (JCS): object keys sorted by code point, no
 * insignificant whitespace, numbers in their shortest round-trip form, and
 * `undefined` dropped. The canonicalisation is versioned (`CHAIN_VERSION`) and stored
 * on every row, because if this ever changes, every prior hash becomes unverifiable —
 * which is the same as having no audit history at all.
 */
export const CHAIN_VERSION = 1;

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    return value;
  }
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value instanceof Date) return value.toISOString();
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] === undefined) continue;
    out[key] = sortDeep(obj[key]);
  }
  return out;
}
