import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@wf/db/src/schema';
import {
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
} from '../stripe/subscription-lifecycle';
import { getStripeClient } from '../stripe/client';

// Integration tests - require DATABASE_URL
const skipIfNoDb = process.env.DATABASE_URL ? describe : describe.skip;

// Mock Stripe client
vi.mock('../stripe/client', () => ({
  getStripeClient: vi.fn(),
}));

skipIfNoDb('Subscription Lifecycle - Integration Tests', () => {
  let db: ReturnType<typeof drizzle>;
  let sql: ReturnType<typeof postgres>;
  let testTenantId: string;
  let testPlanStarterId: string;
  let testPlanProId: string;
  let testSubscriptionId: string;

  const mockStripe = {
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    subscriptionSchedules: {
      create: vi.fn(),
    },
  };

  beforeAll(async () => {
    // Set up real database connection
    sql = postgres(process.env.DATABASE_URL!);
    db = drizzle(sql, { schema });

    // Mock Stripe
    (getStripeClient as any).mockReturnValue(mockStripe);

    // Create test plans
    const starterPlan = await db
      .insert(schema.plans)
      .values({
        slug: 'test-starter-lifecycle',
        name: 'Test Starter',
        monthlyCredits: 50,
        maxUsers: 5,
        allowedModels: ['gemini-2.0-flash'],
        allowedIntegrationTypes: ['crm'],
        features: {
          configurableDashboards: false,
          webhookSync: false,
          whiteLabel: false,
          apiAccess: false,
        },
        pricePerSeatMonthly: '29',
        stripePriceId: 'price_test_starter',
        sortOrder: 98,
        isActive: true,
      })
      .returning()
      .onConflictDoNothing();

    testPlanStarterId = starterPlan[0]?.id || (await db.select().from(schema.plans).where(eq(schema.plans.slug, 'test-starter-lifecycle')).limit(1))[0].id;

    const proPlan = await db
      .insert(schema.plans)
      .values({
        slug: 'test-pro-lifecycle',
        name: 'Test Pro',
        monthlyCredits: 500,
        maxUsers: 50,
        allowedModels: ['claude-sonnet-4-20250514', 'gemini-2.0-flash'],
        allowedIntegrationTypes: ['crm', 'meeting'],
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: false,
        },
        pricePerSeatMonthly: '79',
        stripePriceId: 'price_test_pro',
        sortOrder: 97,
        isActive: true,
      })
      .returning()
      .onConflictDoNothing();

    testPlanProId = proPlan[0]?.id || (await db.select().from(schema.plans).where(eq(schema.plans.slug, 'test-pro-lifecycle')).limit(1))[0].id;

    // Create test tenant
    const tenant = await db
      .insert(schema.tenants)
      .values({
        name: 'Test Tenant Lifecycle',
        slug: 'test-tenant-lifecycle',
        planId: testPlanStarterId,
        status: 'active',
        stripeCustomerId: 'cus_test_lifecycle',
      })
      .returning()
      .onConflictDoNothing();

    testTenantId = tenant[0]?.id || (await db.select().from(schema.tenants).where(eq(schema.tenants.slug, 'test-tenant-lifecycle')).limit(1))[0].id;

    // Create test subscription
    const subscription = await db
      .insert(schema.tenantSubscriptions)
      .values({
        tenantId: testTenantId,
        planId: testPlanStarterId,
        stripeSubscriptionId: 'sub_test_lifecycle',
        stripeCustomerId: 'cus_test_lifecycle',
        status: 'active',
        seatCount: 5,
        currentPeriodStart: new Date('2026-02-23'),
        currentPeriodEnd: new Date('2026-03-23'),
      })
      .returning()
      .onConflictDoNothing();

    testSubscriptionId = subscription[0]?.id || (await db.select().from(schema.tenantSubscriptions).where(eq(schema.tenantSubscriptions.tenantId, testTenantId)).limit(1))[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testTenantId) {
      await db.delete(schema.tenantCreditUsage).where(eq(schema.tenantCreditUsage.tenantId, testTenantId));
      await db.delete(schema.tenantSubscriptions).where(eq(schema.tenantSubscriptions.tenantId, testTenantId));
      await db.delete(schema.tenants).where(eq(schema.tenants.id, testTenantId));
    }
    if (testPlanStarterId) {
      await db.delete(schema.plans).where(eq(schema.plans.id, testPlanStarterId));
    }
    if (testPlanProId) {
      await db.delete(schema.plans).where(eq(schema.plans.id, testPlanProId));
    }
    await sql.end();
  });

  describe('upgradeSubscription', () => {
    it('upgrades plan immediately with proration', async () => {
      // Mock Stripe responses
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_test_lifecycle',
        items: {
          data: [
            {
              id: 'si_test',
              price: { id: 'price_test_starter' },
              quantity: 5,
            },
          ],
        },
      });

      mockStripe.subscriptions.update.mockResolvedValue({
        id: 'sub_test_lifecycle',
        items: {
          data: [
            {
              id: 'si_test',
              price: { id: 'price_test_pro' },
              quantity: 5,
            },
          ],
        },
        latest_invoice: {
          id: 'in_test_proration',
          amount_due: 15000,
        },
      });

      const result = await upgradeSubscription(testTenantId, 'test-pro-lifecycle');

      expect(result.success).toBe(true);
      expect(result.newPlanSlug).toBe('test-pro-lifecycle');
      expect(result.prorationInvoiceId).toBe('in_test_proration');

      // Verify database was updated
      const updatedTenant = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, testTenantId))
        .limit(1);

      expect(updatedTenant[0].planId).toBe(testPlanProId);

      const updatedSubscription = await db
        .select()
        .from(schema.tenantSubscriptions)
        .where(eq(schema.tenantSubscriptions.tenantId, testTenantId))
        .limit(1);

      expect(updatedSubscription[0].planId).toBe(testPlanProId);

      // Reset to starter for other tests
      await db.update(schema.tenants).set({ planId: testPlanStarterId }).where(eq(schema.tenants.id, testTenantId));
      await db.update(schema.tenantSubscriptions).set({ planId: testPlanStarterId }).where(eq(schema.tenantSubscriptions.tenantId, testTenantId));
    });
  });

  describe('downgradeSubscription', () => {
    it('schedules downgrade at period end', async () => {
      // First upgrade to pro
      await db.update(schema.tenants).set({ planId: testPlanProId }).where(eq(schema.tenants.id, testTenantId));
      await db.update(schema.tenantSubscriptions).set({ planId: testPlanProId }).where(eq(schema.tenantSubscriptions.tenantId, testTenantId));

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_test_lifecycle',
        current_period_start: Math.floor(new Date('2026-02-23').getTime() / 1000),
        current_period_end: Math.floor(new Date('2026-03-23').getTime() / 1000),
        items: {
          data: [
            {
              id: 'si_test',
              price: { id: 'price_test_pro' },
              quantity: 5,
            },
          ],
        },
      });

      mockStripe.subscriptionSchedules.create.mockResolvedValue({
        id: 'sub_sched_test',
      });

      const result = await downgradeSubscription(testTenantId, 'test-starter-lifecycle');

      expect(result.success).toBe(true);
      expect(result.scheduledPlanSlug).toBe('test-starter-lifecycle');
      expect(result.immediateCharge).toBe(false);
      expect(result.effectiveAt).toBeDefined();

      // Verify subscription schedule was created
      expect(mockStripe.subscriptionSchedules.create).toHaveBeenCalled();

      // Verify database was updated with scheduled plan
      const updatedSubscription = await db
        .select()
        .from(schema.tenantSubscriptions)
        .where(eq(schema.tenantSubscriptions.tenantId, testTenantId))
        .limit(1);

      expect(updatedSubscription[0].scheduledPlanId).toBe(testPlanStarterId);
      expect(updatedSubscription[0].stripeSubscriptionScheduleId).toBe('sub_sched_test');
    });
  });

  describe('cancelSubscription', () => {
    it('cancels subscription immediately', async () => {
      const now = Math.floor(Date.now() / 1000);

      mockStripe.subscriptions.cancel.mockResolvedValue({
        id: 'sub_test_lifecycle',
        status: 'canceled',
        canceled_at: now,
      });

      const result = await cancelSubscription(testTenantId, true);

      expect(result.success).toBe(true);
      expect(result.canceledImmediately).toBe(true);
      expect(result.effectiveAt).toBeDefined();

      // Verify database was updated
      const updatedSubscription = await db
        .select()
        .from(schema.tenantSubscriptions)
        .where(eq(schema.tenantSubscriptions.tenantId, testTenantId))
        .limit(1);

      expect(updatedSubscription[0].status).toBe('canceled');
      expect(updatedSubscription[0].canceledAt).toBeDefined();

      // Reset status for other tests
      await db.update(schema.tenantSubscriptions).set({ status: 'active', canceledAt: null }).where(eq(schema.tenantSubscriptions.tenantId, testTenantId));
    });

    it('schedules cancellation at period end', async () => {
      const periodEnd = Math.floor(new Date('2026-03-23').getTime() / 1000);

      mockStripe.subscriptions.update.mockResolvedValue({
        id: 'sub_test_lifecycle',
        cancel_at_period_end: true,
        current_period_end: periodEnd,
      });

      const result = await cancelSubscription(testTenantId, false);

      expect(result.success).toBe(true);
      expect(result.canceledImmediately).toBe(false);
      expect(result.effectiveAt).toBeDefined();

      // Verify database was updated
      const updatedSubscription = await db
        .select()
        .from(schema.tenantSubscriptions)
        .where(eq(schema.tenantSubscriptions.tenantId, testTenantId))
        .limit(1);

      expect(updatedSubscription[0].cancelAtPeriodEnd).toBeDefined();

      // Reset for other tests
      await db.update(schema.tenantSubscriptions).set({ cancelAtPeriodEnd: null }).where(eq(schema.tenantSubscriptions.tenantId, testTenantId));
    });
  });

  describe('reactivateSubscription', () => {
    it('removes cancel_at_period_end flag', async () => {
      // First schedule a cancellation
      await db
        .update(schema.tenantSubscriptions)
        .set({ cancelAtPeriodEnd: new Date('2026-03-23') })
        .where(eq(schema.tenantSubscriptions.tenantId, testTenantId));

      mockStripe.subscriptions.update.mockResolvedValue({
        id: 'sub_test_lifecycle',
        cancel_at_period_end: false,
        status: 'active',
      });

      const result = await reactivateSubscription(testTenantId);

      expect(result.success).toBe(true);

      // Verify database was updated
      const updatedSubscription = await db
        .select()
        .from(schema.tenantSubscriptions)
        .where(eq(schema.tenantSubscriptions.tenantId, testTenantId))
        .limit(1);

      expect(updatedSubscription[0].cancelAtPeriodEnd).toBeNull();
      expect(updatedSubscription[0].status).toBe('active');
    });

    it('fails if subscription is already canceled', async () => {
      // Set subscription as canceled
      await db
        .update(schema.tenantSubscriptions)
        .set({ status: 'canceled', canceledAt: new Date() })
        .where(eq(schema.tenantSubscriptions.tenantId, testTenantId));

      const result = await reactivateSubscription(testTenantId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be reactivated');

      // Reset for cleanup
      await db
        .update(schema.tenantSubscriptions)
        .set({ status: 'active', canceledAt: null })
        .where(eq(schema.tenantSubscriptions.tenantId, testTenantId));
    });
  });
});
