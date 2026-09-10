/**
 * CI gate: tenant isolation is structural, not aspirational.
 *
 * Fails the build if any table in `public`:
 *   - has an org_id column but lacks RLS, forced RLS, or a policy; or
 *   - has NO org_id column and is not on the NON_TENANT_TABLES allowlist; or
 *   - is append-only but the app role still holds UPDATE/DELETE on it;
 * or if any role other than the bootstrap superuser can bypass RLS.
 *
 * A new table without isolation must be a red build, not a code-review hope.
 */
import postgres from 'postgres';
import { APPEND_ONLY_TABLES, NON_TENANT_TABLES } from '../schema';

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  throw new Error('DATABASE_MIGRATION_URL is not set');
}

interface TableRow {
  relname: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
  has_org_id: boolean;
  policy_count: number;
}

async function main() {
  const sql = postgres(url!, { max: 1 });
  const failures: string[] = [];

  try {
    const tables = await sql<TableRow[]>`
      select c.relname,
             c.relrowsecurity,
             c.relforcerowsecurity,
             exists (
               select 1 from pg_attribute a
                where a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped
             ) as has_org_id,
             (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policy_count
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
       order by c.relname
    `;

    const nonTenant = new Set<string>(NON_TENANT_TABLES);

    for (const t of tables) {
      if (t.relname === 'organizations') {
        if (!t.relrowsecurity || !t.relforcerowsecurity || t.policy_count === 0) {
          failures.push(`organizations: RLS must be enabled, forced, and have a policy`);
        }
        continue;
      }
      if (t.has_org_id) {
        if (!t.relrowsecurity) failures.push(`${t.relname}: row level security is not enabled`);
        if (!t.relforcerowsecurity) failures.push(`${t.relname}: row level security is not FORCED`);
        if (t.policy_count === 0) failures.push(`${t.relname}: has no RLS policy`);
      } else if (!nonTenant.has(t.relname)) {
        failures.push(
          `${t.relname}: has no org_id column and is not in NON_TENANT_TABLES — ` +
            `either add org_id or explicitly allowlist it`,
        );
      }
    }

    const bypass = await sql<{ rolname: string }[]>`
      select rolname from pg_roles
       where rolbypassrls and rolname not in ('postgres', 'grove')
    `;
    for (const r of bypass) {
      failures.push(`role ${r.rolname} can BYPASSRLS`);
    }

    const appPrivs = await sql<{ table_name: string; privilege_type: string }[]>`
      select table_name, privilege_type
        from information_schema.role_table_grants
       where grantee = 'grove_app'
         and table_schema = 'public'
         and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE')
         and table_name = any(${[...APPEND_ONLY_TABLES]})
    `;
    for (const p of appPrivs) {
      // outbox_events legitimately allows a column-limited UPDATE for the relay.
      if (p.table_name === 'outbox_events' && p.privilege_type === 'UPDATE') continue;
      failures.push(`${p.table_name}: grove_app holds ${p.privilege_type} on an append-only table`);
    }

    if (failures.length > 0) {
      console.error('✗ RLS coverage check FAILED\n');
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }

    console.log(`✓ RLS coverage: ${tables.length} tables checked, all isolated`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
