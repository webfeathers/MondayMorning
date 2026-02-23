import { getStripeClient } from './client';
import { db } from '@wf/db';
import { tenants, plans, tenantSubscriptions, tenantCreditUsage } from '@wf/db';
import { eq } from 'drizzle-orm';
import { TRIAL_DURATION_DAYS } from '@wf/shared';

/**
 * Provision a new tenant with Stripe billing
 *
 * Creates:
 * - Stripe Customer with tenant metadata
 * - Stripe Subscription with 14-day trial
 * - Updates tenants table with stripeCustomerId
 * - Creates tenant_subscriptions record
 * - Seeds tenant_credit_usage for current period
 *
 * @param tenantId - Tenant UUID
 * @param tenantName - Tenant display name
 * @param ownerEmail - Owner email address
 * @param planSlug - Plan slug (defaults to 'pro')
 * @returns Subscription details
 */
export async function provisionTenant(
  tenantId: string,
  tenantName: string,
  ownerEmail: string,
  planSlug: string = 'pro'
): Promise<{
  customerId: string;
  subscriptionId: string;
  status: string;
  trialEndsAt: Date;
}> {
  // Validate inputs
  if (!tenantId) {
    throw new Error('tenant ID is required');
  }

  if (!tenantName) {
    throw new Error('tenant name is required');
  }

  if (!ownerEmail) {
    throw new Error('owner email is required');
  }

  // Get Stripe client
  const stripe = getStripeClient();

  // 1. Create Stripe Customer with metadata
  const customer = await stripe.customers.create({
    email: ownerEmail,
    name: tenantName,
    metadata: {
      tenant_id: tenantId,
      tenant_name: tenantName,
    },
  });

  // 2. Get plan from database (default to 'pro')
  const plan = await db.query.plans.findFirst({
    where: eq(plans.slug, planSlug),
  });

  if (!plan) {
    throw new Error(`Plan "${planSlug}" not found`);
  }

  if (!plan.stripePriceId) {
    throw new Error(`Plan "${planSlug}" does not have a Stripe price ID`);
  }

  // 3. Calculate trial end (14 days from now)
  const now = Math.floor(Date.now() / 1000);
  const trialEnd = now + (TRIAL_DURATION_DAYS * 24 * 60 * 60);

  // 4. Create Stripe Subscription with trial
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [
      {
        price: plan.stripePriceId,
        quantity: 1, // Initial seat count
      },
    ],
    trial_end: trialEnd,
    metadata: {
      tenant_id: tenantId,
      tenant_name: tenantName,
    },
  });

  // 5. Update tenants table with stripeCustomerId
  await db
    .update(tenants)
    .set({
      stripeCustomerId: customer.id,
      planId: plan.id,
    })
    .where(eq(tenants.id, tenantId));

  // 6. Create tenant_subscriptions record
  const trialEndsAt = new Date(trialEnd * 1000);
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  await db.insert(tenantSubscriptions).values({
    tenantId,
    planId: plan.id,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customer.id,
    status: 'trialing',
    seatCount: 1,
    currentPeriodStart,
    currentPeriodEnd,
    trialEndsAt,
  });

  // 7. Seed tenant_credit_usage for current period
  const period = formatPeriod(new Date());
  const creditsAllocated = plan.monthlyCredits || 0;

  // Calculate reset date (end of current period)
  const resetAt = currentPeriodEnd;

  await db.insert(tenantCreditUsage).values({
    tenantId,
    period,
    creditsAllocated,
    creditsUsed: 0,
    creditsRemaining: creditsAllocated,
    rolloverCredits: 0,
    resetAt,
  });

  // 8. Return subscription details
  return {
    customerId: customer.id,
    subscriptionId: subscription.id,
    status: subscription.status,
    trialEndsAt,
  };
}

/**
 * Format a date as YYYY-MM for period tracking
 */
function formatPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
