import {
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';
import { citext } from './_types';

export const userStatus = pgEnum('user_status', [
  'invited',
  'active',
  'suspended',
  'deactivated',
]);

export const users = pgTable(
  'users',
  {
    id: primaryId,
    orgId,

    email: citext('email').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),

    /** Argon2id. Never bcrypt, never a fast hash. */
    passwordHash: text('password_hash'),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),

    status: userStatus('status').notNull().default('invited'),

    /**
     * MFA is mandatory by policy. This column records enrolment, and login refuses to
     * complete without it once the grace period lapses. The proposed HIPAA Security
     * Rule update moves MFA from "addressable" to required, so we treat it as required
     * now rather than retrofitting it later.
     */
    mfaEnrolledAt: timestamp('mfa_enrolled_at', { withTimezone: true }),

    /** Linked clinician record, when this user is also a provider. */
    providerId: uuid('provider_id'),

    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),

    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_org_email_key').on(t.orgId, t.email),
    index('users_org_status_idx').on(t.orgId, t.status),
  ],
);

export const mfaMethodType = pgEnum('mfa_method_type', [
  'totp',
  'webauthn',
  'recovery_code',
]);

export const mfaMethods = pgTable(
  'mfa_methods',
  {
    id: primaryId,
    orgId,
    userId: uuid('user_id').notNull(),
    type: mfaMethodType('type').notNull(),
    label: text('label'),

    /** Encrypted at the application layer; this column never holds a raw secret. */
    secretEncrypted: text('secret_encrypted'),
    keyVersion: integer('key_version').notNull().default(1),

    /** WebAuthn credential material. */
    credentialId: text('credential_id'),
    publicKey: text('public_key'),
    signCount: integer('sign_count').notNull().default(0),

    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('mfa_methods_user_idx').on(t.orgId, t.userId),
    uniqueIndex('mfa_methods_credential_key').on(t.credentialId),
  ],
);

/**
 * Roles are per-organization and fully data-driven — permissions are rows, not an enum
 * baked into code, because access management is a product surface the customer edits.
 */
export const roles = pgTable(
  'roles',
  {
    id: primaryId,
    orgId,
    name: text('name').notNull(),
    description: text('description'),
    /** System roles ship with the product and cannot be deleted, only cloned. */
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('roles_org_name_key').on(t.orgId, t.name)],
);

/**
 * A permission is `resource:action` — `claim:submit`, `patient:read`, `remittance:post`,
 * `rule:publish`. Held as rows so the permission matrix is inspectable and auditable
 * rather than implied by code.
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: primaryId,
    orgId,
    roleId: uuid('role_id').notNull(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    /** Optional ABAC constraint, e.g. {"maxClaimAmountCents": 500000}. */
    constraints: jsonb('constraints'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('role_permissions_key').on(t.roleId, t.resource, t.action),
    index('role_permissions_org_idx').on(t.orgId),
  ],
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: primaryId,
    orgId,
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('user_roles_key').on(t.userId, t.roleId)],
);

/**
 * Which client practices a user may touch. Minimum necessary access (45 CFR 164.502(b))
 * is a HIPAA requirement, not a convenience: a biller assigned to three practices must
 * not be able to open a fourth practice's charts.
 *
 * A user with no rows here sees no practices. Access is granted, never assumed.
 */
export const userPracticeAccess = pgTable(
  'user_practice_access',
  {
    id: primaryId,
    orgId,
    userId: uuid('user_id').notNull(),
    practiceId: uuid('practice_id').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('user_practice_access_key').on(t.userId, t.practiceId)],
);

/**
 * Time-boxed elevation for staff who legitimately need to work outside their assigned
 * practices — the deliberate alternative to an ambient superuser role. Every elevation
 * requires a stated reason, expires on its own, and is itself an audited event.
 */
export const accessElevations = pgTable(
  'access_elevations',
  {
    id: primaryId,
    orgId,
    userId: uuid('user_id').notNull(),
    grantedBy: uuid('granted_by').notNull(),
    reason: text('reason').notNull(),
    scope: jsonb('scope').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by'),
    ...timestamps,
  },
  (t) => [index('access_elevations_active_idx').on(t.orgId, t.userId, t.expiresAt)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: primaryId,
    orgId,
    userId: uuid('user_id').notNull(),

    /** SHA-256 of the token. The raw token is never stored. */
    tokenHash: text('token_hash').notNull(),

    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),

    /** Automatic logoff — 45 CFR 164.312(a)(2)(iii). */
    idleExpiresAt: timestamp('idle_expires_at', { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),

    mfaSatisfiedAt: timestamp('mfa_satisfied_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),

    ...timestamps,
  },
  (t) => [
    uniqueIndex('sessions_token_key').on(t.tokenHash),
    index('sessions_user_idx').on(t.orgId, t.userId),
  ],
);
