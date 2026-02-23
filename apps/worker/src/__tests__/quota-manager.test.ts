/**
 * Quota Manager Tests
 *
 * Tests for CRM API quota management and enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  QuotaManager,
  QuotaLevel,
  QuotaExhaustedError,
  enforceQuota,
  quotaManager,
  DEFAULT_QUOTA_CONFIG,
} from '../processor/quota-manager';
import type { RateLimitStatus } from '@wf/integrations';

describe('Quota Manager', () => {
  let manager: QuotaManager;

  beforeEach(() => {
    manager = new QuotaManager({
      warningThreshold: 0.25,  // 25%
      criticalThreshold: 0.10, // 10%
    });
  });

  describe('Quota level determination', () => {
    it('returns NORMAL when > 25% remaining', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50, // 50% used, 50% remaining
      };

      const result = manager.checkQuota('salesforce', status);
      expect(result.level).toBe(QuotaLevel.NORMAL);
      expect(result.canProceed).toBe(true);
    });

    it('returns WARNING when between 10-25% remaining', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 200,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.80, // 80% used, 20% remaining
      };

      const result = manager.checkQuota('salesforce', status);
      expect(result.level).toBe(QuotaLevel.WARNING);
      expect(result.canProceed).toBe(true);
      expect(result.message).toContain('WARNING');
    });

    it('returns CRITICAL when < 10% remaining', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 50,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.95, // 95% used, 5% remaining
      };

      const result = manager.checkQuota('salesforce', status);
      expect(result.level).toBe(QuotaLevel.CRITICAL);
      expect(result.canProceed).toBe(false);
      expect(result.shouldWait).toBe(true);
      expect(result.waitUntil).toBeInstanceOf(Date);
    });

    it('returns CRITICAL at exactly 10% remaining', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 100,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.90, // 90% used, 10% remaining
      };

      const result = manager.checkQuota('salesforce', status);
      expect(result.level).toBe(QuotaLevel.CRITICAL);
      expect(result.canProceed).toBe(false);
    });

    it('returns WARNING at exactly 25% remaining', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 250,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.75, // 75% used, 25% remaining
      };

      const result = manager.checkQuota('salesforce', status);
      expect(result.level).toBe(QuotaLevel.WARNING);
      expect(result.canProceed).toBe(true);
    });
  });

  describe('Quota check results', () => {
    it('includes status information', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      const result = manager.checkQuota('salesforce', status);

      expect(result.status).toEqual(status);
      expect(result.message).toBeDefined();
      expect(result.level).toBeDefined();
    });

    it('includes waitUntil when critical', () => {
      const resetAt = new Date(Date.now() + 3600000).toISOString();
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 50,
        resetAt,
        percentUsed: 0.95,
      };

      const result = manager.checkQuota('salesforce', status);

      expect(result.waitUntil).toBeInstanceOf(Date);
      expect(result.waitUntil?.toISOString()).toBe(resetAt);
    });

    it('formats message with quota information', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 200,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.80,
      };

      const result = manager.checkQuota('salesforce', status);

      expect(result.message).toContain('200/1000');
      expect(result.message).toContain('80%');
    });
  });

  describe('Status caching', () => {
    it('caches quota status for providers', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      manager.checkQuota('salesforce', status);

      const cached = manager.getLastStatus('salesforce');
      expect(cached).toEqual(status);
    });

    it('returns null for uncached providers', () => {
      const cached = manager.getLastStatus('hubspot');
      expect(cached).toBeNull();
    });

    it('caches multiple providers separately', () => {
      const sfStatus: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      const hsStatus: RateLimitStatus = {
        limit: 5000,
        remaining: 2000,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.60,
      };

      manager.checkQuota('salesforce', sfStatus);
      manager.checkQuota('hubspot', hsStatus);

      expect(manager.getLastStatus('salesforce')).toEqual(sfStatus);
      expect(manager.getLastStatus('hubspot')).toEqual(hsStatus);
    });

    it('returns all cached statuses', () => {
      const sfStatus: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      manager.checkQuota('salesforce', sfStatus);

      const all = manager.getAllStatuses();
      expect(all['salesforce']).toBeDefined();
      expect(all['salesforce'].status).toEqual(sfStatus);
      expect(all['salesforce'].checkedAt).toBeInstanceOf(Date);
    });

    it('clears status for a provider', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      manager.checkQuota('salesforce', status);
      expect(manager.getLastStatus('salesforce')).not.toBeNull();

      manager.clearStatus('salesforce');
      expect(manager.getLastStatus('salesforce')).toBeNull();
    });

    it('clears all cached statuses', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      manager.checkQuota('salesforce', status);
      manager.checkQuota('hubspot', status);

      manager.clearAll();

      expect(manager.getLastStatus('salesforce')).toBeNull();
      expect(manager.getLastStatus('hubspot')).toBeNull();
    });
  });

  describe('Static helpers', () => {
    it('calculates delay until reset', () => {
      const resetAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      const delay = QuotaManager.calculateDelayUntilReset(resetAt);

      expect(delay).toBeGreaterThan(3590000); // ~59.8 minutes
      expect(delay).toBeLessThanOrEqual(3600000); // 1 hour
    });

    it('returns 0 for past reset times', () => {
      const resetAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const delay = QuotaManager.calculateDelayUntilReset(resetAt);

      expect(delay).toBe(0);
    });

    it('formats quota status as human-readable string', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      const formatted = QuotaManager.formatQuotaStatus(status);

      expect(formatted).toContain('500/1000');
      expect(formatted).toContain('50%');
      expect(formatted).toMatch(/\d+ minutes/);
    });
  });

  describe('QuotaExhaustedError', () => {
    it('creates error with provider and status information', () => {
      const resetAt = new Date(Date.now() + 3600000);
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 50,
        resetAt: resetAt.toISOString(),
        percentUsed: 0.95,
      };

      const error = new QuotaExhaustedError('salesforce', status, resetAt);

      expect(error.name).toBe('QuotaExhaustedError');
      expect(error.provider).toBe('salesforce');
      expect(error.status).toEqual(status);
      expect(error.resetAt).toEqual(resetAt);
      expect(error.message).toContain('salesforce');
      expect(error.message).toContain('50/1000');
    });
  });

  describe('enforceQuota helper', () => {
    it('returns result when quota is available', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      const result = enforceQuota('salesforce', status);

      expect(result.canProceed).toBe(true);
      expect(result.level).toBe(QuotaLevel.NORMAL);
    });

    it('throws QuotaExhaustedError when quota is critical', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 50,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.95,
      };

      expect(() => enforceQuota('salesforce', status)).toThrow(QuotaExhaustedError);
    });

    it('uses singleton quota manager', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 500,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      // Clear any cached status
      quotaManager.clearAll();

      enforceQuota('salesforce', status);

      // Check that it was cached in the singleton
      const cached = quotaManager.getLastStatus('salesforce');
      expect(cached).toEqual(status);
    });
  });

  describe('Custom configuration', () => {
    it('uses custom warning threshold', () => {
      const customManager = new QuotaManager({
        warningThreshold: 0.50, // 50%
        criticalThreshold: 0.10,
      });

      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 400,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.60, // 60% used, 40% remaining (below 50% threshold)
      };

      const result = customManager.checkQuota('salesforce', status);

      expect(result.level).toBe(QuotaLevel.WARNING);
    });

    it('uses custom critical threshold', () => {
      const customManager = new QuotaManager({
        warningThreshold: 0.25,
        criticalThreshold: 0.20, // 20%
      });

      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 150,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.85, // 85% used, 15% remaining (below 20% threshold)
      };

      const result = customManager.checkQuota('salesforce', status);

      expect(result.level).toBe(QuotaLevel.CRITICAL);
      expect(result.canProceed).toBe(false);
    });

    it('uses default config when not provided', () => {
      const defaultManager = new QuotaManager();
      expect(defaultManager).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('handles 0 remaining quota', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 0,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 1.0,
      };

      const result = manager.checkQuota('salesforce', status);

      expect(result.level).toBe(QuotaLevel.CRITICAL);
      expect(result.canProceed).toBe(false);
    });

    it('handles 100% available quota', () => {
      const status: RateLimitStatus = {
        limit: 1000,
        remaining: 1000,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.0,
      };

      const result = manager.checkQuota('salesforce', status);

      expect(result.level).toBe(QuotaLevel.NORMAL);
      expect(result.canProceed).toBe(true);
    });

    it('handles very small limits', () => {
      const status: RateLimitStatus = {
        limit: 10,
        remaining: 5,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      const result = manager.checkQuota('salesforce', status);

      expect(result.level).toBe(QuotaLevel.NORMAL);
      expect(result.message).toContain('5/10');
    });

    it('handles very large limits', () => {
      const status: RateLimitStatus = {
        limit: 1000000,
        remaining: 500000,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        percentUsed: 0.50,
      };

      const result = manager.checkQuota('salesforce', status);

      expect(result.level).toBe(QuotaLevel.NORMAL);
      expect(result.message).toContain('500000/1000000');
    });
  });
});
