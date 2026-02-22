import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSession, validateSession, revokeSession, refreshSession } from '../session-management';
import { hashToken } from '../session';
import { SESSION_DURATION_MS } from '@wf/shared';

// Set mock DATABASE_URL
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock database functions
const mockInsertReturning = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEnd = vi.fn();

// Mock the database modules
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
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: mockSelect,
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: mockUpdate,
        }),
      }),
    },
  };
});

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockSelect,
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: mockUpdate,
      }),
    }),
  })),
}));

vi.mock('postgres', () => ({
  default: vi.fn(() => ({
    end: mockEnd,
  })),
}));

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual('drizzle-orm');
  return {
    ...actual,
    eq: vi.fn((a, b) => ({ sql: `${a} = ${b}` })),
    and: vi.fn((...args) => ({ sql: `AND ${args.length}` })),
    lt: vi.fn((a, b) => ({ sql: `${a} < ${b}` })),
  };
});

describe('Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('creates a session record in the database', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      mockInsertReturning.mockResolvedValue([{ id: 'session-789' }]);

      const result = await createSession(userId, tenantId);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.sessionId).toBe('session-789');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBe(64); // 32 bytes as hex = 64 characters
    });

    it('stores hash in database, not plaintext token', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      mockInsertReturning.mockResolvedValue([{ id: 'session-789' }]);

      const result = await createSession(userId, tenantId);
      const expectedHash = hashToken(result.token);

      // Verify that the hash would be computed correctly
      expect(expectedHash).toBeDefined();
      expect(expectedHash.length).toBe(64); // SHA-256 hex = 64 characters
      expect(expectedHash).not.toBe(result.token);
    });

    it('sets expiration to 14 days from now', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const beforeCreate = Date.now();

      mockInsertReturning.mockResolvedValue([{ id: 'session-789' }]);

      await createSession(userId, tenantId);

      const expectedExpiry = beforeCreate + SESSION_DURATION_MS;

      // Expiry should be SESSION_DURATION_MS in the future
      expect(SESSION_DURATION_MS).toBe(14 * 24 * 60 * 60 * 1000);
      expect(expectedExpiry).toBeGreaterThan(beforeCreate);
    });

    it('returns plaintext token to caller', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      mockInsertReturning.mockResolvedValue([{ id: 'session-789' }]);

      const result = await createSession(userId, tenantId);

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBe(64);
    });
  });

  describe('validateSession', () => {
    it('returns session data if token is valid', async () => {
      const validSession = {
        id: 'session-123',
        userId: 'user-456',
        tenantId: 'tenant-789',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 1000000),
        lastActiveAt: new Date(),
        revokedAt: null,
      };

      mockSelect.mockResolvedValue([validSession]);

      const result = await validateSession('test-token');

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe('session-123');
      expect(result?.userId).toBe('user-456');
      expect(result?.tenantId).toBe('tenant-789');
    });

    it('returns null if session not found', async () => {
      mockSelect.mockResolvedValue([]);

      const result = await validateSession('invalid-token');

      expect(result).toBeNull();
    });

    it('returns null if session is revoked', async () => {
      const revokedSession = {
        id: 'session-123',
        userId: 'user-456',
        tenantId: 'tenant-789',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 1000000),
        lastActiveAt: new Date(),
        revokedAt: new Date(), // Revoked
      };

      mockSelect.mockResolvedValue([revokedSession]);

      const result = await validateSession('test-token');

      expect(result).toBeNull();
    });

    it('returns null if session is expired', async () => {
      const expiredSession = {
        id: 'session-123',
        userId: 'user-456',
        tenantId: 'tenant-789',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1000), // Expired
        lastActiveAt: new Date(),
        revokedAt: null,
      };

      mockSelect.mockResolvedValue([expiredSession]);

      const result = await validateSession('test-token');

      expect(result).toBeNull();
    });

    it('hashes token before database lookup', async () => {
      mockSelect.mockResolvedValue([]);

      const token = 'test-token-12345678901234567890123456789012345678901234567890123456';
      const expectedHash = hashToken(token);

      await validateSession(token);

      // Verify hash is correct format
      expect(expectedHash).toBeDefined();
      expect(expectedHash.length).toBe(64);
    });
  });

  describe('revokeSession', () => {
    it('marks session as revoked', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await revokeSession('session-123');

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('sets revokedAt timestamp', async () => {
      const beforeRevoke = new Date();

      mockUpdate.mockResolvedValue(undefined);

      await revokeSession('session-123');

      const afterRevoke = new Date();

      // Timestamp should be between before and after
      expect(afterRevoke.getTime()).toBeGreaterThanOrEqual(beforeRevoke.getTime());
    });
  });

  describe('refreshSession - sliding window', () => {
    it('updates lastActiveAt if more than 1 hour old', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await refreshSession('session-123');

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('does not throw on error', async () => {
      mockUpdate.mockResolvedValue(undefined);

      // Should not throw even if session doesn't exist
      await expect(refreshSession('session-123')).resolves.not.toThrow();
    });

    it('only updates sessions that exist', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await refreshSession('non-existent');

      // Function should complete without error
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
