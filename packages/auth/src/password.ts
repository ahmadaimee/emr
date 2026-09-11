import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id with parameters above the OWASP minimum. Never bcrypt, never a fast hash.
 * `algorithm: 2` is Argon2id — @node-rs/argon2's `Algorithm` enum is an ambient
 * const enum and can't be referenced under isolatedModules.
 */
const PARAMS = { algorithm: 2, memoryCost: 65_536, timeCost: 3, parallelism: 2 } as const;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error('Password must be at least 12 characters');
  return hash(password, PARAMS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
