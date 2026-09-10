import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';

/**
 * Time-based one-time passwords for MFA enrolment and verification. Secrets are
 * encrypted at rest with the application key; the column never holds a raw secret.
 */
const ISSUER = 'Grove';

export function generateTotpSecret(): { secret: string; uri: (label: string) => string } {
  const secret = new Secret({ size: 20 });
  return {
    secret: secret.base32,
    uri: (label) => new TOTP({ issuer: ISSUER, label, secret, digits: 6, period: 30 }).toString(),
  };
}

export function verifyTotp(secretBase32: string, token: string): boolean {
  const totp = new TOTP({ issuer: ISSUER, secret: Secret.fromBase32(secretBase32), digits: 6, period: 30 });
  // window of 1 tolerates ±30s of clock drift; any wider invites replay.
  return totp.validate({ token: token.replace(/\s/g, ''), window: 1 }) !== null;
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString('hex').match(/.{1,5}/g)!.join('-'));
}

// ---------------------------------------------------------------------------
// Envelope encryption for secrets at rest (AES-256-GCM). Key rotation works by
// storing the key version alongside the ciphertext and keeping old keys readable.
// ---------------------------------------------------------------------------

function keyFor(version: number): Buffer {
  const raw = version === Number(process.env.PHI_ENCRYPTION_KEY_VERSION ?? 1)
    ? process.env.PHI_ENCRYPTION_KEY
    : process.env[`PHI_ENCRYPTION_KEY_V${version}`];
  if (!raw || raw === 'replace-me') throw new Error(`Encryption key version ${version} is not configured`);
  return Buffer.from(raw, 'base64').subarray(0, 32).length === 32
    ? Buffer.from(raw, 'base64').subarray(0, 32)
    : Buffer.from(raw.padEnd(32, '0').slice(0, 32));
}

export function encryptSecret(plaintext: string): { ciphertext: string; keyVersion: number } {
  const keyVersion = Number(process.env.PHI_ENCRYPTION_KEY_VERSION ?? 1);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(keyVersion), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: [iv, tag, enc].map((b) => b.toString('base64')).join('.'), keyVersion };
}

export function decryptSecret(ciphertext: string, keyVersion: number): string {
  const [ivB, tagB, encB] = ciphertext.split('.');
  if (!ivB || !tagB || !encB) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', keyFor(keyVersion), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encB, 'base64')), decipher.final()]).toString('utf8');
}
