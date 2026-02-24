/**
 * Tests for AI context assembler.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@wf/db';
import {
  assembleAccountHealthContext,
  assembleDealContext,
  assembleContext,
} from '@/lib/ai/context-assembler';

// Mock the database
vi.mock('@wf/db', () => ({
  db: {
    query: {
      accounts: {
        findMany: vi.fn(),
      },
      contacts: {
        findMany: vi.fn(),
      },
      deals: {
        findMany: vi.fn(),
      },
      tickets: {
        findMany: vi.fn(),
      },
    },
  },
}));

describe('assembleAccountHealthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assembles account health context with all related data', async () => {
    // Mock database responses
    vi.mocked(db.query.accounts.findMany).mockResolvedValue([
      {
        id: 'acc_1',
        tenantId: 'tenant_1',
        name: 'Acme Corp',
        industry: 'Technology',
        status: 'active',
        employeeCount: 500,
        annualRevenue: 5000000,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2024-01-01'),
      } as any,
    ]);

    vi.mocked(db.query.contacts.findMany).mockResolvedValue([
      {
        id: 'contact_1',
        tenantId: 'tenant_1',
        accountId: 'acc_1',
        name: 'John Doe',
        email: 'john@acme.com',
        title: 'CTO',
        isPrimary: true,
        isActive: true,
        createdAt: new Date('2023-01-15'),
      } as any,
    ]);

    vi.mocked(db.query.deals.findMany).mockResolvedValue([
      {
        id: 'deal_1',
        tenantId: 'tenant_1',
        accountId: 'acc_1',
        name: 'Q1 Expansion',
        stage: 'negotiation',
        amount: 50000,
        probability: 75,
        expectedCloseDate: new Date('2024-03-31'),
        status: 'open',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-02-01'),
      } as any,
    ]);

    vi.mocked(db.query.tickets.findMany).mockResolvedValue([
      {
        id: 'ticket_1',
        tenantId: 'tenant_1',
        accountId: 'acc_1',
        title: 'Integration Issue',
        description: 'API integration not working',
        status: 'open',
        priority: 'high',
        createdAt: new Date('2024-02-15'),
        resolvedAt: null,
      } as any,
    ]);

    const result = await assembleAccountHealthContext('acc_1', 'tenant_1');

    expect(result.contextData.accounts).toHaveLength(1);
    expect(result.contextData.contacts).toHaveLength(1);
    expect(result.contextData.deals).toHaveLength(1);
    expect(result.contextData.tickets).toHaveLength(1);

    expect(result.metadata.recordCounts).toEqual({
      accounts: 1,
      contacts: 1,
      deals: 1,
      tickets: 1,
    });

    expect(result.metadata.estimatedTokens).toBeGreaterThan(0);
    expect(result.metadata.pruned).toBe(false);
  });

  it('throws error if account not found', async () => {
    vi.mocked(db.query.accounts.findMany).mockResolvedValue([]);

    await expect(
      assembleAccountHealthContext('nonexistent', 'tenant_1')
    ).rejects.toThrow('Account nonexistent not found');
  });

  it('handles empty related data gracefully', async () => {
    vi.mocked(db.query.accounts.findMany).mockResolvedValue([
      {
        id: 'acc_1',
        tenantId: 'tenant_1',
        name: 'Acme Corp',
        industry: 'Technology',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    vi.mocked(db.query.contacts.findMany).mockResolvedValue([]);
    vi.mocked(db.query.deals.findMany).mockResolvedValue([]);
    vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

    const result = await assembleAccountHealthContext('acc_1', 'tenant_1');

    expect(result.contextData.accounts).toHaveLength(1);
    expect(result.contextData.contacts).toHaveLength(0);
    expect(result.contextData.deals).toHaveLength(0);
    expect(result.contextData.tickets).toHaveLength(0);

    expect(result.metadata.recordCounts).toEqual({
      accounts: 1,
      contacts: 0,
      deals: 0,
      tickets: 0,
    });
  });

  it('respects maxRecordsPerType option', async () => {
    vi.mocked(db.query.accounts.findMany).mockResolvedValue([
      { id: 'acc_1', tenantId: 'tenant_1', name: 'Acme Corp' } as any,
    ]);

    // Mock many contacts
    const manyContacts = Array.from({ length: 100 }, (_, i) => ({
      id: `contact_${i}`,
      tenantId: 'tenant_1',
      accountId: 'acc_1',
      name: `Contact ${i}`,
    }));
    vi.mocked(db.query.contacts.findMany).mockResolvedValue(manyContacts as any);
    vi.mocked(db.query.deals.findMany).mockResolvedValue([]);
    vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

    const result = await assembleAccountHealthContext('acc_1', 'tenant_1', {
      maxRecordsPerType: 50,
    });

    // Should have been limited by the database query
    expect(db.query.contacts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 50,
      })
    );
  });
});

describe('assembleDealContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assembles deal context with account and contacts', async () => {
    vi.mocked(db.query.deals.findMany).mockResolvedValue([
      {
        id: 'deal_1',
        tenantId: 'tenant_1',
        accountId: 'acc_1',
        name: 'Enterprise Deal',
        stage: 'proposal',
        amount: 100000,
        probability: 60,
        status: 'open',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-02-01'),
      } as any,
    ]);

    vi.mocked(db.query.accounts.findMany).mockResolvedValue([
      {
        id: 'acc_1',
        tenantId: 'tenant_1',
        name: 'Acme Corp',
        industry: 'Technology',
        status: 'active',
      } as any,
    ]);

    vi.mocked(db.query.contacts.findMany).mockResolvedValue([
      {
        id: 'contact_1',
        tenantId: 'tenant_1',
        accountId: 'acc_1',
        name: 'Jane Smith',
        email: 'jane@acme.com',
        title: 'VP Sales',
        isPrimary: true,
      } as any,
    ]);

    const result = await assembleDealContext('deal_1', 'tenant_1');

    expect(result.contextData.deals).toHaveLength(1);
    expect(result.contextData.accounts).toHaveLength(1);
    expect(result.contextData.contacts).toHaveLength(1);

    expect(result.metadata.recordCounts).toEqual({
      deals: 1,
      accounts: 1,
      contacts: 1,
    });

    expect(result.metadata.pruned).toBe(false);
  });

  it('throws error if deal not found', async () => {
    vi.mocked(db.query.deals.findMany).mockResolvedValue([]);

    await expect(assembleDealContext('nonexistent', 'tenant_1')).rejects.toThrow(
      'Deal nonexistent not found'
    );
  });

  it('handles deal without account', async () => {
    vi.mocked(db.query.deals.findMany).mockResolvedValue([
      {
        id: 'deal_1',
        tenantId: 'tenant_1',
        accountId: null,
        name: 'Unlinked Deal',
        stage: 'prospecting',
        amount: 25000,
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    const result = await assembleDealContext('deal_1', 'tenant_1');

    expect(result.contextData.deals).toHaveLength(1);
    expect(result.contextData.accounts).toHaveLength(0);
    expect(result.contextData.contacts).toHaveLength(0);
  });
});

describe('assembleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to account health assembler', async () => {
    vi.mocked(db.query.accounts.findMany).mockResolvedValue([
      { id: 'acc_1', tenantId: 'tenant_1', name: 'Test' } as any,
    ]);
    vi.mocked(db.query.contacts.findMany).mockResolvedValue([]);
    vi.mocked(db.query.deals.findMany).mockResolvedValue([]);
    vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

    const result = await assembleContext('account_health', 'acc_1', 'tenant_1');

    expect(result.contextData.accounts).toBeDefined();
    expect(db.query.accounts.findMany).toHaveBeenCalled();
  });

  it('routes to deal analysis assembler', async () => {
    vi.mocked(db.query.deals.findMany).mockResolvedValue([
      {
        id: 'deal_1',
        tenantId: 'tenant_1',
        accountId: null,
        name: 'Test Deal',
        stage: 'prospecting',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    const result = await assembleContext('deal_analysis', 'deal_1', 'tenant_1');

    expect(result.contextData.deals).toBeDefined();
    expect(db.query.deals.findMany).toHaveBeenCalled();
  });

  it('throws error for unknown crew template', async () => {
    await expect(
      assembleContext('unknown_crew' as any, 'entity_1', 'tenant_1')
    ).rejects.toThrow('Unknown crew template: unknown_crew');
  });

  it('throws error for unimplemented ticket analysis', async () => {
    await expect(assembleContext('ticket_analysis', 'ticket_1', 'tenant_1')).rejects.toThrow(
      'Ticket analysis not yet implemented'
    );
  });
});
