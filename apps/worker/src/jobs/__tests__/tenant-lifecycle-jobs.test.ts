/**
 * Tenant Lifecycle Jobs Tests
 *
 * Tests for provision, suspend, reactivate, and purge tenant jobs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionTenantJobHandler } from '../provision-tenant-job';
import { suspendTenantJobHandler } from '../suspend-tenant-job';
import { reactivateTenantJobHandler } from '../reactivate-tenant-job';
import { purgeTenantJobHandler } from '../purge-tenant-job';
import type { JobContext } from '../../types/job';

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
  tenants: {
    id: 'id',
    status: 'status',
  },
  jobs: {
    tenantId: 'tenant_id',
    status: 'status',
  },
  integrationConnections: {
    tenantId: 'tenant_id',
    isActive: 'is_active',
  },
  stageMappings: {
    tenantId: 'tenant_id',
  },
  fieldMappings: {
    tenantId: 'tenant_id',
  },
  deals: {
    tenantId: 'tenant_id',
  },
  accounts: {
    tenantId: 'tenant_id',
  },
  contacts: {
    tenantId: 'tenant_id',
  },
  tickets: {
    tenantId: 'tenant_id',
  },
}));

import { createClient } from '@wf/db/src/client';
import { drizzle } from 'drizzle-orm/postgres-js';

describe('Provision Tenant Job Handler', () => {
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // No existing tenant
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  };

  const mockClient = {
    end: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockClient);
    (drizzle as any).mockReturnValue(mockDb);
  });

  it('provisions a new tenant successfully', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      companyName: 'Acme Corp',
      subdomain: 'acme',
      plan: 'professional' as const,
      ownerEmail: 'owner@acme.com',
    };

    const result = await provisionTenantJobHandler(context, payload);

    expect(result.success).toBe(true);
    expect(result.tenantId).toBe('tenant-1');
    expect(result.provisionedAt).toBeInstanceOf(Date);

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockClient.end).toHaveBeenCalled();
  });

  it('throws error when tenant already exists', async () => {
    // Mock existing tenant
    const mockDbWithExisting = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'tenant-1' }]),
          }),
        }),
      }),
      insert: vi.fn(),
    };
    (drizzle as any).mockReturnValue(mockDbWithExisting);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      companyName: 'Acme Corp',
      subdomain: 'acme',
      plan: 'professional' as const,
      ownerEmail: 'owner@acme.com',
    };

    await expect(provisionTenantJobHandler(context, payload)).rejects.toThrow(
      'Tenant tenant-1 already exists'
    );
  });
});

describe('Suspend Tenant Job Handler', () => {
  const mockTenant = {
    id: 'tenant-1',
    name: 'Acme Corp',
    subdomain: 'acme',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockTenant]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };

  const mockClient = {
    end: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockClient);
    (drizzle as any).mockReturnValue(mockDb);

    // Reset the chain to return empty arrays for canceled jobs and disabled connections
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it('suspends an active tenant successfully', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Payment failure',
      notifyTenant: true,
    };

    const result = await suspendTenantJobHandler(context, payload);

    expect(result.success).toBe(true);
    expect(result.tenantId).toBe('tenant-1');
    expect(result.reason).toBe('Payment failure');
    expect(result.suspendedAt).toBeInstanceOf(Date);

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockClient.end).toHaveBeenCalled();
  });

  it('handles already suspended tenant gracefully', async () => {
    // Mock suspended tenant
    const suspendedTenant = { ...mockTenant, status: 'suspended' };
    const mockDbWithSuspended = {
      ...mockDb,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([suspendedTenant]),
          }),
        }),
      }),
    };
    (drizzle as any).mockReturnValue(mockDbWithSuspended);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Payment failure',
    };

    const result = await suspendTenantJobHandler(context, payload);

    expect(result.success).toBe(true);
    expect(result.reason).toBe('Already suspended');
    expect(result.activeJobsCanceled).toBe(0);
  });

  it('throws error when tenant not found', async () => {
    // Mock no tenant found
    const mockDbNoTenant = {
      ...mockDb,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    (drizzle as any).mockReturnValue(mockDbNoTenant);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Payment failure',
    };

    await expect(suspendTenantJobHandler(context, payload)).rejects.toThrow(
      'Tenant tenant-1 not found'
    );
  });
});

describe('Reactivate Tenant Job Handler', () => {
  const mockTenant = {
    id: 'tenant-1',
    name: 'Acme Corp',
    subdomain: 'acme',
    status: 'suspended',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockTenant]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };

  const mockClient = {
    end: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockClient);
    (drizzle as any).mockReturnValue(mockDb);

    // Reset the chain
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it('reactivates a suspended tenant successfully', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Payment received',
      reEnableIntegrations: true,
      notifyTenant: true,
    };

    const result = await reactivateTenantJobHandler(context, payload);

    expect(result.success).toBe(true);
    expect(result.tenantId).toBe('tenant-1');
    expect(result.reason).toBe('Payment received');
    expect(result.reactivatedAt).toBeInstanceOf(Date);

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockClient.end).toHaveBeenCalled();
  });

  it('handles already active tenant gracefully', async () => {
    // Mock active tenant
    const activeTenant = { ...mockTenant, status: 'active' };
    const mockDbWithActive = {
      ...mockDb,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([activeTenant]),
          }),
        }),
      }),
    };
    (drizzle as any).mockReturnValue(mockDbWithActive);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Payment received',
    };

    const result = await reactivateTenantJobHandler(context, payload);

    expect(result.success).toBe(true);
    expect(result.reason).toBe('Already active');
    expect(result.integrationsReEnabled).toBe(0);
  });

  it('throws error when tenant not found', async () => {
    // Mock no tenant found
    const mockDbNoTenant = {
      ...mockDb,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    (drizzle as any).mockReturnValue(mockDbNoTenant);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Payment received',
    };

    await expect(reactivateTenantJobHandler(context, payload)).rejects.toThrow(
      'Tenant tenant-1 not found'
    );
  });

  it('throws error when tenant is not suspended', async () => {
    // Mock tenant with wrong status
    const deletedTenant = { ...mockTenant, status: 'deleted' };
    const mockDbWithDeleted = {
      ...mockDb,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([deletedTenant]),
          }),
        }),
      }),
    };
    (drizzle as any).mockReturnValue(mockDbWithDeleted);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Payment received',
    };

    await expect(reactivateTenantJobHandler(context, payload)).rejects.toThrow(
      "Tenant tenant-1 has status 'deleted', expected 'suspended'"
    );
  });
});

describe('Purge Tenant Job Handler', () => {
  const mockTenant = {
    id: 'tenant-1',
    name: 'Acme Corp',
    subdomain: 'acme',
    status: 'deleted',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'), // 30+ days ago
  };

  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockTenant]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  };

  const mockClient = {
    end: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockClient);
    (drizzle as any).mockReturnValue(mockDb);

    // Reset the delete chain to return empty arrays
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('purges tenant after grace period', async () => {
    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Grace period expired',
    };

    const result = await purgeTenantJobHandler(context, payload);

    expect(result.success).toBe(true);
    expect(result.tenantId).toBe('tenant-1');
    expect(result.reason).toBe('Grace period expired');
    expect(result.purgedAt).toBeInstanceOf(Date);

    // Should delete from all tables
    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockClient.end).toHaveBeenCalled();
  });

  it('purges tenant with force=true', async () => {
    // Mock tenant deleted very recently (grace period not elapsed)
    const recentTenant = {
      ...mockTenant,
      updatedAt: new Date(), // Just deleted
    };
    const mockDbRecent = {
      ...mockDb,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([recentTenant]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
    (drizzle as any).mockReturnValue(mockDbRecent);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Force purge',
      force: true,
    };

    const result = await purgeTenantJobHandler(context, payload);

    expect(result.success).toBe(true);
    expect(mockDbRecent.delete).toHaveBeenCalled();
  });

  it('throws error when grace period not elapsed', async () => {
    // Mock tenant deleted very recently
    const recentTenant = {
      ...mockTenant,
      updatedAt: new Date(), // Just deleted
    };
    const mockDbRecent = {
      ...mockDb,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([recentTenant]),
          }),
        }),
      }),
    };
    (drizzle as any).mockReturnValue(mockDbRecent);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Grace period expired',
      force: false,
    };

    await expect(purgeTenantJobHandler(context, payload)).rejects.toThrow(
      /Grace period has not elapsed/
    );
  });

  it('throws error when tenant not found', async () => {
    // Mock no tenant found
    const mockDbNoTenant = {
      ...mockDb,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    (drizzle as any).mockReturnValue(mockDbNoTenant);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Grace period expired',
    };

    await expect(purgeTenantJobHandler(context, payload)).rejects.toThrow(
      'Tenant tenant-1 not found'
    );
  });

  it('throws error when tenant is not deleted', async () => {
    // Mock active tenant
    const activeTenant = { ...mockTenant, status: 'active' };
    const mockDbActive = {
      ...mockDb,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([activeTenant]),
          }),
        }),
      }),
    };
    (drizzle as any).mockReturnValue(mockDbActive);

    const context: JobContext = {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      attempt: 1,
      startedAt: new Date(),
      maxAttempts: 3,
    };

    const payload = {
      tenantId: 'tenant-1',
      reason: 'Grace period expired',
    };

    await expect(purgeTenantJobHandler(context, payload)).rejects.toThrow(
      /Only tenants with status 'deleted' can be purged/
    );
  });
});
