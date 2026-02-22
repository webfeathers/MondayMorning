import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  fetchUserProfile,
} from '../lib/oauth/google';

describe('Google OAuth Helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('buildAuthorizationUrl', () => {
    it('builds correct Google OAuth URL', () => {
      const redirectUri = 'http://localhost:3000/auth/callback';
      const state = 'test-state-123';
      const clientId = 'test-client-id';

      const url = buildAuthorizationUrl(clientId, redirectUri, state);

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain(`client_id=${clientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(url).toContain('response_type=code');
      // URL encoding can use either + or %20 for spaces
      expect(url).toMatch(/scope=(openid(\+|%20)email(\+|%20)profile|openid%20email%20profile)/);
      expect(url).toContain(`state=${state}`);
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('exchanges code for access token', async () => {
      const mockResponse = {
        access_token: 'ya29.mock-access-token',
        id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.mock',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await exchangeCodeForTokens(
        'auth-code-123',
        'http://localhost:3000/auth/callback',
        'client-id',
        'client-secret'
      );

      expect(result.access_token).toBe('ya29.mock-access-token');
      expect(result.id_token).toBeTruthy();
    });

    it('throws error on invalid code', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' }),
      } as Response);

      await expect(
        exchangeCodeForTokens(
          'invalid-code',
          'http://localhost:3000/auth/callback',
          'client-id',
          'client-secret'
        )
      ).rejects.toThrow();
    });
  });

  describe('fetchUserProfile', () => {
    it('fetches user profile from Google', async () => {
      const mockProfile = {
        sub: 'google-user-id-123',
        email: 'user@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://lh3.googleusercontent.com/a/avatar.jpg',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response);

      const profile = await fetchUserProfile('mock-access-token');

      expect(profile.sub).toBe('google-user-id-123');
      expect(profile.email).toBe('user@example.com');
      expect(profile.name).toBe('Test User');
    });

    it('throws error on invalid token', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_token' }),
      } as Response);

      await expect(fetchUserProfile('invalid-token')).rejects.toThrow();
    });
  });
});
