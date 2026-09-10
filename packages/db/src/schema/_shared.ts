import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Every table in Grove carries these. `createdAt`/`updatedAt` are set by the database
 * rather than the application so that a direct SQL fix still leaves an honest trail.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/**
 * The tenant discriminator. Present on every table that can hold PHI or
 * tenant-confidential data, and the column every row-level security policy keys on.
 *
 * This is deliberately NOT a foreign key declared inline — see `organizations` for the
 * reference. Declaring it here keeps the RLS contract visible at every call site: if a
 * table has `orgId`, it has an RLS policy, and the two are generated together.
 */
export const orgId = uuid('org_id').notNull();

export const primaryId = uuid('id')
  .primaryKey()
  .default(sql`gen_random_uuid()`);

/** Who performed an action. Nullable because some rows are created by the system itself. */
export const actorColumns = {
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

/**
 * Money. Stored as an integer number of cents — never a float, and never a numeric that
 * some driver will hand back as a string and someone will then parse with parseFloat.
 * Claim arithmetic has to balance to the penny against the payer's 835.
 */
export const cents = (name: string) => ({ name, kind: 'cents' as const });
