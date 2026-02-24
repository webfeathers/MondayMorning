/**
 * Integration tests for AI crew execution flow
 *
 * Tests the full flow from context assembly through cost estimation
 * to execution (with mocked executor)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assembleContext } from '../context-assembler';
import { estimateCost, checkBudget } from '../estimator';

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

/**
 * Mock AI Executor
 *
 * Simulates the behavior of the real CrewAI executor
 */
class MockAIExecutor {
  async execute(crewTemplateId: string, contextData: unknown) {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Return mock result based on crew type
    if (crewTemplateId === 'account_health') {
      return {
        status: 'completed',
        result: {
          health_score: 85,
          risk_level: 'low',
          engagement_level: 'high',
          recommendations: [
            'Continue current engagement strategy',
            'Schedule quarterly business review',
          ],
          deal_pipeline_health: {
            total_value: 500000,
            at_risk_deals: 0,
            strong_deals: 3,
          },
        },
        rawOutput: 'Account health analysis complete. Score: 85/100.',
        tokenUsage: {
          prompt_tokens: 5000,
          completion_tokens: 1200,
          total_tokens: 6200,
        },
        modelName: 'gpt-4o-mini',
        executionTimeSeconds: 15,
      };
    } else if (crewTemplateId === 'deal_analysis') {
      return {
        status: 'completed',
        result: {
          win_probability: 75,
          risk_factors: ['Long sales cycle', 'Multiple stakeholders'],
          strengths: ['Strong champion', 'Budget confirmed'],
          next_steps: ['Schedule demo', 'Send proposal'],
        },
        rawOutput: 'Deal analysis complete. Win probability: 75%.',
        tokenUsage: {
          prompt_tokens: 3000,
          completion_tokens: 800,
          total_tokens: 3800,
        },
        modelName: 'gpt-4o-mini',
        executionTimeSeconds: 10,
      };
    }

    throw new Error(`Unknown crew template: ${crewTemplateId}`);
  }
}

describe('AI Execution Integration', () => {
  let mockExecutor: MockAIExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutor = new MockAIExecutor();
  });

  describe('Full execution flow', () => {
    it('executes account health analysis end-to-end', async () => {
      // 1. Setup mock data
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
        {
          id: 'contact-2',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@acme.com',
          title: 'CTO',
          createdAt: new Date('2024-01-03'),
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
        {
          id: 'deal-2',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          name: 'Upsell Opportunity',
          stage: 'Negotiation',
          amount: '75000',
          probability: 60,
          closeDate: new Date('2024-04-30'),
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-25'),
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

      // 2. Assemble context
      const context = await assembleContext('account_health', 'org-1', 'tenant-1');

      expect(context.contextData.accounts).toHaveLength(1);
      expect(context.contextData.contacts).toHaveLength(2);
      expect(context.contextData.deals).toHaveLength(2);
      expect(context.contextData.tickets).toHaveLength(1);

      // 3. Estimate cost
      const estimate = estimateCost('account_health', context);

      expect(estimate.estimatedTokens).toBeGreaterThan(0);
      expect(estimate.estimatedCredits).toBeGreaterThan(0);

      // 4. Check budget
      const budgetCheck = checkBudget(estimate, 50000, 100, 60);

      expect(budgetCheck.withinBudget).toBe(true);
      expect(budgetCheck.violations).toHaveLength(0);

      // 5. Execute with mock executor
      const result = await mockExecutor.execute('account_health', context.contextData);

      expect(result.status).toBe('completed');
      expect(result.result.health_score).toBe(85);
      expect(result.tokenUsage.total_tokens).toBe(6200);
      expect(result.executionTimeSeconds).toBe(15);
    });

    it('executes deal analysis end-to-end', async () => {
      // 1. Setup mock data
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
          title: 'VP of Sales',
          createdAt: new Date('2023-01-10'),
        },
      ]);

      // 2. Assemble context
      const context = await assembleContext('deal_analysis', 'deal-1', 'tenant-1');

      // 3. Estimate cost
      const estimate = estimateCost('deal_analysis', context);

      // 4. Execute
      const result = await mockExecutor.execute('deal_analysis', context.contextData);

      expect(result.status).toBe('completed');
      expect(result.result.win_probability).toBe(75);
      expect(result.result.risk_factors).toHaveLength(2);
      expect(result.result.strengths).toHaveLength(2);
    });

    it('prevents execution when budget is exceeded', async () => {
      // Setup mock data
      vi.mocked(db.query.organizations.findMany).mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          name: 'Test Org',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(db.query.contacts.findMany).mockResolvedValue([]);
      vi.mocked(db.query.deals.findMany).mockResolvedValue([]);
      vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

      // Assemble context
      const context = await assembleContext('account_health', 'org-1', 'tenant-1');

      // Estimate cost
      const estimate = estimateCost('account_health', context);

      // Check budget with unrealistic limits
      const budgetCheck = checkBudget(estimate, 100, 1, 1);

      // Should fail budget check
      expect(budgetCheck.withinBudget).toBe(false);
      expect(budgetCheck.violations.length).toBeGreaterThan(0);

      // In real implementation, execution would be prevented here
      // Instead of actually executing, we verify the budget check caught it
    });

    it('handles context pruning gracefully in full flow', async () => {
      // Create very large dataset
      const manyDeals = Array.from({ length: 100 }, (_, i) => ({
        id: `deal-${i}`,
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        name: `Deal ${i}`,
        stage: 'Negotiation',
        amount: '50000',
        probability: 60,
        closeDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      vi.mocked(db.query.organizations.findMany).mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          name: 'Large Org',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(db.query.contacts.findMany).mockResolvedValue([]);
      vi.mocked(db.query.deals.findMany).mockResolvedValue(manyDeals);
      vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

      // Assemble context with tight token limit
      const context = await assembleContext('account_health', 'org-1', 'tenant-1', {
        maxTokens: 5000,
      });

      // Context should be pruned
      expect(context.metadata.pruned).toBe(true);
      expect(context.metadata.prunedFields).toBeDefined();

      // Estimate cost with pruned context
      const estimate = estimateCost('account_health', context);

      // Confidence should be lower due to pruning
      expect(estimate.confidence).toBe(0.7);

      // Should still be able to execute
      const result = await mockExecutor.execute('account_health', context.contextData);
      expect(result.status).toBe('completed');
    });
  });

  describe('Error handling', () => {
    it('handles organization not found', async () => {
      vi.mocked(db.query.organizations.findMany).mockResolvedValue([]);

      await expect(
        assembleContext('account_health', 'nonexistent-org', 'tenant-1')
      ).rejects.toThrow('Organization nonexistent-org not found');
    });

    it('handles deal not found', async () => {
      vi.mocked(db.query.deals.findMany).mockResolvedValue([]);

      await expect(
        assembleContext('deal_analysis', 'nonexistent-deal', 'tenant-1')
      ).rejects.toThrow('Deal nonexistent-deal not found');
    });

    it('handles unknown crew template in context assembly', async () => {
      await expect(
        assembleContext('unknown_crew' as any, 'entity-1', 'tenant-1')
      ).rejects.toThrow('Unknown crew template: unknown_crew');
    });

    it('handles unknown crew template in cost estimation', async () => {
      const context = {
        contextData: {},
        metadata: {
          recordCounts: {},
          estimatedTokens: 1000,
          pruned: false,
        },
      };

      expect(() => {
        estimateCost('unknown_crew' as any, context);
      }).toThrow('Unknown crew template: unknown_crew');
    });
  });

  describe('Performance considerations', () => {
    it('completes context assembly in reasonable time', async () => {
      vi.mocked(db.query.organizations.findMany).mockResolvedValue([
        {
          id: 'org-1',
          tenantId: 'tenant-1',
          name: 'Test Org',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.mocked(db.query.contacts.findMany).mockResolvedValue([]);
      vi.mocked(db.query.deals.findMany).mockResolvedValue([]);
      vi.mocked(db.query.tickets.findMany).mockResolvedValue([]);

      const startTime = Date.now();
      await assembleContext('account_health', 'org-1', 'tenant-1');
      const duration = Date.now() - startTime;

      // Context assembly should be fast (< 1 second in test environment)
      expect(duration).toBeLessThan(1000);
    });

    it('estimates cost quickly', () => {
      const context = {
        contextData: { accounts: [{}], contacts: [{}] },
        metadata: {
          recordCounts: { accounts: 1, contacts: 1 },
          estimatedTokens: 5000,
          pruned: false,
        },
      };

      const startTime = Date.now();
      estimateCost('account_health', context);
      const duration = Date.now() - startTime;

      // Cost estimation should be near-instant
      expect(duration).toBeLessThan(10);
    });
  });
});
