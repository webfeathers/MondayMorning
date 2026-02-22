import { describe, it, expect } from 'vitest';
import { createSessionToken, hashToken, signCookie, verifyCookie } from '../session';

describe('Session Helpers', () => {
  describe('createSessionToken', () => {
    it('generates a secure random token', () => {
      const token1 = createSessionToken();
      const token2 = createSessionToken();

      // Should be non-empty strings
      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');

      // Should be unique (crypto-random)
      expect(token1).not.toBe(token2);

      // Should be reasonable length (32 bytes = 64 hex chars)
      expect(token1.length).toBeGreaterThan(32);
    });
  });

  describe('hashToken', () => {
    it('creates SHA-256 hash of token', () => {
      const token = 'test-token-123';
      const hash = hashToken(token);

      // Should be non-empty string
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');

      // Should be consistent for same input
      expect(hashToken(token)).toBe(hash);

      // Should be different for different inputs
      expect(hashToken('different-token')).not.toBe(hash);

      // SHA-256 produces 64 hex characters
      expect(hash.length).toBe(64);
    });
  });

  describe('signCookie', () => {
    it('creates signed cookie value', () => {
      const value = 'session-token-abc123';
      const secret = 'my-secret-key';
      const signed = signCookie(value, secret);

      // Should be non-empty
      expect(signed).toBeTruthy();
      expect(typeof signed).toBe('string');

      // Should contain the original value and signature
      expect(signed).toContain('.');

      // Should be different from original value
      expect(signed).not.toBe(value);

      // Same input should produce same output
      expect(signCookie(value, secret)).toBe(signed);

      // Different secret should produce different signature
      expect(signCookie(value, 'different-secret')).not.toBe(signed);
    });
  });

  describe('verifyCookie', () => {
    it('verifies and extracts value from signed cookie', () => {
      const value = 'session-token-xyz789';
      const secret = 'my-secret-key';
      const signed = signCookie(value, secret);

      const verified = verifyCookie(signed, secret);

      // Should return original value
      expect(verified).toBe(value);
    });

    it('returns null for tampered cookie', () => {
      const value = 'session-token-xyz789';
      const secret = 'my-secret-key';
      const signed = signCookie(value, secret);

      // Tamper with the signature
      const tampered = signed.replace(/.$/, 'x');

      const verified = verifyCookie(tampered, secret);

      // Should return null for invalid signature
      expect(verified).toBeNull();
    });

    it('returns null for wrong secret', () => {
      const value = 'session-token-xyz789';
      const secret = 'my-secret-key';
      const signed = signCookie(value, secret);

      const verified = verifyCookie(signed, 'wrong-secret');

      // Should return null when verified with wrong secret
      expect(verified).toBeNull();
    });

    it('returns null for malformed cookie', () => {
      const secret = 'my-secret-key';

      // Cookie without signature separator
      expect(verifyCookie('no-signature-here', secret)).toBeNull();

      // Empty string
      expect(verifyCookie('', secret)).toBeNull();
    });
  });
});
