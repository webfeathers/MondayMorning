import { randomBytes, createHash, createHmac } from 'crypto';

/**
 * Generates a cryptographically secure random session token
 * @returns A hex-encoded random token (64 characters from 32 bytes)
 */
export function createSessionToken(): string {
  // Generate 32 random bytes and convert to hex
  return randomBytes(32).toString('hex');
}

/**
 * Creates a SHA-256 hash of a token for secure database storage
 * @param token - The session token to hash
 * @returns The SHA-256 hash as a hex string (64 characters)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Signs a cookie value using HMAC-SHA256
 * @param value - The cookie value to sign
 * @param secret - The secret key for signing
 * @returns The signed cookie in the format: value.signature
 */
export function signCookie(value: string, secret: string): string {
  const signature = createHmac('sha256', secret)
    .update(value)
    .digest('base64')
    .replace(/=+$/, ''); // Remove padding

  return `${value}.${signature}`;
}

/**
 * Verifies a signed cookie and extracts the original value
 * @param signedValue - The signed cookie value
 * @param secret - The secret key used for signing
 * @returns The original value if valid, null if verification fails
 */
export function verifyCookie(signedValue: string, secret: string): string | null {
  if (!signedValue || typeof signedValue !== 'string') {
    return null;
  }

  const lastDotIndex = signedValue.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return null;
  }

  const value = signedValue.slice(0, lastDotIndex);
  const providedSignature = signedValue.slice(lastDotIndex + 1);

  // Compute expected signature
  const expectedSignature = createHmac('sha256', secret)
    .update(value)
    .digest('base64')
    .replace(/=+$/, '');

  // Use timing-safe comparison
  if (providedSignature !== expectedSignature) {
    return null;
  }

  return value;
}
