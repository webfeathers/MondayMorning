/**
 * Tests for AI cost estimator.
 */

import { describe, it, expect } from 'vitest';
import { estimateCost, checkBudget, formatCostEstimate } from '@/lib/ai/estimator';
import type { AssembledContext } from '@/lib/ai/types';

describe('estimateCost', () => {
  it('estimates cost for account health crew', () => {
    const assembledContext: AssembledContext = {
      contextData: {
        accounts: [],
        contacts: [],
        deals: [],
        tickets: [],
      },
      metadata: {
        recordCounts: { accounts: 1, contacts: 5, deals: 3, tickets: 2 },
        estimatedTokens: 5000,
        pruned: false,
      },
    };

    const estimate = estimateCost('account_health', assembledContext);

    expect(estimate.estimatedTokens).toBe(9000); // 5000 + 2000 + 1500 + 500
    expect(estimate.estimatedCredits).toBe(9); // ceil(9000 / 1000)
    expect(estimate.estimatedTimeSeconds).toBeGreaterThanOrEqual(5);
    expect(estimate.confidence).toBe(0.85); // Not pruned
    expect(estimate.breakdown.contextTokens).toBe(5000);
    expect(estimate.breakdown.systemPromptTokens).toBe(2000);
    expect(estimate.breakdown.expectedOutputTokens).toBe(1500);
    expect(estimate.breakdown.overhead).toBe(500);
  });

  it('estimates cost for deal analysis crew', () => {
    const assembledContext: AssembledContext = {
      contextData: { deals: [], accounts: [], contacts: [] },
      metadata: {
        recordCounts: { deals: 1, accounts: 1, contacts: 3 },
        estimatedTokens: 2000,
        pruned: false,
      },
    };

    const estimate = estimateCost('deal_analysis', assembledContext);

    expect(estimate.estimatedTokens).toBe(5000); // 2000 + 1500 + 1000 + 500
    expect(estimate.estimatedCredits).toBe(5);
    expect(estimate.confidence).toBe(0.85);
  });

  it('reduces confidence when context is pruned', () => {
    const assembledContext: AssembledContext = {
      contextData: {},
      metadata: {
        recordCounts: {},
        estimatedTokens: 10000,
        pruned: true,
        prunedFields: ['tickets.description'],
      },
    };

    const estimate = estimateCost('account_health', assembledContext);

    expect(estimate.confidence).toBe(0.7); // Lower confidence due to pruning
  });

  it('ensures minimum execution time of 5 seconds', () => {
    const assembledContext: AssembledContext = {
      contextData: {},
      metadata: {
        recordCounts: {},
        estimatedTokens: 100, // Very small context
        pruned: false,
      },
    };

    const estimate = estimateCost('account_health', assembledContext);

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

    expect(() =>
      estimateCost('unknown_crew' as any, assembledContext)
    ).toThrow('Unknown crew template');
  });
});

describe('checkBudget', () => {
  const estimate = {
    estimatedTokens: 10000,
    estimatedCredits: 10,
    estimatedTimeSeconds: 20,
    confidence: 0.85,
    breakdown: {
      contextTokens: 5000,
      systemPromptTokens: 2000,
      expectedOutputTokens: 1500,
      overhead: 500,
    },
  };

  it('passes when within all budgets', () => {
    const result = checkBudget(estimate, 15000, 20, 30);

    expect(result.withinBudget).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects token budget violation', () => {
    const result = checkBudget(estimate, 5000);

    expect(result.withinBudget).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('Estimated tokens');
    expect(result.violations[0]).toContain('exceeds limit');
  });

  it('detects credit budget violation', () => {
    const result = checkBudget(estimate, undefined, 5);

    expect(result.withinBudget).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('Estimated credits');
  });

  it('detects time budget violation', () => {
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

  it('passes when no limits specified', () => {
    const result = checkBudget(estimate);

    expect(result.withinBudget).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

describe('formatCostEstimate', () => {
  it('formats cost estimate as readable text', () => {
    const estimate = {
      estimatedTokens: 10000,
      estimatedCredits: 10,
      estimatedTimeSeconds: 20,
      confidence: 0.85,
      breakdown: {
        contextTokens: 5000,
        systemPromptTokens: 2000,
        expectedOutputTokens: 1500,
        overhead: 1500,
      },
    };

    const formatted = formatCostEstimate(estimate);

    expect(formatted).toContain('Estimated Tokens: 10,000');
    expect(formatted).toContain('Estimated Credits: 10');
    expect(formatted).toContain('Estimated Time: 20s');
    expect(formatted).toContain('Confidence: 85%');
    expect(formatted).toContain('Context: 5,000 tokens');
    expect(formatted).toContain('System Prompts: 2,000 tokens');
    expect(formatted).toContain('Expected Output: 1,500 tokens');
    expect(formatted).toContain('Overhead: 1,500 tokens');
  });
});
