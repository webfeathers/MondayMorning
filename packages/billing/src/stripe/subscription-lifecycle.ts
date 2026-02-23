import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '@wf/db/src/schema';
import { getStripeClient } from './client';
import Stripe from 'stripe';

export interface UpgradeResult {
  success: boolean;
  newPlanSlug?: string;
  prorationInvoiceId?: string;
  prorationAmount?: number;
  error?: string;
}

export interface DowngradeResult {
  success: boolean;
  scheduledPlanSlug?: string;
  effectiveAt?: Date;
  immediateCharge: boolean;
  error?: string;
}

export interface CancelResult {
  success: boolean;
  canceledImmediately: boolean;
  effectiveAt?: Date;
  error?: string;
}

export interface ReactivateResult {
  success: boolean;
  error?: string;
}

export interface UpgradePreview {
  total: number;
  currency: string;
  lineItems: Array<{
    description: string;
    amount: number;
    proration?: boolean;
  }>;
}

/**
 * Upgrade subscription to a new plan immediately with proration
 */
export async function upgradeSubscription(
  tenantId: string,
  newPlanSlug: string
): Promise<UpgradeResult> {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const sql = postgres(connectionString);
    const db = drizzle(sql, { schema });
    const stripe = getStripeClient();

    // Get tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
    });

    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    // Get current subscription
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: eq(schema.tenantSubscriptions.tenantId, tenantId),
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription found' };
    }

    // Get new plan
    const newPlan = await db.query.plans.findFirst({
      where: eq(schema.plans.slug, newPlanSlug),
    });

    if (!newPlan || !newPlan.stripePriceId) {
      return { success: false, error: 'New plan not found or not configured in Stripe' };
    }

    // Get Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    if (!stripeSubscription.items.data[0]) {
      return { success: false, error: 'Subscription has no items' };
    }

    // Update Stripe subscription with new price (immediate upgrade with proration)
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPlan.stripePriceId,
          },
        ],
        proration_behavior: 'always_invoice',
        metadata: {
          tenant_id: tenantId,
          plan_slug: newPlanSlug,
        },
      }
    );

    // Extract proration amount from latest invoice
    let prorationAmount: number | undefined;
    let prorationInvoiceId: string | undefined;

    if (typeof updatedSubscription.latest_invoice === 'object' && updatedSubscription.latest_invoice) {
      const invoice = updatedSubscription.latest_invoice as Stripe.Invoice;
      prorationInvoiceId = invoice.id;
      prorationAmount = invoice.amount_due;
    } else if (typeof updatedSubscription.latest_invoice === 'string') {
      prorationInvoiceId = updatedSubscription.latest_invoice;
    }

    // Update tenant.plan_id
    await db
      .update(schema.tenants)
      .set({
        planId: newPlan.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, tenantId));

    // Update tenant_subscriptions
    await db
      .update(schema.tenantSubscriptions)
      .set({
        planId: newPlan.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.tenantSubscriptions.id, subscription.id));

    // Reset monthly credits for new plan
    await resetMonthlyCredits(db, tenantId, newPlan.monthlyCredits);

    await sql.end();

    return {
      success: true,
      newPlanSlug,
      prorationInvoiceId,
      prorationAmount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Downgrade subscription to a new plan at period end (no immediate charge)
 */
export async function downgradeSubscription(
  tenantId: string,
  newPlanSlug: string
): Promise<DowngradeResult> {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const sql = postgres(connectionString);
    const db = drizzle(sql, { schema });
    const stripe = getStripeClient();

    // Get current subscription
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: eq(schema.tenantSubscriptions.tenantId, tenantId),
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return { success: false, immediateCharge: false, error: 'No active subscription found' };
    }

    // Get new plan
    const newPlan = await db.query.plans.findFirst({
      where: eq(schema.plans.slug, newPlanSlug),
    });

    if (!newPlan || !newPlan.stripePriceId) {
      return { success: false, immediateCharge: false, error: 'New plan not found or not configured in Stripe' };
    }

    // Get Stripe subscription to get current period end
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const periodEndDate = new Date(stripeSubscription.current_period_end * 1000);

    // Create subscription schedule to change plan at period end
    const subscriptionSchedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscription.stripeSubscriptionId,
      end_behavior: 'release',
      phases: [
        {
          // Current phase - keep existing configuration until period end
          start_date: stripeSubscription.current_period_start,
          end_date: stripeSubscription.current_period_end,
          items: stripeSubscription.items.data.map((item) => ({
            price: typeof item.price === 'string' ? item.price : item.price.id,
            quantity: item.quantity || 1,
          })),
        },
        {
          // New phase - switch to new plan at period end
          start_date: stripeSubscription.current_period_end,
          items: [
            {
              price: newPlan.stripePriceId,
              quantity: subscription.seatCount,
            },
          ],
        },
      ],
      metadata: {
        tenant_id: tenantId,
        downgrade_to_plan: newPlanSlug,
      },
    });

    // Update tenant_subscriptions with scheduled plan
    await db
      .update(schema.tenantSubscriptions)
      .set({
        scheduledPlanId: newPlan.id,
        stripeSubscriptionScheduleId: subscriptionSchedule.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.tenantSubscriptions.id, subscription.id));

    await sql.end();

    return {
      success: true,
      scheduledPlanSlug: newPlanSlug,
      effectiveAt: periodEndDate,
      immediateCharge: false,
    };
  } catch (error) {
    return {
      success: false,
      immediateCharge: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel subscription either immediately or at period end
 */
export async function cancelSubscription(
  tenantId: string,
  immediately: boolean
): Promise<CancelResult> {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const sql = postgres(connectionString);
    const db = drizzle(sql, { schema });
    const stripe = getStripeClient();

    // Get current subscription
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: eq(schema.tenantSubscriptions.tenantId, tenantId),
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return { success: false, canceledImmediately: false, error: 'No active subscription found' };
    }

    let effectiveAt: Date | undefined;

    if (immediately) {
      // Cancel immediately
      const canceledSubscription = await stripe.subscriptions.cancel(
        subscription.stripeSubscriptionId
      );

      effectiveAt = new Date(canceledSubscription.canceled_at! * 1000);

      // Update database
      await db
        .update(schema.tenantSubscriptions)
        .set({
          status: 'canceled',
          canceledAt: effectiveAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.tenantSubscriptions.id, subscription.id));
    } else {
      // Schedule cancellation at period end
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        }
      );

      effectiveAt = new Date(updatedSubscription.current_period_end * 1000);

      // Update database
      await db
        .update(schema.tenantSubscriptions)
        .set({
          cancelAtPeriodEnd: effectiveAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.tenantSubscriptions.id, subscription.id));
    }

    await sql.end();

    return {
      success: true,
      canceledImmediately: immediately,
      effectiveAt,
    };
  } catch (error) {
    return {
      success: false,
      canceledImmediately: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reactivate a subscription that was scheduled to be canceled
 */
export async function reactivateSubscription(tenantId: string): Promise<ReactivateResult> {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const sql = postgres(connectionString);
    const db = drizzle(sql, { schema });
    const stripe = getStripeClient();

    // Get current subscription
    const subscription = await db.query.tenantSubscriptions.findFirst({
      where: eq(schema.tenantSubscriptions.tenantId, tenantId),
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return { success: false, error: 'No subscription found' };
    }

    // Check if subscription is already fully canceled
    if (subscription.status === 'canceled' && subscription.canceledAt) {
      return {
        success: false,
        error: 'Subscription is already canceled and cannot be reactivated',
      };
    }

    // Remove cancel_at_period_end flag
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update database
    await db
      .update(schema.tenantSubscriptions)
      .set({
        cancelAtPeriodEnd: null,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(schema.tenantSubscriptions.id, subscription.id));

    await sql.end();

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Preview the cost of upgrading to a new plan
 */
export async function getUpgradePreview(
  tenantId: string,
  newPlanSlug: string
): Promise<UpgradePreview> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });
  const stripe = getStripeClient();

  // Get current subscription
  const subscription = await db.query.tenantSubscriptions.findFirst({
    where: eq(schema.tenantSubscriptions.tenantId, tenantId),
  });

  if (!subscription || !subscription.stripeSubscriptionId || !subscription.stripeCustomerId) {
    throw new Error('No active subscription found');
  }

  // Get new plan
  const newPlan = await db.query.plans.findFirst({
    where: eq(schema.plans.slug, newPlanSlug),
  });

  if (!newPlan || !newPlan.stripePriceId) {
    throw new Error('New plan not found or not configured in Stripe');
  }

  // Get current Stripe subscription
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId
  );

  if (!stripeSubscription.items.data[0]) {
    throw new Error('Subscription has no items');
  }

  // Get invoice preview
  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
    customer: subscription.stripeCustomerId,
    subscription: subscription.stripeSubscriptionId,
    subscription_items: [
      {
        id: stripeSubscription.items.data[0].id,
        price: newPlan.stripePriceId,
      },
    ],
    subscription_proration_behavior: 'always_invoice',
  });

  const result = {
    total: upcomingInvoice.total,
    currency: upcomingInvoice.currency || 'usd',
    lineItems: upcomingInvoice.lines.data.map((line) => ({
      description: line.description || '',
      amount: line.amount,
      proration: line.proration || false,
    })),
  };

  await sql.end();

  return result;
}

/**
 * Helper function to reset monthly credits when changing plans
 */
async function resetMonthlyCredits(
  db: ReturnType<typeof drizzle>,
  tenantId: string,
  newMonthlyCredits: number | null
): Promise<void> {
  // Get current period
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get or create current period usage
  const existingUsage = await db
    .select()
    .from(schema.tenantCreditUsage)
    .where(
      and(
        eq(schema.tenantCreditUsage.tenantId, tenantId),
        eq(schema.tenantCreditUsage.period, period)
      )
    )
    .limit(1);

  const creditsUsed = existingUsage.length > 0 ? existingUsage[0].creditsUsed : 0;
  const creditsAllowed = newMonthlyCredits || 0;
  const creditsRemaining = Math.max(0, creditsAllowed - creditsUsed);

  if (existingUsage.length > 0) {
    // Update existing usage record
    await db
      .update(schema.tenantCreditUsage)
      .set({
        creditsAllocated: creditsAllowed,
        creditsRemaining,
        updatedAt: new Date(),
      })
      .where(eq(schema.tenantCreditUsage.id, existingUsage[0].id));
  } else {
    // Create new usage record
    const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await db.insert(schema.tenantCreditUsage).values({
      tenantId,
      period,
      creditsAllocated: creditsAllowed,
      creditsUsed: 0,
      creditsRemaining: creditsAllowed,
      rolloverCredits: 0,
      resetAt,
    });
  }
}
