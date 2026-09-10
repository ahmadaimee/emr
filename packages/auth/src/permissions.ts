/**
 * The permission registry. Every `resource:action` the system checks is declared
 * here, and a migration test asserts every `role_permissions` row references one of
 * these keys. Orphaned permission strings are how privilege escalation happens.
 */
export const PERMISSIONS = {
  patient: ['read', 'create', 'update', 'merge', 'export', 'read_ssn'],
  coverage: ['read', 'create', 'update', 'delete'],
  eligibility: ['read', 'run', 'run_batch'],
  encounter: ['read', 'create', 'update', 'void'],
  claim: ['read', 'create', 'update', 'submit', 'void', 'correct', 'override_scrub', 'export'],
  remittance: ['read', 'import', 'post', 'reverse'],
  payment: ['read', 'collect', 'apply', 'refund', 'void'],
  denial: ['read', 'work', 'appeal', 'write_off'],
  statement: ['read', 'generate', 'send'],
  report: ['read', 'create', 'run', 'export', 'schedule'],
  rule: ['read', 'create', 'update', 'test', 'publish', 'disable'],
  task: ['read', 'create', 'assign', 'resolve'],
  queue: ['read', 'manage'],
  user: ['read', 'invite', 'update', 'deactivate', 'assign_roles'],
  role: ['read', 'create', 'update', 'delete'],
  audit: ['read', 'export', 'verify'],
  automation: ['read', 'configure', 'pause'],
  api_key: ['read', 'create', 'revoke'],
  webhook: ['read', 'manage'],
  practice: ['read', 'create', 'update'],
  payer: ['read', 'create', 'update'],
  contract: ['read', 'create', 'update'],
  access: ['elevate', 'grant_elevation'],
} as const;

export type Resource = keyof typeof PERMISSIONS;
export type Action<R extends Resource> = (typeof PERMISSIONS)[R][number];
export type Permission = { [R in Resource]: `${R}:${Action<R>}` }[Resource];

export function isKnownPermission(resource: string, action: string): boolean {
  if (resource === '*' && action === '*') return true;
  const actions = (PERMISSIONS as Record<string, readonly string[]>)[resource];
  if (!actions) return false;
  return action === '*' || actions.includes(action);
}

/**
 * Actions that require a fresh authentication (step-up) regardless of session age.
 * The session must have been authenticated — including MFA — within
 * SESSION_FRESH_MINUTES for these to proceed.
 */
export const STEP_UP_REQUIRED: ReadonlySet<Permission> = new Set<Permission>([
  'patient:export',
  'patient:read_ssn',
  'claim:export',
  'user:assign_roles',
  'user:deactivate',
  'role:create',
  'role:update',
  'role:delete',
  'audit:export',
  'api_key:create',
  'api_key:revoke',
  'webhook:manage',
  'automation:configure',
  'access:elevate',
  'access:grant_elevation',
  'remittance:reverse',
  'payment:refund',
]);
