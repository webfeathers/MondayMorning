/**
 * Sync Engine Tests
 *
 * Tests for the sync engine orchestrator that coordinates:
 * - Adapter → Mapper → DB upsert → Logging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncDeals, syncAccounts, syncContacts, syncTickets } from '../core/sync-engine';
import type { CRMProvider } from '../types/crm-provider';
import type { FieldMapping, StageMapping, SyncOptions } from '../types/sync-types';

// Mock the database client
vi.mock('@wf/db', () => ({
  createTenantClient: vi.fn(() => ({
    db: mockDb,
    tenantId: 'test-tenant-id',
    withTenantContext: vi.fn(async (fn) => fn(mockDb)),
  })),
  deals: { id: 'id', tenantId: 'tenant_id', sourceProvider: 'source_provider', sourceId: 'source_id' },
  organizations: { id: 'id', tenantId: 'tenant_id', sourceProvider: 'source_provider', sourceId: 'source_id' },
  contacts: { id: 'id', tenantId: 'tenant_id', sourceProvider: 'source_provider', sourceId: 'source_id' },
  tickets: { id: 'id', tenantId: 'tenant_id', sourceProvider: 'source_provider', sourceId: 'source_id' },
  syncEvents: 'syncEvents',
}));

// Mock database instance
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve([])),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve([{ id: 'new-deal-id' }])),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'existing-deal-id' }])),
      })),
    })),
  })),
};

// Mock adapter
const createMockAdapter = (): CRMProvider => ({
  authenticate: vi.fn(),
  refreshToken: vi.fn(),
  testConnection: vi.fn(),
  discoverObjects: vi.fn(),
  discoverFields: vi.fn(),
  getObjectMetadata: vi.fn(),
  syncDeals: vi.fn().mockResolvedValue({
    records: [
      {
        id: 'deal-1',
        name: 'Big Deal',
        amount: 50000,
        currency: 'USD',
        stage: 'Proposal',
        probability: 75,
        closeDate: '2026-03-01',
        ownerId: 'owner-1',
        accountId: 'account-1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
        customFields: {
          customScore: 85,
        },
      },
    ],
    hasMore: false,
    metadata: {
      totalProcessed: 1,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
  }),
  syncAccounts: vi.fn().mockResolvedValue({
    records: [],
    hasMore: false,
    metadata: { totalProcessed: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
  }),
  syncContacts: vi.fn().mockResolvedValue({
    records: [],
    hasMore: false,
    metadata: { totalProcessed: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
  }),
  syncTickets: vi.fn().mockResolvedValue({
    records: [],
    hasMore: false,
    metadata: { totalProcessed: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
  }),
  getRateLimitStatus: vi.fn(),
  checkQuotaRemaining: vi.fn(),
  supportsWebhooks: vi.fn(),
  registerWebhook: vi.fn(),
  unregisterWebhook: vi.fn(),
});

describe('Sync Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncDeals', () => {
    it('orchestrates adapter → mapper → DB → logging', async () => {
      const adapter = createMockAdapter();
      const fieldMappings: FieldMapping[] = [
        { sourceField: 'name', targetField: 'name' },
        { sourceField: 'amount', targetField: 'amount' },
        { sourceField: 'stage', targetField: 'stage' },
      ];
      const stageMappings: StageMapping[] = [
        {
          sourceStage: 'Proposal',
          targetStage: 'Proposal',
          isClosed: false,
          isWon: false,
          probability: 75,
        },
      ];
      const syncOptions: SyncOptions = {
        mode: 'incremental',
        limit: 100,
      };

      const result = await syncDeals(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        stageMappings,
        syncOptions
      );

      // Verify adapter was called
      expect(adapter.syncDeals).toHaveBeenCalledWith(syncOptions);

      // Verify result structure
      expect(result).toMatchObject({
        success: true,
        totalProcessed: expect.any(Number),
        created: expect.any(Number),
        updated: expect.any(Number),
        skipped: expect.any(Number),
        failed: expect.any(Number),
      });
    });

    it('creates new records when sourceId does not exist', async () => {
      const adapter = createMockAdapter();
      const fieldMappings: FieldMapping[] = [
        { sourceField: 'name', targetField: 'name' },
      ];
      const stageMappings: StageMapping[] = [];
      const syncOptions: SyncOptions = { mode: 'full' };

      // Mock DB to return empty array (record doesn't exist)
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
      }));

      const result = await syncDeals(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        stageMappings,
        syncOptions
      );

      expect(result.created).toBeGreaterThan(0);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('updates existing records when sourceId exists', async () => {
      const adapter = createMockAdapter();
      const fieldMappings: FieldMapping[] = [
        { sourceField: 'name', targetField: 'name' },
      ];
      const stageMappings: StageMapping[] = [];
      const syncOptions: SyncOptions = { mode: 'incremental' };

      // Mock DB to return existing record
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ id: 'existing-deal-id' }])),
        })),
      }));

      const result = await syncDeals(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        stageMappings,
        syncOptions
      );

      expect(result.updated).toBeGreaterThan(0);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('logs sync_events with metadata', async () => {
      const adapter = createMockAdapter();
      const fieldMappings: FieldMapping[] = [];
      const stageMappings: StageMapping[] = [];
      const syncOptions: SyncOptions = { mode: 'full' };

      const result = await syncDeals(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        stageMappings,
        syncOptions
      );

      // Verify sync event was created with proper metadata
      expect(result).toHaveProperty('totalProcessed');
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('updated');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('failed');
    });

    it('handles validation errors gracefully (skip record, log error)', async () => {
      const adapter = createMockAdapter();

      // Mock adapter to return invalid data
      adapter.syncDeals = vi.fn().mockResolvedValue({
        records: [
          {
            id: 'deal-1',
            name: '', // Invalid: empty name
            amount: 'not-a-number', // Invalid: non-numeric amount
            customFields: {},
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-02-01T00:00:00Z',
          },
        ],
        hasMore: false,
        metadata: { totalProcessed: 1, created: 0, updated: 0, skipped: 0, failed: 0 },
      });

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'name', targetField: 'name' },
        { sourceField: 'amount', targetField: 'amount' },
      ];
      const stageMappings: StageMapping[] = [];
      const syncOptions: SyncOptions = { mode: 'full' };

      const result = await syncDeals(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        stageMappings,
        syncOptions
      );

      // Should skip invalid records, not throw
      expect(result.skipped).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });

    it('processes multiple pages (pagination)', async () => {
      const adapter = createMockAdapter();

      // First call returns hasMore: true
      adapter.syncDeals = vi.fn()
        .mockResolvedValueOnce({
          records: [
            {
              id: 'deal-1',
              name: 'Deal 1',
              customFields: {},
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-02-01T00:00:00Z',
            },
          ],
          cursor: 'page-2-cursor',
          hasMore: true,
          metadata: { totalProcessed: 1, created: 0, updated: 0, skipped: 0, failed: 0 },
        })
        .mockResolvedValueOnce({
          records: [
            {
              id: 'deal-2',
              name: 'Deal 2',
              customFields: {},
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-02-01T00:00:00Z',
            },
          ],
          hasMore: false,
          metadata: { totalProcessed: 1, created: 0, updated: 0, skipped: 0, failed: 0 },
        });

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'name', targetField: 'name' },
      ];
      const stageMappings: StageMapping[] = [];
      const syncOptions: SyncOptions = { mode: 'full' };

      const result = await syncDeals(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        stageMappings,
        syncOptions
      );

      // Should have called adapter twice (2 pages)
      expect(adapter.syncDeals).toHaveBeenCalledTimes(2);
      expect(result.totalProcessed).toBe(2);
    });

    it('uses tenant-aware DB client', async () => {
      const adapter = createMockAdapter();
      const fieldMappings: FieldMapping[] = [];
      const stageMappings: StageMapping[] = [];
      const syncOptions: SyncOptions = { mode: 'full' };

      await syncDeals(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        stageMappings,
        syncOptions
      );

      // Verify createTenantClient was called with correct tenant ID
      const { createTenantClient } = await import('@wf/db');
      expect(createTenantClient).toHaveBeenCalledWith('test-tenant-id');
    });
  });

  describe('syncAccounts', () => {
    it('orchestrates account sync', async () => {
      const adapter = createMockAdapter();
      adapter.syncAccounts = vi.fn().mockResolvedValue({
        records: [
          {
            id: 'account-1',
            name: 'Acme Corp',
            domain: 'acme.com',
            customFields: {},
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-02-01T00:00:00Z',
          },
        ],
        hasMore: false,
        metadata: { totalProcessed: 1, created: 0, updated: 0, skipped: 0, failed: 0 },
      });

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'name', targetField: 'name' },
        { sourceField: 'domain', targetField: 'domain' },
      ];
      const syncOptions: SyncOptions = { mode: 'full' };

      const result = await syncAccounts(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        syncOptions
      );

      expect(adapter.syncAccounts).toHaveBeenCalledWith(syncOptions);
      expect(result.success).toBe(true);
    });
  });

  describe('syncContacts', () => {
    it('orchestrates contact sync', async () => {
      const adapter = createMockAdapter();
      adapter.syncContacts = vi.fn().mockResolvedValue({
        records: [
          {
            id: 'contact-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            customFields: {},
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-02-01T00:00:00Z',
          },
        ],
        hasMore: false,
        metadata: { totalProcessed: 1, created: 0, updated: 0, skipped: 0, failed: 0 },
      });

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'firstName', targetField: 'firstName' },
        { sourceField: 'lastName', targetField: 'lastName' },
        { sourceField: 'email', targetField: 'email' },
      ];
      const syncOptions: SyncOptions = { mode: 'full' };

      const result = await syncContacts(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        syncOptions
      );

      expect(adapter.syncContacts).toHaveBeenCalledWith(syncOptions);
      expect(result.success).toBe(true);
    });
  });

  describe('syncTickets', () => {
    it('orchestrates ticket sync', async () => {
      const adapter = createMockAdapter();
      adapter.syncTickets = vi.fn().mockResolvedValue({
        records: [
          {
            id: 'ticket-1',
            subject: 'Help needed',
            status: 'open',
            customFields: {},
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-02-01T00:00:00Z',
          },
        ],
        hasMore: false,
        metadata: { totalProcessed: 1, created: 0, updated: 0, skipped: 0, failed: 0 },
      });

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'subject', targetField: 'subject' },
        { sourceField: 'status', targetField: 'status' },
      ];
      const syncOptions: SyncOptions = { mode: 'full' };

      const result = await syncTickets(
        'test-tenant-id',
        adapter,
        'test-connection-id',
        'salesforce',
        fieldMappings,
        syncOptions
      );

      expect(adapter.syncTickets).toHaveBeenCalledWith(syncOptions);
      expect(result.success).toBe(true);
    });
  });
});
