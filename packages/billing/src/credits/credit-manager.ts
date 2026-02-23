import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '@wf/db/src/schema';
import { CREDIT_WARNING_THRESHOLD } from '@wf/shared';

export interface DeductCreditsMetadata {
  model: string;
  inputTokens: number;
  outputTokens: number;
  crewTemplateId?: string;
  jobId?: string;
}

export interface DeductCreditsResult {
  success: boolean;
  creditsRemaining?: number;
  aiUsageId?: string;
  error?: string;
}

export interface AddTopUpResult {
  success: boolean;
  topUpId?: string;
  error?: string;
}

export interface PeriodUsageStats {
  period: string;
  creditsUsed: number;
  creditsAllowed: number;
  creditsRemaining: number;
  percentUsed: number;
  warningThreshold: boolean;
}

export class CreditManager {
  private db: ReturnType<typeof drizzle>;
  private tenantId: string;

  constructor(tenantId: string, databaseUrl?: string) {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    this.tenantId = tenantId;

    const connectionString = databaseUrl || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const sql = postgres(connectionString);
    this.db = drizzle(sql, { schema });
  }

  /**
   * Get the current period key in YYYY-MM format
   */
  getPeriodKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get or create tenant credit usage for the current period
   */
  private async getOrCreatePeriodUsage(): Promise<typeof schema.tenantCreditUsage.$inferSelect> {
    const period = this.getPeriodKey();

    // Try to get existing usage record
    const existing = await this.db
      .select()
      .from(schema.tenantCreditUsage)
      .where(
        and(
          eq(schema.tenantCreditUsage.tenantId, this.tenantId),
          eq(schema.tenantCreditUsage.period, period)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Get tenant's plan to determine monthly credits
    const tenant = await this.db
      .select({
        planId: schema.tenants.planId,
      })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, this.tenantId))
      .limit(1);

    if (tenant.length === 0) {
      throw new Error(`Tenant ${this.tenantId} not found`);
    }

    // Get plan details
    const plan = await this.db
      .select()
      .from(schema.plans)
      .where(eq(schema.plans.id, tenant[0].planId!))
      .limit(1);

    if (plan.length === 0) {
      throw new Error(`Plan not found for tenant ${this.tenantId}`);
    }

    const monthlyCredits = plan[0].monthlyCredits || 0;

    // Calculate reset date (end of current month)
    const now = new Date();
    const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1); // First day of next month

    // Create new usage record
    const newUsage = await this.db
      .insert(schema.tenantCreditUsage)
      .values({
        tenantId: this.tenantId,
        period,
        creditsAllocated: monthlyCredits,
        creditsUsed: 0,
        creditsRemaining: monthlyCredits,
        rolloverCredits: 0,
        resetAt,
      })
      .returning();

    return newUsage[0];
  }

  /**
   * Get the plan's monthly credits limit (null = unlimited for enterprise)
   */
  private async getPlanMonthlyCredits(): Promise<number | null> {
    const tenant = await this.db
      .select({
        planId: schema.tenants.planId,
      })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, this.tenantId))
      .limit(1);

    if (tenant.length === 0) {
      throw new Error(`Tenant ${this.tenantId} not found`);
    }

    const plan = await this.db
      .select()
      .from(schema.plans)
      .where(eq(schema.plans.id, tenant[0].planId!))
      .limit(1);

    if (plan.length === 0) {
      throw new Error(`Plan not found for tenant ${this.tenantId}`);
    }

    return plan[0].monthlyCredits;
  }

  /**
   * Get total top-up credits for the current period
   */
  private async getCurrentPeriodTopUps(): Promise<number> {
    const period = this.getPeriodKey();

    // Get usage record to check resetAt date
    const usage = await this.getOrCreatePeriodUsage();

    // Sum all top-ups created since the period started
    const topUps = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.creditTopUps.credits}), 0)`,
      })
      .from(schema.creditTopUps)
      .where(
        and(
          eq(schema.creditTopUps.tenantId, this.tenantId),
          eq(schema.creditTopUps.status, 'succeeded'),
          sql`${schema.creditTopUps.createdAt} >= ${usage.resetAt}`
        )
      );

    return Number(topUps[0]?.total || 0);
  }

  /**
   * Check if sufficient credits are available for a deduction
   */
  async checkCreditsAvailable(amount: number): Promise<boolean> {
    const monthlyCredits = await this.getPlanMonthlyCredits();

    // Enterprise plans with null credits = unlimited
    if (monthlyCredits === null) {
      return true;
    }

    const usage = await this.getOrCreatePeriodUsage();
    const topUpCredits = await this.getCurrentPeriodTopUps();

    const creditsAllowed = monthlyCredits + topUpCredits;
    const creditsRemaining = creditsAllowed - usage.creditsUsed;

    return creditsRemaining >= amount;
  }

  /**
   * Deduct credits from the current period
   */
  async deductCredits(
    amount: number,
    metadata: DeductCreditsMetadata
  ): Promise<DeductCreditsResult> {
    try {
      const monthlyCredits = await this.getPlanMonthlyCredits();

      // Enterprise plans with null credits = unlimited (skip credit check)
      if (monthlyCredits !== null) {
        const hasCredits = await this.checkCreditsAvailable(amount);
        if (!hasCredits) {
          return {
            success: false,
            error: 'Insufficient credits available',
          };
        }
      }

      // Get or create current period usage
      const usage = await this.getOrCreatePeriodUsage();

      // Update credits used
      const newCreditsUsed = usage.creditsUsed + amount;
      const topUpCredits = await this.getCurrentPeriodTopUps();
      const creditsAllowed = (monthlyCredits || 0) + topUpCredits;
      const newCreditsRemaining = creditsAllowed - newCreditsUsed;

      await this.db
        .update(schema.tenantCreditUsage)
        .set({
          creditsUsed: newCreditsUsed,
          creditsRemaining: newCreditsRemaining,
          updatedAt: new Date(),
        })
        .where(eq(schema.tenantCreditUsage.id, usage.id));

      // Log AI usage
      const aiUsage = await this.db
        .insert(schema.aiUsage)
        .values({
          tenantId: this.tenantId,
          crewTemplateId: metadata.crewTemplateId,
          jobId: metadata.jobId,
          model: metadata.model,
          inputTokens: metadata.inputTokens,
          outputTokens: metadata.outputTokens,
          creditsUsed: amount.toString(),
        })
        .returning();

      return {
        success: true,
        creditsRemaining: newCreditsRemaining,
        aiUsageId: aiUsage[0].id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add one-time top-up credits
   */
  async addTopUp(
    amount: number,
    stripePaymentIntentId: string
  ): Promise<AddTopUpResult> {
    try {
      const topUp = await this.db
        .insert(schema.creditTopUps)
        .values({
          tenantId: this.tenantId,
          credits: amount,
          amountPaid: '0', // This should be set by the caller based on Stripe payment
          currency: 'USD',
          stripePaymentIntentId,
          status: 'succeeded',
        })
        .returning();

      // Update current period usage to reflect new credits
      const usage = await this.getOrCreatePeriodUsage();
      const monthlyCredits = await this.getPlanMonthlyCredits();
      const topUpCredits = await this.getCurrentPeriodTopUps();

      const creditsAllowed = (monthlyCredits || 0) + topUpCredits;
      const creditsRemaining = creditsAllowed - usage.creditsUsed;

      await this.db
        .update(schema.tenantCreditUsage)
        .set({
          creditsAllocated: creditsAllowed,
          creditsRemaining: creditsRemaining,
          updatedAt: new Date(),
        })
        .where(eq(schema.tenantCreditUsage.id, usage.id));

      return {
        success: true,
        topUpId: topUp[0].id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get usage statistics for the current period
   */
  async getCurrentPeriodUsage(): Promise<PeriodUsageStats> {
    const usage = await this.getOrCreatePeriodUsage();
    const monthlyCredits = await this.getPlanMonthlyCredits();
    const topUpCredits = await this.getCurrentPeriodTopUps();

    const creditsAllowed = (monthlyCredits || 0) + topUpCredits;
    const creditsRemaining = creditsAllowed - usage.creditsUsed;
    const percentUsed = creditsAllowed > 0 ? usage.creditsUsed / creditsAllowed : 0;
    const warningThreshold = percentUsed >= CREDIT_WARNING_THRESHOLD;

    return {
      period: usage.period,
      creditsUsed: usage.creditsUsed,
      creditsAllowed,
      creditsRemaining,
      percentUsed,
      warningThreshold,
    };
  }
}
