/**
 * Encryption utilities for OAuth credentials storage
 *
 * Uses AES-256-GCM for authenticated encryption with the SESSION_SIGNING_SECRET
 * as the encryption key.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derives a 32-byte encryption key from the SESSION_SIGNING_SECRET
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Encrypts credentials using AES-256-GCM
 *
 * @param credentials - Plain credentials object (OAuth tokens, API keys, etc.)
 * @param secret - Encryption secret (SESSION_SIGNING_SECRET)
 * @returns Encrypted credentials object with salt, iv, authTag, and encrypted data
 */
export function encryptCredentials(credentials: any, secret: string): any {
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SIGNING_SECRET must be at least 32 characters');
  }

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive encryption key
  const key = deriveKey(secret, salt);

  // Encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(credentials);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Return as a single object with metadata
  return {
    version: 1,
    algorithm: ALGORITHM,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encrypted: encrypted.toString('base64'),
  };
}

/**
 * Decrypts credentials using AES-256-GCM
 *
 * @param encryptedData - Encrypted credentials object from encryptCredentials()
 * @param secret - Encryption secret (SESSION_SIGNING_SECRET)
 * @returns Decrypted credentials object
 */
export function decryptCredentials(encryptedData: any, secret: string): any {
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SIGNING_SECRET must be at least 32 characters');
  }

  if (!encryptedData || typeof encryptedData !== 'object') {
    throw new Error('Invalid encrypted data format');
  }

  // Extract components
  const salt = Buffer.from(encryptedData.salt, 'base64');
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const encrypted = Buffer.from(encryptedData.encrypted, 'base64');

  // Derive decryption key
  const key = deriveKey(secret, salt);

  // Decrypt
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  // Parse JSON
  return JSON.parse(decrypted.toString('utf8'));
}
