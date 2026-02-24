/**
 * Tests for AI context assembler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assembleContext } from '../context-assembler';

// Mock the database
vi.mock('@wf/db', () => ({
  db: {
    query: {
      organizations: {
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

import { db } from '@wf/db';

describe('Context Assembler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assembleContext routing', () => {
    it('routes account_health to account health assembler', async () => {
      // Mock database responses
      vi.mocked(db.query.organizations.findMany).mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          name: 'Acme Corp',
          industry: 'Technology',
          employeeCount: 500,
          annualRevenue: 10000000,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
        },
      ]);

      vi.mocked(db.query.contacts.findMany).mockResolvedValue([
        {
          id: 'contact-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@acme.com',
          title: 'CEO',
          createdAt: new Date('2024-01-02'),
        },
      ]);

      vi.mocked(db.query.deals.findMany).mockResolvedValue([
        {
          id: 'deal-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          name: 'Q1 Renewal',
          stage: 'Proposal',
          amount: '50000',
          probability: 80,
          closeDate: new Date('2024-03-31'),
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-20'),
        },
      ]);

      vi.mocked(db.query.tickets.findMany).mockResolvedValue([
        {
          id: 'ticket-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          subject: 'Login Issue',
          status: 'Open',
          priority: 'High',
          createdAt: new Date('2024-01-18'),
        },
      ]);

      const result = await assembleContext('account_health', 'org-1', 'tenant-1');

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

    it('routes deal_analysis to deal assembler', async () => {
      vi.mocked(db.query.deals.findMany).mockResolvedValue([
        {
          id: 'deal-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          name: 'Enterprise Deal',
          stage: 'Negotiation',
          amount: '100000',
          probability: 75,
          closeDate: new Date('2024-06-30'),
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-15'),
        },
      ]);

      vi.mocked(db.query.organizations.findMany).mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          name: 'Big Corp',
          industry: 'Finance',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]);

      vi.mocked(db.query.contacts.findMany).mockResolvedValue([
        {
          id: 'contact-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@bigcorp.com',
          createdAt: new Date('2023-01-10'),
        },
      ]);

      const result = await assembleContext('deal_analysis', 'deal-1', 'tenant-1');

      expect(result.contextData.deals).toHaveLength(1);
      expect(result.contextData.accounts).toHaveLength(1);
      expect(result.contextData.contacts).toHaveLength(1);

      expect(result.metadata.recordCounts).toEqual({
        deals: 1,
        accounts: 1,
        contacts: 1,
      });
    });

    it('throws error for unknown crew template', async () => {
      await expect(
        assembleContext('unknown_crew' as any, 'entity-1', 'tenant-1')
      ).rejects.toThrow('Unknown crew template: unknown_crew');
    });

    it('throws error for ticket_analysis (not yet implemented)', async () => {
      await expect(
        assembleContext('ticket_analysis', 'ticket-1', 'tenant-1')
      ).rejects.toThrow('Ticket analysis not yet implemented');
    });

    it('throws error when organization not found', async () => {
      vi.mocked(db.query.organizations.findMany).mockResolvedValue([]);

      await expect(
        assembleContext('account_health', 'nonexistent-org', 'tenant-1')
      ).rejects.toThrow('Organization nonexistent-org not found');
    });

    it('throws error when deal not found', async () => {
      vi.mocked(db.query.deals.findMany).mockResolvedValue([]);

      await expect(
        assembleContext('deal_analysis', 'nonexistent-deal', 'tenant-1')
      ).rejects.toThrow('Deal nonexistent-deal not found');
    });
  });

  describe('context assembly with options', () => {
    it('respects maxRecordsPerType option', async () => {
      // Create arrays with more records than the limit
      const manyContacts = Array.from({ length: 50 }, (_, i) => ({
        id: `contact-${i}`,
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        firstName: `User${i}`,
        lastName: 'Test',
        email: `user${i}@test.com`,
        createdAt: new Date(),
      }));

      vi.mocked(db.query.organizations.findMany).mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          name: 'Test Org',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(db.query.contacts.findMany).mockResolvedValue(manyContacts);
      vi.mocked(db.query.deals.findMany).mockResolvedValue([]);
      vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

      const result = await assembleContext('account_health', 'org-1', 'tenant-1', {
        maxRecordsPerType: 10,
      });

      // The contacts query should be called with limit parameter
      expect(db.query.contacts.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );

      // All contacts returned by mock should be included
      expect(result.contextData.contacts).toHaveLength(50);
    });

    it('handles null and undefined values in records gracefully', async () => {
      vi.mocked(db.query.organizations.findMany).mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          name: 'Minimal Org',
          industry: null, // Null value
          employeeCount: null,
          annualRevenue: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(db.query.contacts.findMany).mockResolvedValue([
        {
          id: 'contact-1',
          tenantId: 'tenant-1',
          organizationId: null, // Orphaned contact
          firstName: null,
          lastName: 'Doe',
          email: null,
          title: null,
          createdAt: new Date(),
        },
      ]);

      vi.mocked(db.query.deals.findMany).mockResolvedValue([]);
      vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

      const result = await assembleContext('account_health', 'org-1', 'tenant-1');

      // Should handle nulls without crashing
      expect(result.contextData.accounts).toHaveLength(1);
      expect(result.contextData.contacts).toHaveLength(1);

      // Check that null values are converted to undefined
      const account = result.contextData.accounts?.[0] as any;
      expect(account.industry).toBeUndefined();

      const contact = result.contextData.contacts?.[0] as any;
      expect(contact.name).toBe('Doe'); // Should handle null firstName
    });
  });

  describe('token estimation and pruning', () => {
    it('estimates tokens for context data', async () => {
      vi.mocked(db.query.organizations.findMany).mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          name: 'Acme Corp',
          industry: 'Technology',
          employeeCount: 500,
          annualRevenue: 10000000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(db.query.contacts.findMany).mockResolvedValue([]);
      vi.mocked(db.query.deals.findMany).mockResolvedValue([]);
      vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

      const result = await assembleContext('account_health', 'org-1', 'tenant-1');

      // Should have positive token estimate
      expect(result.metadata.estimatedTokens).toBeGreaterThan(0);

      // Token estimate should be roughly 1/4 of JSON string length
      const jsonLength = JSON.stringify(result.contextData).length;
      const expectedTokens = Math.ceil(jsonLength / 4);
      expect(result.metadata.estimatedTokens).toBe(expectedTokens);
    });

    it('marks pruned as true when pruning occurs', async () => {
      // Create very large context that will exceed maxTokens
      const manyDeals = Array.from({ length: 200 }, (_, i) => ({
        id: `deal-${i}`,
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        name: `Deal ${i}`,
        stage: 'Negotiation',
        amount: '100000',
        probability: 50,
        closeDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      vi.mocked(db.query.organizations.findMany).mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          name: 'Big Org',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(db.query.contacts.findMany).mockResolvedValue([]);
      vi.mocked(db.query.deals.findMany).mockResolvedValue(manyDeals);
      vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

      const result = await assembleContext('account_health', 'org-1', 'tenant-1', {
        maxTokens: 1000, // Very low limit to force pruning
      });

      // Should be marked as pruned
      expect(result.metadata.pruned).toBe(true);
      expect(result.metadata.prunedFields).toBeDefined();
      expect(result.metadata.prunedFields!.length).toBeGreaterThan(0);
    });
  });
});
