import { describe, it, expect } from 'vitest';
import type {
  UpgradeResult,
  DowngradeResult,
  CancelResult,
  ReactivateResult,
  UpgradePreview,
} from '../stripe/subscription-lifecycle';

describe('Subscription Lifecycle - Unit Tests', () => {
  describe('UpgradeResult interface', () => {
    it('success result has expected shape', () => {
      const result: UpgradeResult = {
        success: true,
        newPlanSlug: 'pro',
        prorationInvoiceId: 'in_123',
        prorationAmount: 15000,
      };

      expect(result.success).toBe(true);
      expect(result.newPlanSlug).toBe('pro');
      expect(result.prorationInvoiceId).toBeDefined();
      expect(result.prorationAmount).toBeDefined();
    });

    it('error result has expected shape', () => {
      const result: UpgradeResult = {
        success: false,
        error: 'Plan not found',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('DowngradeResult interface', () => {
    it('success result has expected shape', () => {
      const result: DowngradeResult = {
        success: true,
        scheduledPlanSlug: 'starter',
        effectiveAt: new Date('2026-03-23'),
        immediateCharge: false,
      };

      expect(result.success).toBe(true);
      expect(result.scheduledPlanSlug).toBe('starter');
      expect(result.effectiveAt).toBeDefined();
      expect(result.immediateCharge).toBe(false);
    });

    it('error result has expected shape', () => {
      const result: DowngradeResult = {
        success: false,
        immediateCharge: false,
        error: 'Plan not found',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('CancelResult interface', () => {
    it('immediate cancel result has expected shape', () => {
      const result: CancelResult = {
        success: true,
        canceledImmediately: true,
        effectiveAt: new Date(),
      };

      expect(result.success).toBe(true);
      expect(result.canceledImmediately).toBe(true);
      expect(result.effectiveAt).toBeDefined();
    });

    it('scheduled cancel result has expected shape', () => {
      const result: CancelResult = {
        success: true,
        canceledImmediately: false,
        effectiveAt: new Date('2026-03-23'),
      };

      expect(result.success).toBe(true);
      expect(result.canceledImmediately).toBe(false);
      expect(result.effectiveAt).toBeDefined();
    });

    it('error result has expected shape', () => {
      const result: CancelResult = {
        success: false,
        canceledImmediately: false,
        error: 'Subscription not found',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('ReactivateResult interface', () => {
    it('success result has expected shape', () => {
      const result: ReactivateResult = {
        success: true,
      };

      expect(result.success).toBe(true);
    });

    it('error result has expected shape', () => {
      const result: ReactivateResult = {
        success: false,
        error: 'Subscription already canceled',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('UpgradePreview interface', () => {
    it('has expected shape with line items', () => {
      const preview: UpgradePreview = {
        total: 39500,
        currency: 'usd',
        lineItems: [
          {
            description: 'Unused time on Starter',
            amount: -5900,
            proration: true,
          },
          {
            description: 'Remaining time on Pro',
            amount: 45400,
            proration: true,
          },
        ],
      };

      expect(preview.total).toBe(39500);
      expect(preview.currency).toBe('usd');
      expect(preview.lineItems).toHaveLength(2);
      expect(preview.lineItems[0].proration).toBe(true);
    });
  });
});
