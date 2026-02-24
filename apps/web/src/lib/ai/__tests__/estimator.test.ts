/**
 * Tests for AI cost estimation
 */

import { describe, it, expect } from 'vitest';
import { estimateCost, checkBudget, formatCostEstimate } from '../estimator';
import type { AssembledContext } from '../types';

describe('AI Cost Estimator', () => {
  describe('estimateCost', () => {
    it('estimates cost for account_health crew correctly', () => {
      const assembledContext: AssembledContext = {
        contextData: {
          accounts: [{}, {}],
          contacts: [{}, {}, {}],
          deals: [{}],
          tickets: [{}, {}],
        },
        metadata: {
          recordCounts: { accounts: 2, contacts: 3, deals: 1, tickets: 2 },
          estimatedTokens: 5000, // Context tokens
          pruned: false,
        },
      };

      const estimate = estimateCost('account_health', assembledContext);

      // Context (5000) + System Prompt (2000) + Expected Output (1500) + Overhead (500) = 9000
      expect(estimate.estimatedTokens).toBe(9000);

      // 9000 tokens / 1000 * 1 credit = 9 credits
      expect(estimate.estimatedCredits).toBe(9);

      // 9000 tokens / 500 tokens per second = 18 seconds
      expect(estimate.estimatedTimeSeconds).toBe(18);

      // High confidence since not pruned
      expect(estimate.confidence).toBe(0.85);

      // Check breakdown
      expect(estimate.breakdown.contextTokens).toBe(5000);
      expect(estimate.breakdown.systemPromptTokens).toBe(2000);
      expect(estimate.breakdown.expectedOutputTokens).toBe(1500);
      expect(estimate.breakdown.overhead).toBe(500);
    });

    it('estimates cost for deal_analysis crew correctly', () => {
      const assembledContext: AssembledContext = {
        contextData: {
          deals: [{}],
          accounts: [{}],
          contacts: [{}, {}],
        },
        metadata: {
          recordCounts: { deals: 1, accounts: 1, contacts: 2 },
          estimatedTokens: 3000,
          pruned: false,
        },
      };

      const estimate = estimateCost('deal_analysis', assembledContext);

      // Context (3000) + System Prompt (1500) + Expected Output (1000) + Overhead (500) = 6000
      expect(estimate.estimatedTokens).toBe(6000);
      expect(estimate.estimatedCredits).toBe(6);
      expect(estimate.estimatedTimeSeconds).toBe(12);
    });

    it('reduces confidence when context is pruned', () => {
      const assembledContext: AssembledContext = {
        contextData: { accounts: [{}] },
        metadata: {
          recordCounts: { accounts: 1 },
          estimatedTokens: 10000,
          pruned: true, // Context was pruned
          prunedFields: ['activities', 'deals (limited)'],
        },
      };

      const estimate = estimateCost('account_health', assembledContext);

      // Lower confidence due to pruning
      expect(estimate.confidence).toBe(0.7);
    });

    it('enforces minimum execution time of 5 seconds', () => {
      const assembledContext: AssembledContext = {
        contextData: { deals: [{}] },
        metadata: {
          recordCounts: { deals: 1 },
          estimatedTokens: 100, // Very small context
          pruned: false,
        },
      };

      const estimate = estimateCost('account_health', assembledContext);

      // Should be at least 5 seconds even for small contexts
      expect(estimate.estimatedTimeSeconds).toBeGreaterThanOrEqual(5);
    });

    it('throws error for unknown crew template', () => {
      const assembledContext: AssembledContext = {
        contextData: {},
        metadata: {
          recordCounts: {},
          estimatedTokens: 1000,
          pruned: false,
        },
      };

      expect(() => {
        estimateCost('unknown_crew' as any, assembledContext);
      }).toThrow('Unknown crew template: unknown_crew');
    });
  });

  describe('checkBudget', () => {
    const estimate = {
      estimatedTokens: 10000,
      estimatedCredits: 10,
      estimatedTimeSeconds: 20,
      confidence: 0.85,
      breakdown: {
        contextTokens: 6000,
        systemPromptTokens: 2000,
        expectedOutputTokens: 1500,
        overhead: 500,
      },
    };

    it('returns within budget when all limits are met', () => {
      const result = checkBudget(estimate, 15000, 15, 30);

      expect(result.withinBudget).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('detects token limit violation', () => {
      const result = checkBudget(estimate, 5000);

      expect(result.withinBudget).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('Estimated tokens');
      expect(result.violations[0]).toContain('10000');
      expect(result.violations[0]).toContain('5000');
    });

    it('detects credit limit violation', () => {
      const result = checkBudget(estimate, undefined, 5);

      expect(result.withinBudget).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('Estimated credits');
    });

    it('detects time limit violation', () => {
      const result = checkBudget(estimate, undefined, undefined, 10);

      expect(result.withinBudget).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('Estimated time');
    });

    it('detects multiple violations', () => {
      const result = checkBudget(estimate, 5000, 5, 10);

      expect(result.withinBudget).toBe(false);
      expect(result.violations).toHaveLength(3);
    });

    it('allows execution when no limits are specified', () => {
      const result = checkBudget(estimate);

      expect(result.withinBudget).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('formatCostEstimate', () => {
    it('formats estimate as readable string', () => {
      const estimate = {
        estimatedTokens: 10000,
        estimatedCredits: 10,
        estimatedTimeSeconds: 20,
        confidence: 0.85,
        breakdown: {
          contextTokens: 6000,
          systemPromptTokens: 2000,
          expectedOutputTokens: 1500,
          overhead: 500,
        },
      };

      const formatted = formatCostEstimate(estimate);

      expect(formatted).toContain('Estimated Tokens: 10,000');
      expect(formatted).toContain('Estimated Credits: 10');
      expect(formatted).toContain('Estimated Time: 20s');
      expect(formatted).toContain('Confidence: 85%');
      expect(formatted).toContain('Context: 6,000 tokens');
      expect(formatted).toContain('System Prompts: 2,000 tokens');
      expect(formatted).toContain('Expected Output: 1,500 tokens');
      expect(formatted).toContain('Overhead: 500 tokens');
    });

    it('formats large numbers with commas', () => {
      const estimate = {
        estimatedTokens: 150000,
        estimatedCredits: 150,
        estimatedTimeSeconds: 300,
        confidence: 0.7,
        breakdown: {
          contextTokens: 145000,
          systemPromptTokens: 2000,
          expectedOutputTokens: 2500,
          overhead: 500,
        },
      };

      const formatted = formatCostEstimate(estimate);

      expect(formatted).toContain('150,000');
      expect(formatted).toContain('145,000');
    });
  });
});
