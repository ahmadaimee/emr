import { describe, expect, it } from 'vitest';
import { canonicalize } from '../canonical';
import { computeHash } from '../chain';

describe('canonical JSON', () => {
  it('sorts keys deeply and drops undefined', () => {
    expect(canonicalize({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[3,{"y":2,"z":1}]},"b":1}');
  });
  it('is stable across key insertion order', () => {
    const a = canonicalize({ x: 1, y: 2 });
    const b = canonicalize({ y: 2, x: 1 });
    expect(a).toBe(b);
  });
});

describe('hash chain', () => {
  const row = {
    chainVersion: 1,
    orgId: 'org',
    sequence: '42',
    occurredAt: '2026-09-01 12:00:00+00',
    actorUserId: 'u1',
    actorType: 'user',
    action: 'read',
    resourceType: 'patient',
    resourceId: 'p1',
    patientId: 'p1',
    changes: null,
    context: null,
    previousHash: 'abc',
  };

  it('is deterministic and keyed', () => {
    const h1 = computeHash(row, 'secret');
    expect(computeHash(row, 'secret')).toBe(h1);
    expect(computeHash(row, 'other')).not.toBe(h1);
  });

  it('changes when any covered field changes', () => {
    const h = computeHash(row, 'secret');
    expect(computeHash({ ...row, action: 'update' }, 'secret')).not.toBe(h);
    expect(computeHash({ ...row, previousHash: 'abd' }, 'secret')).not.toBe(h);
    expect(computeHash({ ...row, sequence: '43' }, 'secret')).not.toBe(h);
  });
});
