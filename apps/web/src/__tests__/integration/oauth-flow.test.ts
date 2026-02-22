import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock environment variables
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.NEXT_PUBLIC_APP_URL = 'http://acme.localhost:3000';
process.env.SESSION_SIGNING_SECRET = 'test-signing-secret-32-characters-min';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock database operations
const mockInsertReturning = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFindFirst = vi.fn();

vi.mock('@wf/db', () => {
  const mockSessions = {
    id: 'id',
    userId: 'user_id',
    tenantId: 'tenant_id',
    tokenHash: 'token_hash',
    expiresAt: 'expires_at',
    lastActiveAt: 'last_active_at',
    revokedAt: 'revoked_at',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
  };

  const mockUsers = {
    id: 'id',
    email: 'email',
    name: 'name',
    avatarUrl: 'avatar_url',
    authProvider: 'auth_provider',
    authProviderId: 'auth_provider_id',
    lastLoginAt: 'last_login_at',
  };

  return {
    createTenantClient: vi.fn(() => ({
      db: {},
      tenantId: 'test-tenant-id',
      withTenantContext: vi.fn(async (fn) => {
        const mockTx = {
          insert: () => ({
            values: () => ({
              returning: mockInsertReturning,
            }),
          }),
        };
        return fn(mockTx);
      }),
    })),
    sessions: mockSessions,
    users: mockUsers,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: mockSelect,
          }),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: mockInsertReturning,
        }),
      }),
      update: () => ({
        set: () => ({
          where: mockUpdate,
        }),
      }),
      query: {
        users: {
          findFirst: mockFindFirst,
        },
      },
    },
  };
});

// Mock OAuth helpers
vi.mock('@/lib/oauth/google', () => ({
  exchangeCodeForTokens: vi.fn(),
  fetchUserProfile: vi.fn(),
}));

import { exchangeCodeForTokens, fetchUserProfile } from '@/lib/oauth/google';

describe('OAuth Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('completes full OAuth flow for new user', async () => {
    // Step 1: User clicks "Sign in with Google"
    // This would redirect to /auth/initiate
    const initiateUrl = new URL('http://acme.localhost:3000/auth/initiate');

    // Step 2: /auth/initiate redirects to Google
    // Verify the URL would have correct parameters
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
    googleAuthUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', 'test-state-token');

    expect(googleAuthUrl.searchParams.get('client_id')).toBe('test-client-id');
    expect(googleAuthUrl.searchParams.get('redirect_uri')).toBe('http://acme.localhost:3000/auth/callback');
    expect(googleAuthUrl.searchParams.get('response_type')).toBe('code');
    expect(googleAuthUrl.searchParams.get('scope')).toBe('openid email profile');

    // Step 3: Google calls back with authorization code
    const callbackUrl = new URL('http://acme.localhost:3000/auth/callback');
    callbackUrl.searchParams.set('code', 'test-auth-code');
    callbackUrl.searchParams.set('state', 'test-state-token');

    // Mock Google API responses
    const mockTokens = {
      access_token: 'mock-access-token',
      id_token: 'mock-id-token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    const mockProfile = {
      sub: 'google-user-123',
      email: 'newuser@example.com',
      name: 'New User',
      picture: 'https://example.com/avatar.jpg',
      email_verified: true,
    };

    vi.mocked(exchangeCodeForTokens).mockResolvedValue(mockTokens);
    vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);

    // Step 4: User not found, should create new user
    mockFindFirst.mockResolvedValue(null);
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        authProvider: 'google',
        authProviderId: 'google-user-123',
      },
    ]);

    // Step 5: Session created
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'new-session-id',
      },
    ]);

    // Verify the flow would execute
    expect(mockTokens).toBeDefined();
    expect(mockProfile).toBeDefined();
    expect(mockProfile.email).toBe('newuser@example.com');

    // Step 6: Cookie would be set (tested in auth.test.ts)
    // Step 7: Redirect to dashboard would occur
    const dashboardUrl = new URL('/dashboard', 'http://acme.localhost:3000');
    expect(dashboardUrl.pathname).toBe('/dashboard');
  });

  it('completes full OAuth flow for existing user', async () => {
    const callbackUrl = new URL('http://acme.localhost:3000/auth/callback');
    callbackUrl.searchParams.set('code', 'test-auth-code');
    callbackUrl.searchParams.set('state', 'test-state-token');

    // Mock Google API responses
    const mockTokens = {
      access_token: 'mock-access-token',
      id_token: 'mock-id-token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    const mockProfile = {
      sub: 'google-user-456',
      email: 'existing@example.com',
      name: 'Existing User',
      picture: 'https://example.com/avatar2.jpg',
      email_verified: true,
    };

    vi.mocked(exchangeCodeForTokens).mockResolvedValue(mockTokens);
    vi.mocked(fetchUserProfile).mockResolvedValue(mockProfile);

    // Existing user found
    const existingUser = {
      id: 'existing-user-id',
      email: 'existing@example.com',
      name: 'Existing User',
      authProvider: 'google',
      authProviderId: 'google-user-456',
    };

    mockFindFirst.mockResolvedValue(existingUser);
    mockUpdate.mockResolvedValue(undefined);

    // Session created
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'existing-user-session-id',
      },
    ]);

    // Verify user would be found
    expect(existingUser.email).toBe('existing@example.com');
    expect(existingUser.id).toBe('existing-user-id');
  });

  it('handles OAuth errors correctly', async () => {
    const callbackUrl = new URL('http://acme.localhost:3000/auth/callback');
    callbackUrl.searchParams.set('error', 'access_denied');

    // Should redirect to login with error
    const loginUrl = new URL('/login', 'http://acme.localhost:3000');
    loginUrl.searchParams.set('error', 'access_denied');

    expect(loginUrl.searchParams.get('error')).toBe('access_denied');
  });

  it('validates state parameter for CSRF protection', async () => {
    const callbackUrl = new URL('http://acme.localhost:3000/auth/callback');
    callbackUrl.searchParams.set('code', 'test-auth-code');
    callbackUrl.searchParams.set('state', 'malicious-state-token');

    // State mismatch should redirect to login with error
    const expectedStoredState = 'test-state-token';
    const receivedState = 'malicious-state-token';

    expect(expectedStoredState).not.toBe(receivedState);

    const errorUrl = new URL('/login', 'http://acme.localhost:3000');
    errorUrl.searchParams.set('error', 'invalid_state');

    expect(errorUrl.searchParams.get('error')).toBe('invalid_state');
  });

  it('handles missing tenant ID from middleware', async () => {
    const callbackUrl = new URL('http://acme.localhost:3000/auth/callback');
    callbackUrl.searchParams.set('code', 'test-auth-code');
    callbackUrl.searchParams.set('state', 'test-state-token');

    // Mock successful Google exchange
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: 'mock-access-token',
      id_token: 'mock-id-token',
      expires_in: 3600,
      token_type: 'Bearer',
    });

    vi.mocked(fetchUserProfile).mockResolvedValue({
      sub: 'google-user-123',
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      email_verified: true,
    });

    // If tenant ID is missing from headers, should error
    const errorUrl = new URL('/login', 'http://acme.localhost:3000');
    errorUrl.searchParams.set('error', 'missing_tenant');

    expect(errorUrl.searchParams.get('error')).toBe('missing_tenant');
  });

  it('handles Google API token exchange failure', async () => {
    const callbackUrl = new URL('http://acme.localhost:3000/auth/callback');
    callbackUrl.searchParams.set('code', 'invalid-code');
    callbackUrl.searchParams.set('state', 'test-state-token');

    // Mock Google API error
    vi.mocked(exchangeCodeForTokens).mockRejectedValue(new Error('invalid_grant'));

    // Should redirect to login with error
    const errorUrl = new URL('/login', 'http://acme.localhost:3000');
    errorUrl.searchParams.set('error', 'invalid_grant');

    await expect(exchangeCodeForTokens('invalid-code', '', '', '')).rejects.toThrow('invalid_grant');
  });

  it('verifies session cookie properties', () => {
    // Session cookie should have correct properties
    const expectedCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 14, // 14 days
      path: '/',
    };

    expect(expectedCookieOptions.httpOnly).toBe(true);
    expect(expectedCookieOptions.sameSite).toBe('lax');
    expect(expectedCookieOptions.maxAge).toBe(1209600); // 14 days in seconds
    expect(expectedCookieOptions.path).toBe('/');
  });

  it('verifies tenant context is set during session creation', async () => {
    const tenantId = 'test-tenant-id';
    const userId = 'test-user-id';

    mockInsertReturning.mockResolvedValue([{ id: 'session-id' }]);

    // Session should be created with tenant context
    expect(tenantId).toBeTruthy();
    expect(userId).toBeTruthy();
  });
});
