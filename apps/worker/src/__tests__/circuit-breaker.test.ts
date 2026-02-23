/**
 * Circuit Breaker Tests
 *
 * Tests for circuit breaker pattern implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOpenError,
  circuitBreakerRegistry,
  getCircuitBreaker,
  DEFAULT_CONFIG,
} from '../processor/circuit-breaker';

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000,
      halfOpenMaxCalls: 1,
    });
  });

  describe('Initial state', () => {
    it('starts in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('has zero failure count initially', () => {
      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
    });
  });

  describe('CLOSED → OPEN transition', () => {
    it('opens circuit after failure threshold', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Service error'));

      // Trigger failures up to threshold
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('Service error');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('allows requests until threshold is reached', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Service error'));

      // First 2 failures - still CLOSED
      await expect(breaker.execute(failingFn)).rejects.toThrow('Service error');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      await expect(breaker.execute(failingFn)).rejects.toThrow('Service error');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // 3rd failure - now OPEN
      await expect(breaker.execute(failingFn)).rejects.toThrow('Service error');
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('resets failure count on success', async () => {
      const failTwice = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('Success');

      // 2 failures
      await expect(breaker.execute(failTwice)).rejects.toThrow();
      await expect(breaker.execute(failTwice)).rejects.toThrow();

      // 1 success - resets count
      await breaker.execute(failTwice);
      expect(breaker.getMetrics().failureCount).toBe(0);

      // Now need 3 more failures to open
      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));
      await expect(breaker.execute(failingFn)).rejects.toThrow();
      await expect(breaker.execute(failingFn)).rejects.toThrow();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      await expect(breaker.execute(failingFn)).rejects.toThrow();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('OPEN state behavior', () => {
    beforeEach(async () => {
      // Trip the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Service error'));
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('rejects all requests immediately', async () => {
      const fn = vi.fn().mockResolvedValue('Should not be called');

      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenError);
      expect(fn).not.toHaveBeenCalled();
    });

    it('throws CircuitBreakerOpenError with service name', async () => {
      const fn = vi.fn();

      await expect(breaker.execute(fn)).rejects.toThrow(
        'Circuit breaker is OPEN for service: test-service'
      );
    });

    it('does not call underlying function', async () => {
      const fn = vi.fn().mockResolvedValue('Success');

      try {
        await breaker.execute(fn);
      } catch (error) {
        // Expected
      }

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('OPEN → HALF_OPEN transition', () => {
    beforeEach(async () => {
      // Trip the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Service error'));
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }
    });

    it('transitions to HALF_OPEN after timeout', async () => {
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next attempt should transition to HALF_OPEN
      const fn = vi.fn().mockResolvedValue('Success');
      await breaker.execute(fn);

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('remains OPEN before timeout elapses', async () => {
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait less than timeout
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fn = vi.fn();
      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenError);
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('HALF_OPEN state behavior', () => {
    beforeEach(async () => {
      // Trip the circuit and wait for timeout
      const failingFn = vi.fn().mockRejectedValue(new Error('Service error'));
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Transition to HALF_OPEN
      const fn = vi.fn().mockResolvedValue('Success');
      await breaker.execute(fn);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('allows limited concurrent calls', async () => {
      const slowFn = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('Success'), 100)));

      // First call should go through (limit is 1)
      const promise1 = breaker.execute(slowFn);

      // Second call should be rejected (concurrent limit reached)
      await expect(breaker.execute(vi.fn())).rejects.toThrow(CircuitBreakerOpenError);

      await promise1;
    });

    it('closes circuit after success threshold', async () => {
      const successFn = vi.fn().mockResolvedValue('Success');

      // Need 2 successes (successThreshold)
      await breaker.execute(successFn);
      expect(breaker.getState()).toBe(CircuitState.CLOSED); // First success closes it (was already transitioned to HALF_OPEN in beforeEach)
    });

    it('reopens circuit on any failure', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Service still down'));

      await expect(breaker.execute(failingFn)).rejects.toThrow('Service still down');
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Metrics', () => {
    it('tracks failure count', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));

      await expect(breaker.execute(failingFn)).rejects.toThrow();
      expect(breaker.getMetrics().failureCount).toBe(1);

      await expect(breaker.execute(failingFn)).rejects.toThrow();
      expect(breaker.getMetrics().failureCount).toBe(2);
    });

    it('tracks last failure time', async () => {
      const before = Date.now();
      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));

      await expect(breaker.execute(failingFn)).rejects.toThrow();

      const metrics = breaker.getMetrics();
      expect(metrics.lastFailureTime).toBeGreaterThanOrEqual(before);
      expect(metrics.lastFailureTime).toBeLessThanOrEqual(Date.now());
    });

    it('tracks success count in HALF_OPEN', async () => {
      // Trip circuit and wait
      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Transition to HALF_OPEN
      const successFn = vi.fn().mockResolvedValue('Success');
      await breaker.execute(successFn);

      expect(breaker.getMetrics().successCount).toBe(1);
    });

    it('tracks half-open concurrent calls', async () => {
      // Trip circuit and transition to HALF_OPEN
      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const slowFn = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('Success'), 100)));

      // Start concurrent call
      const promise = breaker.execute(slowFn);
      expect(breaker.getMetrics().halfOpenCalls).toBe(1);

      await promise;
      expect(breaker.getMetrics().halfOpenCalls).toBe(0);
    });
  });

  describe('Manual controls', () => {
    it('can manually reset circuit', async () => {
      // Trip circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Manually reset
      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getMetrics().failureCount).toBe(0);
    });

    it('can manually trip circuit', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.trip();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Circuit Breaker Registry', () => {
    beforeEach(() => {
      circuitBreakerRegistry.clear();
    });

    it('creates unique breakers per service', () => {
      const breaker1 = getCircuitBreaker('service-1');
      const breaker2 = getCircuitBreaker('service-2');

      expect(breaker1).not.toBe(breaker2);
    });

    it('returns same breaker for same service', () => {
      const breaker1 = getCircuitBreaker('service-1');
      const breaker2 = getCircuitBreaker('service-1');

      expect(breaker1).toBe(breaker2);
    });

    it('gets metrics for all breakers', async () => {
      const breaker1 = getCircuitBreaker('service-1');
      const breaker2 = getCircuitBreaker('service-2');

      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));
      await expect(breaker1.execute(failingFn)).rejects.toThrow();

      const metrics = circuitBreakerRegistry.getAllMetrics();

      expect(metrics['service-1']).toBeDefined();
      expect(metrics['service-1'].failureCount).toBe(1);
      expect(metrics['service-2']).toBeDefined();
      expect(metrics['service-2'].failureCount).toBe(0);
    });

    it('resets all breakers', async () => {
      const breaker1 = getCircuitBreaker('service-1', {
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 1000,
        halfOpenMaxCalls: 1,
      });
      const breaker2 = getCircuitBreaker('service-2', {
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 1000,
        halfOpenMaxCalls: 1,
      });

      // Trip both circuits
      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));
      for (let i = 0; i < 3; i++) {
        await expect(breaker1.execute(failingFn)).rejects.toThrow();
        await expect(breaker2.execute(failingFn)).rejects.toThrow();
      }

      expect(breaker1.getState()).toBe(CircuitState.OPEN);
      expect(breaker2.getState()).toBe(CircuitState.OPEN);

      // Reset all
      circuitBreakerRegistry.resetAll();

      expect(breaker1.getState()).toBe(CircuitState.CLOSED);
      expect(breaker2.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Configuration', () => {
    it('uses custom failure threshold', async () => {
      const customBreaker = new CircuitBreaker('custom-service', {
        failureThreshold: 5,
        successThreshold: 2,
        timeoutMs: 1000,
        halfOpenMaxCalls: 1,
      });

      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));

      // Should need 5 failures to open
      for (let i = 0; i < 4; i++) {
        await expect(customBreaker.execute(failingFn)).rejects.toThrow();
        expect(customBreaker.getState()).toBe(CircuitState.CLOSED);
      }

      await expect(customBreaker.execute(failingFn)).rejects.toThrow();
      expect(customBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('uses custom success threshold', async () => {
      const customBreaker = new CircuitBreaker('custom-service', {
        failureThreshold: 2,
        successThreshold: 3,
        timeoutMs: 100,
        halfOpenMaxCalls: 1,
      });

      // Trip circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Error'));
      for (let i = 0; i < 2; i++) {
        await expect(customBreaker.execute(failingFn)).rejects.toThrow();
      }
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Need 3 successes to close
      const successFn = vi.fn().mockResolvedValue('Success');

      await customBreaker.execute(successFn);
      expect(customBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      await customBreaker.execute(successFn);
      expect(customBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      await customBreaker.execute(successFn);
      expect(customBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('uses default config when not provided', () => {
      const defaultBreaker = new CircuitBreaker('default-service');
      expect(defaultBreaker.getMetrics()).toBeDefined();
    });
  });
});
