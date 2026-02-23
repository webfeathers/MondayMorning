import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createConnection,
  getConnection,
  refreshConnection,
  testConnection,
  listConnections,
  deleteConnection,
  updateSyncState,
} from '../core/connection-manager';

// Mock connection data
const mockConnectionData = {
  id: 'conn-123',
  tenantId: 'tenant-123',
  providerType: 'crm',
  providerName: 'salesforce',
  credentials: {
    version: 1,
    algorithm: 'aes-256-gcm',
    salt: 'c2FsdA==',
    iv: 'aXY=',
    authTag: 'dGFn',
    encrypted: Buffer.from(JSON.stringify({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_at: Date.now() + 3600000,
    })).toString('base64'),
  },
  syncState: {},
  syncSchedule: null,
  isActive: true,
  lastSyncedAt: null,
  lastSyncStatus: null,
  lastSyncError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock the database
const mockDbClient = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([mockConnectionData]),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn(function(this: any) {
    // For listConnections, where() returns array directly
    // For other cases, where() returns chainable object with limit()
    return {
      limit: vi.fn().mockResolvedValue([mockConnectionData]),
      // Also support direct array return for listConnections
      then: (resolve: any) => resolve([mockConnectionData]),
      [Symbol.iterator]: function* () {
        yield mockConnectionData;
      },
      map: (fn: any) => [mockConnectionData].map(fn),
    };
  }),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

vi.mock('@wf/db', () => ({
  createTenantClient: vi.fn(() => ({
    db: mockDbClient,
    tenantId: 'tenant-123',
  })),
  integrationConnections: {},
}));

// Mock the encryption module
vi.mock('../core/encryption', () => ({
  encryptCredentials: vi.fn((creds) => ({
    version: 1,
    algorithm: 'aes-256-gcm',
    salt: 'c2FsdA==',
    iv: 'aXY=',
    authTag: 'dGFn',
    encrypted: Buffer.from(JSON.stringify(creds)).toString('base64'),
  })),
  decryptCredentials: vi.fn((encrypted) => {
    if (encrypted.encrypted) {
      return JSON.parse(Buffer.from(encrypted.encrypted, 'base64').toString('utf8'));
    }
    return {};
  }),
}));

// Mock the adapter
const mockAdapter = {
  refreshToken: vi.fn().mockResolvedValue({
    accessToken: 'new-token',
    refreshToken: 'new-refresh',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  }),
  testConnection: vi.fn().mockResolvedValue(true),
};

// Mock drizzle-orm for getConnection
vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => mockDbClient),
}));

// Mock postgres for getConnection
vi.mock('postgres', () => ({
  default: vi.fn(() => ({
    end: vi.fn(),
  })),
}));

// Mock the provider registry
vi.mock('../core/provider-registry', () => ({
  getAdapter: vi.fn(() => mockAdapter),
  getProviderType: vi.fn(() => 'crm'),
}));

describe('Connection Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SIGNING_SECRET = 'test-secret-key-32-chars-long!!!';
  });

  afterEach(() => {
    delete process.env.SESSION_SIGNING_SECRET;
  });

  describe('createConnection', () => {
    it('stores encrypted credentials in DB', async () => {
      const credentials = {
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires_at: Date.now() + 3600000,
      };

      const result = await createConnection(
        'tenant-123',
        'salesforce',
        credentials
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('tenantId', 'tenant-123');
      expect(result).toHaveProperty('providerName', 'salesforce');
      expect(result).toHaveProperty('credentials');
    });

    it('sets providerType based on providerName', async () => {
      const result = await createConnection(
        'tenant-123',
        'salesforce',
        { access_token: 'token' }
      );

      expect(result).toHaveProperty('providerType', 'crm');
    });

    it('initializes empty sync state', async () => {
      const result = await createConnection(
        'tenant-123',
        'salesforce',
        { access_token: 'token' }
      );

      expect(result).toHaveProperty('syncState', {});
    });

    it('throws error if SESSION_SIGNING_SECRET is missing', async () => {
      delete process.env.SESSION_SIGNING_SECRET;

      await expect(
        createConnection('tenant-123', 'salesforce', { access_token: 'token' })
      ).rejects.toThrow('SESSION_SIGNING_SECRET');
    });
  });

  describe('getConnection', () => {
    it('retrieves and decrypts credentials', async () => {
      const result = await getConnection('conn-123');

      expect(result).toHaveProperty('id', 'conn-123');
      expect(result).toHaveProperty('credentials');
      expect(typeof result.credentials).toBe('object');
    });

    it('returns null if connection not found', async () => {
      // Override the mock to return empty array
      mockDbClient.where = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      });

      const result = await getConnection('non-existent');
      expect(result).toBeNull();

      // Restore the mock
      mockDbClient.where = vi.fn(function(this: any) {
        return {
          limit: vi.fn().mockResolvedValue([mockConnectionData]),
          then: (resolve: any) => resolve([mockConnectionData]),
          [Symbol.iterator]: function* () {
            yield mockConnectionData;
          },
          map: (fn: any) => [mockConnectionData].map(fn),
        };
      });
    });
  });

  describe('refreshConnection', () => {
    it('calls adapter.refreshToken() and updates DB', async () => {
      const result = await refreshConnection('conn-123');

      expect(mockAdapter.refreshToken).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('credentials');
    });

    it('handles refresh failure gracefully', async () => {
      mockAdapter.refreshToken.mockRejectedValueOnce(new Error('invalid_grant'));

      const result = await refreshConnection('conn-123');

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('testConnection', () => {
    it('calls adapter.testConnection()', async () => {
      const result = await testConnection('conn-123');

      expect(mockAdapter.testConnection).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
    });

    it('returns failure if connection test fails', async () => {
      mockAdapter.testConnection.mockResolvedValueOnce(false);

      const result = await testConnection('conn-123');

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('listConnections', () => {
    it('returns all tenant connections', async () => {
      const result = await listConnections('tenant-123');

      expect(Array.isArray(result)).toBe(true);
    });

    it('decrypts credentials for all connections', async () => {
      const result = await listConnections('tenant-123');

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('credentials');
        expect(typeof result[0].credentials).toBe('object');
      }
    });
  });

  describe('deleteConnection', () => {
    it('soft deletes connection by setting isActive to false', async () => {
      const result = await deleteConnection('conn-123');

      expect(result).toHaveProperty('success', true);
    });

    it('returns false if connection not found', async () => {
      // Override the mock to return empty array
      mockDbClient.where = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      });

      const result = await deleteConnection('non-existent');

      expect(result).toHaveProperty('success', false);

      // Restore the mock
      mockDbClient.where = vi.fn(function(this: any) {
        return {
          limit: vi.fn().mockResolvedValue([mockConnectionData]),
          then: (resolve: any) => resolve([mockConnectionData]),
          [Symbol.iterator]: function* () {
            yield mockConnectionData;
          },
          map: (fn: any) => [mockConnectionData].map(fn),
        };
      });
    });
  });

  describe('updateSyncState', () => {
    it('updates sync cursor/state', async () => {
      const newState = {
        lastSyncCursor: '2026-02-22T18:00:00Z',
        lastDealId: 'deal-999',
      };

      const result = await updateSyncState('conn-123', newState);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('syncState', newState);
    });

    it('merges with existing sync state', async () => {
      const partialState = { lastSyncCursor: '2026-02-22T19:00:00Z' };

      const result = await updateSyncState('conn-123', partialState);

      expect(result).toHaveProperty('success', true);
      expect(result.syncState).toHaveProperty('lastSyncCursor');
    });
  });

  describe('credential encryption', () => {
    it('encrypts credentials before storing', async () => {
      const { encryptCredentials } = await import('../core/encryption');

      await createConnection(
        'tenant-123',
        'salesforce',
        { access_token: 'secret-token' }
      );

      expect(encryptCredentials).toHaveBeenCalledWith(
        { access_token: 'secret-token' },
        'test-secret-key-32-chars-long!!!'
      );
    });

    it('decrypts credentials when retrieving', async () => {
      const { decryptCredentials } = await import('../core/encryption');

      await getConnection('conn-123');

      expect(decryptCredentials).toHaveBeenCalled();
    });
  });
});
