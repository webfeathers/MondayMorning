import { describe, it, expect, beforeEach, vi } from 'vitest';
import Stripe from 'stripe';

// Mock the Stripe client
vi.mock('../stripe/client', () => ({
  getStripeClient: vi.fn(),
}));

// Mock the database module with factory function
vi.mock('@wf/db', () => ({
  db: {
    query: {
      plans: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
  },
  tenants: {},
  tenantSubscriptions: {},
  tenantCreditUsage: {},
  plans: {},
}));

// Import after mocks are set up
import { provisionTenant } from '../stripe/tenant-provisioning';
import { getStripeClient } from '../stripe/client';
import { db } from '@wf/db';

describe('Tenant Provisioning', () => {
  const mockStripeClient = {
    customers: {
      create: vi.fn(),
    },
    subscriptions: {
      create: vi.fn(),
    },
  } as unknown as Stripe;

  const mockPlan = {
    id: 'plan-123',
    slug: 'pro',
    monthlyCredits: 500,
    stripePriceId: 'price_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getStripeClient as any).mockReturnValue(mockStripeClient);

    // Setup default mock return values
    (db.query.plans.findFirst as any).mockResolvedValue(mockPlan);
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockResolvedValue([{ id: 'sub-123' }]),
    });
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  describe('provisionTenant', () => {
    it('should throw error if tenant ID is missing', async () => {
      await expect(
        provisionTenant('', 'Test Tenant', 'owner@test.com')
      ).rejects.toThrow('tenant ID is required');
    });

    it('should throw error if tenant name is missing', async () => {
      await expect(
        provisionTenant('tenant-123', '', 'owner@test.com')
      ).rejects.toThrow('tenant name is required');
    });

    it('should throw error if owner email is missing', async () => {
      await expect(
        provisionTenant('tenant-123', 'Test Tenant', '')
      ).rejects.toThrow('owner email is required');
    });

    it('should create Stripe customer with metadata', async () => {
      const mockCustomer = {
        id: 'cus_test123',
      };

      (mockStripeClient.customers.create as any).mockResolvedValue(mockCustomer);

      const now = Math.floor(Date.now() / 1000);
      const mockSubscription = {
        id: 'sub_test123',
        status: 'trialing',
        trial_end: now + (14 * 24 * 60 * 60),
        current_period_start: now,
        current_period_end: now + (14 * 24 * 60 * 60),
      };

      (mockStripeClient.subscriptions.create as any).mockResolvedValue(mockSubscription);

      await provisionTenant('tenant-123', 'Test Tenant', 'owner@test.com');

      expect(mockStripeClient.customers.create).toHaveBeenCalledWith({
        email: 'owner@test.com',
        name: 'Test Tenant',
        metadata: {
          tenant_id: 'tenant-123',
          tenant_name: 'Test Tenant',
        },
      });
    });

    it('should create trial subscription with 14-day trial', async () => {
      const mockCustomer = {
        id: 'cus_test123',
      };

      (mockStripeClient.customers.create as any).mockResolvedValue(mockCustomer);

      const now = Math.floor(Date.now() / 1000);
      const trialEnd = now + (14 * 24 * 60 * 60);

      const mockSubscription = {
        id: 'sub_test123',
        status: 'trialing',
        trial_end: trialEnd,
        current_period_start: now,
        current_period_end: trialEnd,
      };

      (mockStripeClient.subscriptions.create as any).mockResolvedValue(mockSubscription);

      await provisionTenant('tenant-123', 'Test Tenant', 'owner@test.com');

      const createCall = (mockStripeClient.subscriptions.create as any).mock.calls[0][0];

      expect(createCall.customer).toBe('cus_test123');
      expect(createCall.items).toEqual([{ price: 'price_123', quantity: 1 }]);
      expect(createCall.trial_end).toBeGreaterThan(now);
      expect(createCall.trial_end).toBeLessThanOrEqual(trialEnd + 60); // Allow 60 second tolerance
    });

    it('should use default "pro" plan if no plan slug provided', async () => {
      const mockCustomer = {
        id: 'cus_test123',
      };

      (mockStripeClient.customers.create as any).mockResolvedValue(mockCustomer);

      const now = Math.floor(Date.now() / 1000);
      const mockSubscription = {
        id: 'sub_test123',
        status: 'trialing',
        trial_end: now + (14 * 24 * 60 * 60),
        current_period_start: now,
        current_period_end: now + (14 * 24 * 60 * 60),
      };

      (mockStripeClient.subscriptions.create as any).mockResolvedValue(mockSubscription);

      await provisionTenant('tenant-123', 'Test Tenant', 'owner@test.com');

      // Should query for 'pro' plan by default
      expect(db.query.plans.findFirst).toHaveBeenCalled();
    });

    it('should update tenants table with stripeCustomerId', async () => {
      const mockCustomer = {
        id: 'cus_test123',
      };

      (mockStripeClient.customers.create as any).mockResolvedValue(mockCustomer);

      const now = Math.floor(Date.now() / 1000);
      const mockSubscription = {
        id: 'sub_test123',
        status: 'trialing',
        trial_end: now + (14 * 24 * 60 * 60),
        current_period_start: now,
        current_period_end: now + (14 * 24 * 60 * 60),
      };

      (mockStripeClient.subscriptions.create as any).mockResolvedValue(mockSubscription);

      await provisionTenant('tenant-123', 'Test Tenant', 'owner@test.com');

      expect(db.update).toHaveBeenCalled();
      const updateCall = (db.update as any).mock.results[0].value;
      expect(updateCall.set).toHaveBeenCalledWith({
        stripeCustomerId: 'cus_test123',
        planId: 'plan-123',
      });
    });

    it('should create tenant_subscriptions record with status=trialing', async () => {
      const mockCustomer = {
        id: 'cus_test123',
      };

      (mockStripeClient.customers.create as any).mockResolvedValue(mockCustomer);

      const now = Math.floor(Date.now() / 1000);
      const mockSubscription = {
        id: 'sub_test123',
        status: 'trialing',
        trial_end: now + (14 * 24 * 60 * 60),
        current_period_start: now,
        current_period_end: now + (14 * 24 * 60 * 60),
      };

      (mockStripeClient.subscriptions.create as any).mockResolvedValue(mockSubscription);

      await provisionTenant('tenant-123', 'Test Tenant', 'owner@test.com');

      // Should have been called twice: once for subscription, once for credit usage
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should seed tenant_credit_usage for current period', async () => {
      const mockCustomer = {
        id: 'cus_test123',
      };

      (mockStripeClient.customers.create as any).mockResolvedValue(mockCustomer);

      const now = Math.floor(Date.now() / 1000);
      const mockSubscription = {
        id: 'sub_test123',
        status: 'trialing',
        trial_end: now + (14 * 24 * 60 * 60),
        current_period_start: now,
        current_period_end: now + (14 * 24 * 60 * 60),
      };

      (mockStripeClient.subscriptions.create as any).mockResolvedValue(mockSubscription);

      await provisionTenant('tenant-123', 'Test Tenant', 'owner@test.com');

      // Should have been called twice: once for subscription, once for credit usage
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should return subscription details', async () => {
      const mockCustomer = {
        id: 'cus_test123',
      };

      (mockStripeClient.customers.create as any).mockResolvedValue(mockCustomer);

      const now = Math.floor(Date.now() / 1000);
      const trialEnd = now + (14 * 24 * 60 * 60);

      const mockSubscription = {
        id: 'sub_test123',
        status: 'trialing',
        trial_end: trialEnd,
        current_period_start: now,
        current_period_end: trialEnd,
      };

      (mockStripeClient.subscriptions.create as any).mockResolvedValue(mockSubscription);

      const result = await provisionTenant('tenant-123', 'Test Tenant', 'owner@test.com');

      expect(result).toEqual({
        customerId: 'cus_test123',
        subscriptionId: 'sub_test123',
        status: 'trialing',
        trialEndsAt: expect.any(Date),
      });
    });
  });
});
