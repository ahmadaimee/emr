export {
  withTenant,
  systemContext,
  listOrganizationIds,
  bootstrap,
  closeDatabase,
  schema,
} from './tenant';
export type { TenantTx, TenantContext, ActorType } from './tenant';

export { NON_TENANT_TABLES, APPEND_ONLY_TABLES } from './schema';

// Re-export the query helpers most call sites need, so consumers never import
// drizzle-orm directly. An ESLint rule enforces that outside this package.
export { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lt, lte, ne, not, or, sql, type SQL } from 'drizzle-orm';
