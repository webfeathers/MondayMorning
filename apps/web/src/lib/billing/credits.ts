/**
 * Credit Management Service
 *
 * Handles credit allocation, deduction, and balance checks.
 * Works in conjunction with AI usage tracking.
 */

import { db } from '@wf/db';
import { tenantCreditUsage } from '@wf/db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

/**
 * Get current credit balance for a tenant in the current period.
 */
export async function getCurrentCreditBalance(tenantId: string): Promise<{
  allocated: number;
  consumed: number;
  remaining: number;
  period: { start: Date; end: Date };
}> {
  // Get current period (monthly)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Find or create credit usage record for current period
  let [creditUsage] = await db
    .select()
    .from(tenantCreditUsage)
    .where(
      and(
        eq(tenantCreditUsage.tenantId, tenantId),
        gte(tenantCreditUsage.periodStart, periodStart),
        lte(tenantCreditUsage.periodEnd, periodEnd)
      )
    )
    .limit(1);

  if (!creditUsage) {
    // Create initial credit usage record
    // TODO: Get allocated credits from tenant's plan
    const allocatedCredits = 500; // Default, should come from plan

    [creditUsage] = await db
      .insert(tenantCreditUsage)
      .values({
        tenantId,
        periodStart,
        periodEnd,
        allocatedCredits,
        consumedCredits: 0,
        rolledOverCredits: 0,
      })
      .returning();
  }

  const consumed = creditUsage.consumedCredits || 0;
  const allocated = (creditUsage.allocatedCredits || 0) + (creditUsage.rolledOverCredits || 0);
  const remaining = Math.max(0, allocated - consumed);

  return {
    allocated,
    consumed,
    remaining,
    period: {
      start: periodStart,
      end: periodEnd,
    },
  };
}

/**
 * Check if tenant has enough credits for an operation.
 */
export async function hasEnoughCredits(
  tenantId: string,
  requiredCredits: number
): Promise<boolean> {
  const balance = await getCurrentCreditBalance(tenantId);
  return balance.remaining >= requiredCredits;
}

/**
 * Deduct credits from tenant's balance.
 * Called after AI execution completes.
 */
export async function deductCredits(
  tenantId: string,
  creditsToDeduct: number
): Promise<{ success: boolean; newBalance: number }> {
  try {
    const balance = await getCurrentCreditBalance(tenantId);

    // Update consumed credits
    const newConsumed = balance.consumed + creditsToDeduct;

    await db
      .update(tenantCreditUsage)
      .set({
        consumedCredits: newConsumed,
      })
      .where(
        and(
          eq(tenantCreditUsage.tenantId, tenantId),
          gte(tenantCreditUsage.periodStart, balance.period.start),
          lte(tenantCreditUsage.periodEnd, balance.period.end)
        )
      );

    const newRemaining = Math.max(0, balance.allocated - newConsumed);

    console.log(
      `💳 Credits deducted: ${creditsToDeduct} | Remaining: ${newRemaining}/${balance.allocated}`
    );

    return {
      success: true,
      newBalance: newRemaining,
    };
  } catch (error) {
    console.error('Failed to deduct credits:', error);
    return {
      success: false,
      newBalance: 0,
    };
  }
}

/**
 * Get credit usage history for a tenant.
 */
export async function getCreditHistory(
  tenantId: string,
  months: number = 12
): Promise<
  Array<{
    periodStart: Date;
    periodEnd: Date;
    allocated: number;
    consumed: number;
    remaining: number;
  }>
> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const history = await db
    .select({
      periodStart: tenantCreditUsage.periodStart,
      periodEnd: tenantCreditUsage.periodEnd,
      allocated: tenantCreditUsage.allocatedCredits,
      consumed: tenantCreditUsage.consumedCredits,
      rolledOver: tenantCreditUsage.rolledOverCredits,
    })
    .from(tenantCreditUsage)
    .where(and(eq(tenantCreditUsage.tenantId, tenantId), gte(tenantCreditUsage.periodStart, startDate)))
    .orderBy(tenantCreditUsage.periodStart);

  return history.map((record) => ({
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    allocated: (record.allocated || 0) + (record.rolledOver || 0),
    consumed: record.consumed || 0,
    remaining: Math.max(
      0,
      (record.allocated || 0) + (record.rolledOver || 0) - (record.consumed || 0)
    ),
  }));
}
