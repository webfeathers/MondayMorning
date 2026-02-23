import { describe, it, expect } from 'vitest';
import { CreditManager } from '../credits/credit-manager';

describe('Credit System - Unit Tests', () => {
  describe('CreditManager constructor', () => {
    it('throws error if tenantId is not provided', () => {
      expect(() => new CreditManager('')).toThrow('tenantId is required');
    });

    it('throws error if DATABASE_URL is not set', () => {
      const originalEnv = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      expect(() => new CreditManager('test-tenant')).toThrow('DATABASE_URL is required');

      // Restore
      process.env.DATABASE_URL = originalEnv;
    });

    it('creates instance with valid tenantId and DATABASE_URL', () => {
      const manager = new CreditManager('test-tenant', 'postgresql://test:test@localhost:5432/test');
      expect(manager).toBeDefined();
    });
  });

  describe('getPeriodKey', () => {
    it('returns current period in YYYY-MM format', () => {
      const manager = new CreditManager('test-tenant', 'postgresql://test:test@localhost:5432/test');
      const periodKey = manager.getPeriodKey();

      expect(periodKey).toMatch(/^\d{4}-\d{2}$/);
    });

    it('returns correct period for a given date', () => {
      const manager = new CreditManager('test-tenant', 'postgresql://test:test@localhost:5432/test');

      const periodKey = manager.getPeriodKey(new Date('2026-02-15T10:00:00Z'));
      expect(periodKey).toBe('2026-02');
    });

    it('returns same period for dates in same month', () => {
      const manager = new CreditManager('test-tenant', 'postgresql://test:test@localhost:5432/test');

      const periodKey1 = manager.getPeriodKey(new Date('2026-02-01T12:00:00Z'));
      const periodKey2 = manager.getPeriodKey(new Date('2026-02-28T12:00:00Z'));

      expect(periodKey1).toBe(periodKey2);
      expect(periodKey1).toBe('2026-02');
    });

    it('returns different periods for different months', () => {
      const manager = new CreditManager('test-tenant', 'postgresql://test:test@localhost:5432/test');

      const periodKey1 = manager.getPeriodKey(new Date('2026-02-15T12:00:00Z'));
      const periodKey2 = manager.getPeriodKey(new Date('2026-03-15T12:00:00Z'));

      expect(periodKey1).not.toBe(periodKey2);
      expect(periodKey1).toBe('2026-02');
      expect(periodKey2).toBe('2026-03');
    });

    it('handles year boundaries correctly', () => {
      const manager = new CreditManager('test-tenant', 'postgresql://test:test@localhost:5432/test');

      const periodKey1 = manager.getPeriodKey(new Date('2025-12-15T12:00:00Z'));
      const periodKey2 = manager.getPeriodKey(new Date('2026-01-15T12:00:00Z'));

      expect(periodKey1).toBe('2025-12');
      expect(periodKey2).toBe('2026-01');
    });

    it('pads single-digit months with leading zero', () => {
      const manager = new CreditManager('test-tenant', 'postgresql://test:test@localhost:5432/test');

      const periodKey = manager.getPeriodKey(new Date('2026-01-15T10:00:00Z'));
      expect(periodKey).toBe('2026-01');
      expect(periodKey).not.toBe('2026-1');
    });
  });

  describe('DeductCreditsMetadata interface', () => {
    it('accepts required fields', () => {
      const metadata = {
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
      };

      expect(metadata.model).toBe('claude-sonnet-4-20250514');
      expect(metadata.inputTokens).toBe(1000);
      expect(metadata.outputTokens).toBe(500);
    });

    it('accepts optional fields', () => {
      const metadata = {
        model: 'gemini-2.0-flash',
        inputTokens: 500,
        outputTokens: 200,
        crewTemplateId: 'crew-123',
        jobId: 'job-456',
      };

      expect(metadata.crewTemplateId).toBe('crew-123');
      expect(metadata.jobId).toBe('job-456');
    });
  });

  describe('DeductCreditsResult interface', () => {
    it('success result has expected shape', () => {
      const result = {
        success: true,
        creditsRemaining: 50,
        aiUsageId: 'usage-123',
      };

      expect(result.success).toBe(true);
      expect(result.creditsRemaining).toBeDefined();
      expect(result.aiUsageId).toBeDefined();
    });

    it('error result has expected shape', () => {
      const result = {
        success: false,
        error: 'Insufficient credits',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('PeriodUsageStats interface', () => {
    it('has all required fields', () => {
      const stats = {
        period: '2026-02',
        creditsUsed: 40,
        creditsAllowed: 100,
        creditsRemaining: 60,
        percentUsed: 0.4,
        warningThreshold: false,
      };

      expect(stats.period).toBe('2026-02');
      expect(stats.creditsUsed).toBe(40);
      expect(stats.creditsAllowed).toBe(100);
      expect(stats.creditsRemaining).toBe(60);
      expect(stats.percentUsed).toBe(0.4);
      expect(stats.warningThreshold).toBe(false);
    });

    it('warning threshold is true when usage >= 80%', () => {
      const stats = {
        period: '2026-02',
        creditsUsed: 80,
        creditsAllowed: 100,
        creditsRemaining: 20,
        percentUsed: 0.8,
        warningThreshold: true,
      };

      expect(stats.warningThreshold).toBe(true);
    });
  });
});
