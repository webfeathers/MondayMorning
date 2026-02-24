/**
 * Tests for AI usage tracking
 */

import { describe, it, expect } from 'vitest';
import { calculateCost, calculateCredits } from '../usage-tracker';

describe('AI Usage Tracker', () => {
  describe('calculateCost', () => {
    it('calculates cost for Claude Sonnet correctly', () => {
      const cost = calculateCost('claude-sonnet-4-20250514', {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      });

      // $3 per 1M input + $15 per 1M output
      // (1000 / 1M) * 3 + (500 / 1M) * 15
      // = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('calculates cost for Gemini Flash correctly', () => {
      const cost = calculateCost('gemini-2.0-flash', {
        prompt_tokens: 10000,
        completion_tokens: 5000,
        total_tokens: 15000,
      });

      // $0.075 per 1M input + $0.3 per 1M output
      // (10000 / 1M) * 0.075 + (5000 / 1M) * 0.3
      // = 0.00075 + 0.0015 = 0.00225
      expect(cost).toBeCloseTo(0.00225, 5);
    });

    it('uses default pricing for unknown models', () => {
      const cost = calculateCost('unknown-model', {
        prompt_tokens: 1000,
        completion_tokens: 1000,
        total_tokens: 2000,
      });

      // Default: $1 per 1M input + $3 per 1M output
      // (1000 / 1M) * 1 + (1000 / 1M) * 3
      // = 0.001 + 0.003 = 0.004
      expect(cost).toBeCloseTo(0.004, 4);
    });
  });

  describe('calculateCredits', () => {
    it('calculates credits based on total tokens', () => {
      expect(calculateCredits(999)).toBe(1); // < 1K tokens = 1 credit
      expect(calculateCredits(1000)).toBe(1); // 1K tokens = 1 credit
      expect(calculateCredits(1001)).toBe(2); // > 1K tokens = 2 credits
      expect(calculateCredits(5500)).toBe(6); // 5.5K tokens = 6 credits (rounded up)
      expect(calculateCredits(10000)).toBe(10); // 10K tokens = 10 credits
    });

    it('handles zero tokens', () => {
      expect(calculateCredits(0)).toBe(0);
    });
  });
});
