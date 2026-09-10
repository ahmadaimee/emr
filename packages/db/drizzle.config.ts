import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations/sql',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations run as the OWNER, not the application role. The application role
    // must never own tables, because table owners bypass row-level security.
    url: process.env.DATABASE_MIGRATION_URL ?? 'postgres://grove:grove_local_dev@localhost:5432/grove',
  },
  strict: true,
  verbose: true,
});
