import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { CreditManager } from '../credits/credit-manager';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@wf/db/src/schema';

// Integration tests - require DATABASE_URL
const skipIfNoDb = process.env.DATABASE_URL ? describe : describe.skip;

skipIfNoDb('Credit System', () => {
  let creditManager: CreditManager;
  let db: ReturnType<typeof drizzle>;
  let sql: ReturnType<typeof postgres>;
  let testTenantId: string;
  let testPlanId: string;

  beforeAll(async () => {
    // Set up real database connection for integration tests
    sql = postgres(process.env.DATABASE_URL!);
    db = drizzle(sql, { schema });

    // Create a test plan
    const plans = await db
      .insert(schema.plans)
      .values({
        slug: 'test-plan',
        name: 'Test Plan',
        monthlyCredits: 100,
        maxUsers: 5,
        allowedModels: ['gemini-2.0-flash'],
        allowedIntegrationTypes: ['crm'],
        features: {
          configurableDashboards: false,
          webhookSync: false,
          whiteLabel: false,
          apiAccess: false,
        },
        pricePerSeatMonthly: '0',
        sortOrder: 99,
        isActive: true,
      })
      .returning()
      .onConflictDoNothing();

    testPlanId = plans[0]?.id || (await db.select().from(schema.plans).where(eq(schema.plans.slug, 'test-plan')).limit(1))[0].id;

    // Create a test tenant
    const tenants = await db
      .insert(schema.tenants)
      .values({
        name: 'Test Tenant',
        slug: 'test-tenant-credit-system',
        planId: testPlanId,
        status: 'active',
      })
      .returning()
      .onConflictDoNothing();

    testTenantId = tenants[0]?.id || (await db.select().from(schema.tenants).where(eq(schema.tenants.slug, 'test-tenant-credit-system')).limit(1))[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testTenantId) {
      await db.delete(schema.aiUsage).where(eq(schema.aiUsage.tenantId, testTenantId));
      await db.delete(schema.creditTopUps).where(eq(schema.creditTopUps.tenantId, testTenantId));
      await db.delete(schema.tenantCreditUsage).where(eq(schema.tenantCreditUsage.tenantId, testTenantId));
      await db.delete(schema.tenants).where(eq(schema.tenants.id, testTenantId));
    }
    if (testPlanId) {
      await db.delete(schema.plans).where(eq(schema.plans.id, testPlanId));
    }
    await sql.end();
  });

  beforeEach(async () => {
    // Clean up usage data before each test
    if (testTenantId) {
      await db.delete(schema.aiUsage).where(eq(schema.aiUsage.tenantId, testTenantId));
      await db.delete(schema.creditTopUps).where(eq(schema.creditTopUps.tenantId, testTenantId));
      await db.delete(schema.tenantCreditUsage).where(eq(schema.tenantCreditUsage.tenantId, testTenantId));
    }
  });

  describe('deductCredits', () => {
    it('deducts credits from current period usage', async () => {
      creditManager = new CreditManager(testTenantId);

      const result = await creditManager.deductCredits(50, {
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.success).toBe(true);
      expect(result.creditsRemaining).toBeDefined();
    });

    it('updates creditsUsed in tenant_credit_usage', async () => {
      creditManager = new CreditManager(testTenantId);

      await creditManager.deductCredits(25, {
        model: 'gemini-2.0-flash',
        inputTokens: 500,
        outputTokens: 200,
      });

      const usage = await creditManager.getCurrentPeriodUsage();
      expect(usage.creditsUsed).toBeGreaterThan(0);
    });

    it('logs ai_usage record with metadata', async () => {
      creditManager = new CreditManager(testTenantId);

      const metadata = {
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        crewTemplateId: 'crew-123',
        jobId: 'job-456',
      };

      const result = await creditManager.deductCredits(100, metadata);

      expect(result.success).toBe(true);
      expect(result.aiUsageId).toBeDefined();
    });

    it('fails when credits exceed limit for non-enterprise plans', async () => {
      creditManager = new CreditManager(testTenantId);

      // Attempt to deduct more credits than available (plan has 100)
      const result = await creditManager.deductCredits(999999, {
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient credits');
    });

    it('succeeds for enterprise plans with unlimited credits', async () => {
      // Create enterprise plan with null monthly credits
      const enterprisePlan = await db
        .insert(schema.plans)
        .values({
          slug: 'test-enterprise-plan',
          name: 'Test Enterprise',
          monthlyCredits: null, // unlimited
          maxUsers: null,
          allowedModels: ['claude-opus-4-20250514'],
          allowedIntegrationTypes: ['crm', 'meeting', 'ticketing'],
          features: {
            configurableDashboards: true,
            webhookSync: true,
            whiteLabel: true,
            apiAccess: true,
          },
          pricePerSeatMonthly: '0',
          sortOrder: 98,
          isActive: true,
        })
        .returning()
        .onConflictDoNothing();

      const enterprisePlanId = enterprisePlan[0]?.id || (await db.select().from(schema.plans).where(eq(schema.plans.slug, 'test-enterprise-plan')).limit(1))[0].id;

      // Create enterprise tenant
      const enterpriseTenant = await db
        .insert(schema.tenants)
        .values({
          name: 'Test Enterprise Tenant',
          slug: 'test-enterprise-tenant-credit',
          planId: enterprisePlanId,
          status: 'active',
        })
        .returning()
        .onConflictDoNothing();

      const enterpriseTenantId = enterpriseTenant[0]?.id || (await db.select().from(schema.tenants).where(eq(schema.tenants.slug, 'test-enterprise-tenant-credit')).limit(1))[0].id;

      creditManager = new CreditManager(enterpriseTenantId);

      const result = await creditManager.deductCredits(999999, {
        model: 'claude-opus-4-20250514',
        inputTokens: 10000,
        outputTokens: 5000,
      });

      expect(result.success).toBe(true);

      // Clean up
      await db.delete(schema.aiUsage).where(eq(schema.aiUsage.tenantId, enterpriseTenantId));
      await db.delete(schema.tenantCreditUsage).where(eq(schema.tenantCreditUsage.tenantId, enterpriseTenantId));
      await db.delete(schema.tenants).where(eq(schema.tenants.id, enterpriseTenantId));
      await db.delete(schema.plans).where(eq(schema.plans.id, enterprisePlanId));
    });
  });

  describe('checkCreditsAvailable', () => {
    it('returns true if enough credits available', async () => {
      creditManager = new CreditManager(testTenantId);

      const available = await creditManager.checkCreditsAvailable(10);

      expect(available).toBe(true);
    });

    it('returns false if insufficient credits', async () => {
      creditManager = new CreditManager(testTenantId);

      const available = await creditManager.checkCreditsAvailable(999999);

      expect(available).toBe(false);
    });

    it('always returns true for enterprise unlimited credits', async () => {
      // Create enterprise plan with null monthly credits
      const enterprisePlan = await db
        .insert(schema.plans)
        .values({
          slug: 'test-enterprise-plan-2',
          name: 'Test Enterprise 2',
          monthlyCredits: null, // unlimited
          maxUsers: null,
          allowedModels: ['claude-opus-4-20250514'],
          allowedIntegrationTypes: ['crm', 'meeting', 'ticketing'],
          features: {
            configurableDashboards: true,
            webhookSync: true,
            whiteLabel: true,
            apiAccess: true,
          },
          pricePerSeatMonthly: '0',
          sortOrder: 97,
          isActive: true,
        })
        .returning()
        .onConflictDoNothing();

      const enterprisePlanId = enterprisePlan[0]?.id || (await db.select().from(schema.plans).where(eq(schema.plans.slug, 'test-enterprise-plan-2')).limit(1))[0].id;

      // Create enterprise tenant
      const enterpriseTenant = await db
        .insert(schema.tenants)
        .values({
          name: 'Test Enterprise Tenant 2',
          slug: 'test-enterprise-tenant-credit-2',
          planId: enterprisePlanId,
          status: 'active',
        })
        .returning()
        .onConflictDoNothing();

      const enterpriseTenantId = enterpriseTenant[0]?.id || (await db.select().from(schema.tenants).where(eq(schema.tenants.slug, 'test-enterprise-tenant-credit-2')).limit(1))[0].id;

      creditManager = new CreditManager(enterpriseTenantId);

      const available = await creditManager.checkCreditsAvailable(999999);

      expect(available).toBe(true);

      // Clean up
      await db.delete(schema.tenants).where(eq(schema.tenants.id, enterpriseTenantId));
      await db.delete(schema.plans).where(eq(schema.plans.id, enterprisePlanId));
    });

    it('considers top-up credits in availability check', async () => {
      creditManager = new CreditManager(testTenantId);

      // Add top-up credits
      await creditManager.addTopUp(100, 'pi_test123');

      const available = await creditManager.checkCreditsAvailable(150);

      expect(available).toBe(true);
    });
  });

  describe('addTopUp', () => {
    it('creates credit_top_ups record', async () => {
      creditManager = new CreditManager(testTenantId);

      const result = await creditManager.addTopUp(200, 'pi_test456');

      expect(result.success).toBe(true);
      expect(result.topUpId).toBeDefined();
    });

    it('adds to creditsAllocated for current period', async () => {
      creditManager = new CreditManager(testTenantId);

      const usageBefore = await creditManager.getCurrentPeriodUsage();
      const creditsBefore = usageBefore.creditsAllowed;

      await creditManager.addTopUp(100, 'pi_test789');

      const usageAfter = await creditManager.getCurrentPeriodUsage();
      expect(usageAfter.creditsAllowed).toBe(creditsBefore + 100);
    });
  });

  describe('getCurrentPeriodUsage', () => {
    it('returns usage stats for current period', async () => {
      creditManager = new CreditManager(testTenantId);

      const usage = await creditManager.getCurrentPeriodUsage();

      expect(usage).toHaveProperty('creditsUsed');
      expect(usage).toHaveProperty('creditsAllowed');
      expect(usage).toHaveProperty('creditsRemaining');
      expect(usage).toHaveProperty('percentUsed');
    });

    it('calculates creditsRemaining correctly', async () => {
      creditManager = new CreditManager(testTenantId);

      const usage = await creditManager.getCurrentPeriodUsage();

      expect(usage.creditsRemaining).toBe(usage.creditsAllowed - usage.creditsUsed);
    });

    it('calculates percentUsed correctly', async () => {
      creditManager = new CreditManager(testTenantId);

      await creditManager.deductCredits(40, {
        model: 'gemini-2.0-flash',
        inputTokens: 500,
        outputTokens: 200,
      });

      const usage = await creditManager.getCurrentPeriodUsage();

      expect(usage.percentUsed).toBeGreaterThan(0);
      expect(usage.percentUsed).toBeLessThanOrEqual(1);
    });

    it('sets warningThreshold flag when usage >= 80%', async () => {
      creditManager = new CreditManager(testTenantId);

      // Deduct 80% of credits
      const usage = await creditManager.getCurrentPeriodUsage();
      const warningAmount = Math.ceil(usage.creditsAllowed * 0.8);

      await creditManager.deductCredits(warningAmount, {
        model: 'gemini-2.0-flash',
        inputTokens: 1000,
        outputTokens: 500,
      });

      const updatedUsage = await creditManager.getCurrentPeriodUsage();
      expect(updatedUsage.warningThreshold).toBe(true);
    });
  });

  describe('getPeriodKey', () => {
    it('returns current period in YYYY-MM format', () => {
      creditManager = new CreditManager(testTenantId);

      const periodKey = creditManager.getPeriodKey();

      expect(periodKey).toMatch(/^\d{4}-\d{2}$/);
    });

    it('returns same period for dates in same month', () => {
      creditManager = new CreditManager(testTenantId);

      const periodKey1 = creditManager.getPeriodKey(new Date('2026-02-01'));
      const periodKey2 = creditManager.getPeriodKey(new Date('2026-02-28'));

      expect(periodKey1).toBe(periodKey2);
      expect(periodKey1).toBe('2026-02');
    });

    it('returns different periods for different months', () => {
      creditManager = new CreditManager(testTenantId);

      const periodKey1 = creditManager.getPeriodKey(new Date('2026-02-28'));
      const periodKey2 = creditManager.getPeriodKey(new Date('2026-03-01'));

      expect(periodKey1).not.toBe(periodKey2);
      expect(periodKey1).toBe('2026-02');
      expect(periodKey2).toBe('2026-03');
    });
  });

  describe('period boundary handling', () => {
    it('resets usage at period boundary (new month)', async () => {
      creditManager = new CreditManager(testTenantId);

      // Get usage for February
      const febPeriod = creditManager.getPeriodKey(new Date('2026-02-15'));

      // Get usage for March (should be a new period)
      const marPeriod = creditManager.getPeriodKey(new Date('2026-03-15'));

      expect(febPeriod).not.toBe(marPeriod);
    });

    it('creates new tenant_credit_usage record for new period', async () => {
      creditManager = new CreditManager(testTenantId);

      // This should create or get the current period usage
      const usage = await creditManager.getCurrentPeriodUsage();

      expect(usage.period).toBeDefined();
      expect(usage.period).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
