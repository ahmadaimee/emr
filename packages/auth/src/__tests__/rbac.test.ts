import { describe, expect, it } from 'vitest';
import { isKnownPermission } from '../permissions';
import { can, type Actor } from '../rbac';

const now = new Date('2026-09-01T12:00:00Z');

const biller: Actor = {
  userId: 'u1',
  orgId: 'org',
  grants: [
    { resource: 'claim', action: 'read' },
    { resource: 'claim', action: 'submit' },
    { resource: 'payment', action: 'apply', constraints: { maxPaymentAmountCents: 100000 } },
    { resource: 'patient', action: 'export' },
  ],
  practiceIds: ['p1'],
  mfaSatisfiedAt: new Date('2026-09-01T11:58:00Z'),
};

describe('permission registry', () => {
  it('recognises declared and wildcard permissions only', () => {
    expect(isKnownPermission('claim', 'submit')).toBe(true);
    expect(isKnownPermission('claim', '*')).toBe(true);
    expect(isKnownPermission('*', '*')).toBe(true);
    expect(isKnownPermission('claim', 'launch')).toBe(false);
    expect(isKnownPermission('spaceship', 'read')).toBe(false);
  });
});

describe('can', () => {
  it('grants within assigned practices', () => {
    expect(can(biller, 'claim:submit', { practiceId: 'p1' }, now).allowed).toBe(true);
  });

  it('denies outside assigned practices — minimum necessary', () => {
    expect(can(biller, 'claim:submit', { practiceId: 'p2' }, now)).toMatchObject({ allowed: false, reason: 'practice_out_of_scope' });
  });

  it('denies missing grants', () => {
    expect(can(biller, 'claim:void', { practiceId: 'p1' }, now)).toMatchObject({ allowed: false, reason: 'no_grant' });
  });

  it('honours an active elevation and records it', () => {
    const elevated: Actor = { ...biller, elevation: { id: 'el1', practiceIds: ['p2'], expiresAt: new Date('2026-09-01T18:00:00Z') } };
    expect(can(elevated, 'claim:read', { practiceId: 'p2' }, now)).toMatchObject({ allowed: true, viaElevation: 'el1' });
    expect(can(elevated, 'claim:read', { practiceId: 'p3' }, now)).toMatchObject({ allowed: false, reason: 'practice_out_of_scope' });
  });

  it('rejects an expired elevation', () => {
    const expired: Actor = { ...biller, elevation: { id: 'el1', practiceIds: '*', expiresAt: new Date('2026-09-01T11:00:00Z') } };
    expect(can(expired, 'claim:read', { practiceId: 'p2' }, now)).toMatchObject({ allowed: false, reason: 'elevation_expired' });
  });

  it('applies ABAC constraints on a grant', () => {
    expect(can(biller, 'payment:apply', { practiceId: 'p1', attributes: { paymentAmountCents: 50000 } }, now).allowed).toBe(true);
    expect(can(biller, 'payment:apply', { practiceId: 'p1', attributes: { paymentAmountCents: 250000 } }, now)).toMatchObject({ allowed: false, reason: 'constraint_failed' });
  });

  it('fails closed on unknown constraint keys', () => {
    const odd: Actor = { ...biller, grants: [{ resource: 'claim', action: 'read', constraints: { moonPhase: 'full' } }] };
    expect(can(odd, 'claim:read', { practiceId: 'p1' }, now)).toMatchObject({ allowed: false, reason: 'constraint_failed' });
  });

  it('requires fresh MFA for step-up actions', () => {
    expect(can(biller, 'patient:export', { practiceId: 'p1' }, now).allowed).toBe(true);
    const stale: Actor = { ...biller, mfaSatisfiedAt: new Date('2026-09-01T11:00:00Z') };
    expect(can(stale, 'patient:export', { practiceId: 'p1' }, now)).toMatchObject({ allowed: false, reason: 'step_up_required' });
  });
});
