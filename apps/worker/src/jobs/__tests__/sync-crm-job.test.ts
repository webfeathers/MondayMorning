/**
 * Sync CRM Job Tests
 *
 * Tests for the sync CRM job handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncCRMJobHandler } from '../sync-crm-job';
import type { JobContext } from '../../types/job';

// Mock the integrations package
vi.mock('@wf/integrations', () => ({
  getConnection: vi.fn(),
  getAdapter: vi.fn(),
  syncDeals: vi.fn(),
  syncAccounts: vi.fn(),
  syncContacts: vi.fn(),
  syncTickets: vi.fn(),
  updateSyncState: vi.fn(),
}));

// Mock the database
vi.mock('@wf/db/src/client', () => ({
  createClient: vi.fn(),
}));

// Mock drizzle
vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(),
}));

// Mock the schema
vi.mock('@wf/db/src/schema', () => ({
  stageMappings: {
    tenantId: 'tenant_id',
    integrationConnectionId: 'integration_connection_id',
  },
  integrationConnections: {
    id: 'id',
  },
}));

import {
  getConnection,
  getAdapter,
  syncDeals,
  syncAccounts,
  syncContacts,
  syncTickets,
} from '@wf/integrations';
import { createClient } from '@wf/db/src/client';
import { drizzle } from 'drizzle-orm/postgres-js';

describe('Sync CRM Job Handler', () => {
  const mockConnection = {
    id: 'connection-1',
    tenantId: 'tenant-1',
    providerType: 'crm',
    providerName: 'salesforce',
    credentials: { access_token: 'token123' },
    syncState: {},
    syncSchedule: null,
    isActive: true,
    lastSyncedAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdapter = {
    testConnection: vi.fn().mockResolvedValue(true),
    syncDeals: vi.fn(),
    syncAccounts: vi.fn(),
    syncContacts: vi.fn(),
    syncTickets: vi.fn(),
  };

  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  const mockClient = {
    end: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (getConnection as any).mockResolvedValue(mockConnection);
    (getAdapter as any).mockReturnValue(mockAdapter);
    (createClient as any).mockResolvedValue(mockClient);
    (drizzle as any).mockReturnValue(mockDb);
  });

  it('syncs deals successfully', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      connectionId: 'connection-1',
      syncMode: 'incremental' as const,
      entities: ['deals' as const],
    };

    (syncDeals as any).mockResolvedValue({
      success: true,
      totalProcessed: 10,
      created: 5,
      updated: 5,
      skipped: 0,
      failed: 0,
    });

    const result = await syncCRMJobHandler(context, payload);

    expect(result.success).toBe(true);
    expect(result.entitiesProcessed).toEqual(['deals']);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].entity).toBe('deals');
    expect(result.results[0].totalProcessed).toBe(10);
    expect(result.results[0].created).toBe(5);
    expect(result.results[0].updated).toBe(5);

    expect(getConnection).toHaveBeenCalledWith('connection-1');
    expect(getAdapter).toHaveBeenCalledWith('salesforce', mockConnection.credentials);
    expect(mockAdapter.testConnection).toHaveBeenCalled();
    expect(syncDeals).toHaveBeenCalled();
  });

  it('syncs multiple entities', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      connectionId: 'connection-1',
      syncMode: 'full' as const,
      entities: ['deals' as const, 'accounts' as const, 'contacts' as const],
    };

    (syncDeals as any).mockResolvedValue({
      success: true,
      totalProcessed: 10,
      created: 5,
      updated: 5,
      skipped: 0,
      failed: 0,
    });

    (syncAccounts as any).mockResolvedValue({
      success: true,
      totalProcessed: 20,
      created: 10,
      updated: 10,
      skipped: 0,
      failed: 0,
    });

    (syncContacts as any).mockResolvedValue({
      success: true,
      totalProcessed: 30,
      created: 15,
      updated: 15,
      skipped: 0,
      failed: 0,
    });

    const result = await syncCRMJobHandler(context, payload);

    expect(result.success).toBe(true);
    expect(result.entitiesProcessed).toEqual(['deals', 'accounts', 'contacts']);
    expect(result.results).toHaveLength(3);

    expect(syncDeals).toHaveBeenCalled();
    expect(syncAccounts).toHaveBeenCalled();
    expect(syncContacts).toHaveBeenCalled();
  });

  it('throws error when connection not found', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      connectionId: 'connection-1',
      syncMode: 'incremental' as const,
      entities: ['deals' as const],
    };

    (getConnection as any).mockResolvedValue(null);

    await expect(syncCRMJobHandler(context, payload)).rejects.toThrow(
      'Connection connection-1 not found'
    );
  });

  it('throws error when connection is not active', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      connectionId: 'connection-1',
      syncMode: 'incremental' as const,
      entities: ['deals' as const],
    };

    (getConnection as any).mockResolvedValue({
      ...mockConnection,
      isActive: false,
    });

    await expect(syncCRMJobHandler(context, payload)).rejects.toThrow(
      'Connection connection-1 is not active'
    );
  });

  it('throws error when connection test fails', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      connectionId: 'connection-1',
      syncMode: 'incremental' as const,
      entities: ['deals' as const],
    };

    mockAdapter.testConnection.mockResolvedValue(false);

    await expect(syncCRMJobHandler(context, payload)).rejects.toThrow(
      'Connection test failed for salesforce'
    );
  });

  it('updates connection status to failed on error', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      connectionId: 'connection-1',
      syncMode: 'incremental' as const,
      entities: ['deals' as const],
    };

    // Mock syncDeals to throw error AFTER testConnection succeeds
    mockAdapter.testConnection.mockResolvedValue(true);
    (syncDeals as any).mockRejectedValue(new Error('Sync failed'));

    await expect(syncCRMJobHandler(context, payload)).rejects.toThrow('Sync failed');

    // Verify that connection status was updated
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('uses cursor from payload if provided', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      connectionId: 'connection-1',
      syncMode: 'incremental' as const,
      entities: ['deals' as const],
      cursor: 'cursor-123',
    };

    mockAdapter.testConnection.mockResolvedValue(true);
    (syncDeals as any).mockResolvedValue({
      success: true,
      totalProcessed: 10,
      created: 5,
      updated: 5,
      skipped: 0,
      failed: 0,
    });

    await syncCRMJobHandler(context, payload);

    // Verify that syncDeals was called with cursor from payload
    expect(syncDeals).toHaveBeenCalledWith(
      'tenant-1',
      mockAdapter,
      'connection-1',
      'salesforce',
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ cursor: 'cursor-123' })
    );
  });

  it('updates connection lastSyncedAt and status on success', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      connectionId: 'connection-1',
      syncMode: 'incremental' as const,
      entities: ['deals' as const],
    };

    mockAdapter.testConnection.mockResolvedValue(true);
    (syncDeals as any).mockResolvedValue({
      success: true,
      totalProcessed: 10,
      created: 5,
      updated: 5,
      skipped: 0,
      failed: 0,
    });

    await syncCRMJobHandler(context, payload);

    // Verify connection update was called
    expect(mockDb.update).toHaveBeenCalled();
  });
});
