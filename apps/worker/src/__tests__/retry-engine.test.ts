/**
 * Retry Engine Tests
 *
 * Tests for exponential backoff retry logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateRetryDelay,
  calculateNextRetryTime,
  shouldRetryJob,
  getRetryScheduleDescription,
  BASE_DELAY_MS,
  MAX_DELAY_MS,
  JITTER_MS,
} from '../processor/retry-engine';

describe('Retry Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateRetryDelay', () => {
    it('calculates exponential backoff for attempt 1', () => {
      const delay = calculateRetryDelay(1, 1000, 300000, 0);
      expect(delay).toBe(2000); // 1000 * 2^1 = 2000ms
    });

    it('calculates exponential backoff for attempt 2', () => {
      const delay = calculateRetryDelay(2, 1000, 300000, 0);
      expect(delay).toBe(4000); // 1000 * 2^2 = 4000ms
    });

    it('calculates exponential backoff for attempt 3', () => {
      const delay = calculateRetryDelay(3, 1000, 300000, 0);
      expect(delay).toBe(8000); // 1000 * 2^3 = 8000ms
    });

    it('calculates exponential backoff for attempt 4', () => {
      const delay = calculateRetryDelay(4, 1000, 300000, 0);
      expect(delay).toBe(16000); // 1000 * 2^4 = 16000ms
    });

    it('calculates exponential backoff for attempt 5', () => {
      const delay = calculateRetryDelay(5, 1000, 300000, 0);
      expect(delay).toBe(32000); // 1000 * 2^5 = 32000ms
    });

    it('caps delay at maxDelayMs', () => {
      const delay = calculateRetryDelay(10, 1000, 300000, 0);
      expect(delay).toBe(300000); // 1000 * 2^10 = 1024000ms, capped at 300000ms
    });

    it('includes jitter in the result', () => {
      const delay = calculateRetryDelay(1, 1000, 300000, 1000);
      // Delay should be between 2000 (base) and 3000 (base + jitter)
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThan(3000);
    });

    it('uses default parameters when not provided', () => {
      const delay = calculateRetryDelay(1);
      // Default: BASE_DELAY_MS * 2^1 + jitter
      // Should be at least BASE_DELAY_MS * 2
      expect(delay).toBeGreaterThanOrEqual(BASE_DELAY_MS * 2);
      expect(delay).toBeLessThan(BASE_DELAY_MS * 2 + JITTER_MS);
    });

    it('handles attempt 0 (immediate retry)', () => {
      const delay = calculateRetryDelay(0, 1000, 300000, 0);
      expect(delay).toBe(1000); // 1000 * 2^0 = 1000ms
    });

    it('handles very high attempt numbers', () => {
      const delay = calculateRetryDelay(20, 1000, 300000, 0);
      expect(delay).toBe(300000); // Capped at maxDelayMs
    });
  });

  describe('calculateNextRetryTime', () => {
    it('returns a future Date object', () => {
      const before = Date.now();
      const nextRetry = calculateNextRetryTime(1, 1000, 300000, 0);
      const after = Date.now();

      expect(nextRetry).toBeInstanceOf(Date);
      expect(nextRetry.getTime()).toBeGreaterThan(before);
      expect(nextRetry.getTime()).toBeLessThanOrEqual(after + 2000); // 1000 * 2^1
    });

    it('calculates correct time for attempt 1', () => {
      const before = Date.now();
      const nextRetry = calculateNextRetryTime(1, 1000, 300000, 0);
      const delay = nextRetry.getTime() - before;

      // Should be ~2000ms in the future
      expect(delay).toBeGreaterThanOrEqual(1900); // Allow some execution time
      expect(delay).toBeLessThanOrEqual(2100);
    });

    it('calculates correct time for attempt 3', () => {
      const before = Date.now();
      const nextRetry = calculateNextRetryTime(3, 1000, 300000, 0);
      const delay = nextRetry.getTime() - before;

      // Should be ~8000ms in the future
      expect(delay).toBeGreaterThanOrEqual(7900);
      expect(delay).toBeLessThanOrEqual(8100);
    });

    it('uses default parameters when not provided', () => {
      const before = Date.now();
      const nextRetry = calculateNextRetryTime(1);
      const delay = nextRetry.getTime() - before;

      // Should be at least BASE_DELAY_MS * 2 in the future
      expect(delay).toBeGreaterThanOrEqual(BASE_DELAY_MS * 2 - 100);
      expect(delay).toBeLessThanOrEqual(BASE_DELAY_MS * 2 + JITTER_MS + 100);
    });
  });

  describe('shouldRetryJob', () => {
    it('returns true if attempts < maxAttempts', () => {
      expect(shouldRetryJob(1, 3)).toBe(true);
      expect(shouldRetryJob(2, 3)).toBe(true);
    });

    it('returns false if attempts >= maxAttempts', () => {
      expect(shouldRetryJob(3, 3)).toBe(false);
      expect(shouldRetryJob(4, 3)).toBe(false);
    });

    it('handles edge case of 0 attempts', () => {
      expect(shouldRetryJob(0, 3)).toBe(true);
    });

    it('handles edge case of 0 maxAttempts', () => {
      expect(shouldRetryJob(0, 0)).toBe(false);
      expect(shouldRetryJob(1, 0)).toBe(false);
    });

    it('handles edge case of 1 maxAttempt', () => {
      expect(shouldRetryJob(0, 1)).toBe(true);
      expect(shouldRetryJob(1, 1)).toBe(false);
    });
  });

  describe('getRetryScheduleDescription', () => {
    it('returns schedule descriptions for 3 attempts', () => {
      const schedule = getRetryScheduleDescription(3, 1000, 300000);

      expect(schedule).toHaveLength(3);
      expect(schedule[0]).toBe('Attempt 1: retry after ~2s');
      expect(schedule[1]).toBe('Attempt 2: retry after ~4s');
      expect(schedule[2]).toBe('Attempt 3: retry after ~8s');
    });

    it('formats delays in seconds correctly', () => {
      const schedule = getRetryScheduleDescription(3, 500, 300000);

      expect(schedule[0]).toBe('Attempt 1: retry after ~1s');
      expect(schedule[1]).toBe('Attempt 2: retry after ~2s');
      expect(schedule[2]).toBe('Attempt 3: retry after ~4s');
    });

    it('formats delays in minutes correctly', () => {
      const schedule = getRetryScheduleDescription(5, 5000, 300000);

      expect(schedule[0]).toBe('Attempt 1: retry after ~10s');
      expect(schedule[1]).toBe('Attempt 2: retry after ~20s');
      expect(schedule[2]).toBe('Attempt 3: retry after ~40s');
      expect(schedule[3]).toBe('Attempt 4: retry after ~1.3m');
      expect(schedule[4]).toBe('Attempt 5: retry after ~2.7m');
    });

    it('shows capped delays for high attempt numbers', () => {
      const schedule = getRetryScheduleDescription(10, 1000, 60000);

      // Attempts 7+ should be capped at 60000ms = 60s = 1m
      expect(schedule[6]).toMatch(/~1\.0m/);
      expect(schedule[7]).toMatch(/~1\.0m/);
      expect(schedule[8]).toMatch(/~1\.0m/);
      expect(schedule[9]).toMatch(/~1\.0m/);
    });

    it('uses default parameters when not provided', () => {
      const schedule = getRetryScheduleDescription(2);

      expect(schedule).toHaveLength(2);
      expect(schedule[0]).toMatch(/Attempt 1: retry after/);
      expect(schedule[1]).toMatch(/Attempt 2: retry after/);
    });

    it('handles empty schedule (0 attempts)', () => {
      const schedule = getRetryScheduleDescription(0);
      expect(schedule).toHaveLength(0);
    });

    it('handles single attempt', () => {
      const schedule = getRetryScheduleDescription(1, 1000, 300000);
      expect(schedule).toHaveLength(1);
      expect(schedule[0]).toBe('Attempt 1: retry after ~2s');
    });
  });

  describe('Integration - Full retry flow', () => {
    it('simulates 3 retries with increasing delays', () => {
      const maxAttempts = 3;
      const attempts: number[] = [];
      const delays: number[] = [];

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attempts.push(attempt);
        delays.push(calculateRetryDelay(attempt, 1000, 300000, 0));
      }

      // Verify exponential growth
      expect(delays[0]).toBe(2000);
      expect(delays[1]).toBe(4000);
      expect(delays[2]).toBe(8000);

      // Verify each delay is ~2x the previous
      expect(delays[1]).toBeCloseTo(delays[0] * 2, 0);
      expect(delays[2]).toBeCloseTo(delays[1] * 2, 0);
    });

    it('simulates retry decision flow', () => {
      const maxAttempts = 3;
      const results: { attempt: number; shouldRetry: boolean; nextDelay?: number }[] = [];

      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        const canRetry = shouldRetryJob(attempt, maxAttempts);
        const entry: any = { attempt, shouldRetry: canRetry };

        if (canRetry) {
          entry.nextDelay = calculateRetryDelay(attempt, 1000, 300000, 0);
        }

        results.push(entry);
      }

      // Verify attempt 0 can retry
      expect(results[0].shouldRetry).toBe(true);
      expect(results[0].nextDelay).toBeDefined();

      // Verify attempts 1-2 can retry
      expect(results[1].shouldRetry).toBe(true);
      expect(results[1].nextDelay).toBeDefined();
      expect(results[2].shouldRetry).toBe(true);
      expect(results[2].nextDelay).toBeDefined();

      // Verify attempt 3 cannot retry (reached maxAttempts)
      expect(results[3].shouldRetry).toBe(false);
      expect(results[3].nextDelay).toBeUndefined();
    });
  });
});
