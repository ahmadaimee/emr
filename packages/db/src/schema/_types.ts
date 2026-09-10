import { customType } from 'drizzle-orm/pg-core';

/**
 * Case-insensitive text. Email addresses and payer member IDs are compared
 * case-insensitively in the real world; doing it in the column type means we cannot
 * forget a `lower()` somewhere and create a duplicate patient or a second account.
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType: () => 'citext',
});

/**
 * Money, stored as an integer number of cents in a bigint.
 *
 * Never a float — 0.1 + 0.2 problems in a system that must balance to the penny against
 * a payer 835 are not acceptable. Never a bare `numeric` either, because node-postgres
 * returns numerics as strings and someone will eventually parseFloat one.
 */
export const money = customType<{ data: number; driverData: string }>({
  dataType: () => 'bigint',
  fromDriver: (value) => Number(value),
  toDriver: (value) => String(Math.round(value)),
});
