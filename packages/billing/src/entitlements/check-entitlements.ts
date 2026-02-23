import { db, tenants, tenantSubscriptions, plans, tenantMembers, tenantCreditUsage } from '@wf/db';
import { eq, and, inArray } from 'drizzle-orm';
import type { FeatureKey, PlanFeatures } from './features';

/**
 * Check if a tenant has access to a specific feature based on their plan
 *
 * @param tenantId - The tenant's UUID
 * @param feature - The feature key to check
 * @returns true if the tenant has access, false otherwise
 */
export async function checkFeatureEntitlement(
  tenantId: string,
  feature: FeatureKey
): Promise<boolean> {
  // Check tenant status first
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    return false;
  }

  // Block suspended and churned tenants
  if (tenant.status === 'suspended' || tenant.status === 'churned') {
    return false;
  }

  // Get active subscription
  const subscription = await db.query.tenantSubscriptions.findFirst({
    where: and(
      eq(tenantSubscriptions.tenantId, tenantId),
      inArray(tenantSubscriptions.status, ['active', 'trialing'])
    ),
  });

  if (!subscription) {
    return false;
  }

  // Get plan details
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, subscription.planId),
  });

  if (!plan || !plan.features) {
    return false;
  }

  // Check if feature is enabled in plan
  return plan.features[feature as keyof PlanFeatures] === true;
}

/**
 * Check seat limits for a tenant
 *
 * @param tenantId - The tenant's UUID
 * @returns Object with current seats, max seats, and whether more can be added
 */
export async function checkSeatLimit(tenantId: string): Promise<{
  current: number;
  max: number | null;
  canAddMore: boolean;
}> {
  // Count active and invited members
  const members = await db.query.tenantMembers.findMany({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      inArray(tenantMembers.status, ['active', 'invited'])
    ),
  });

  const currentSeats = members.length;

  // Get subscription and plan
  const subscription = await db.query.tenantSubscriptions.findFirst({
    where: and(
      eq(tenantSubscriptions.tenantId, tenantId),
      inArray(tenantSubscriptions.status, ['active', 'trialing'])
    ),
  });

  if (!subscription) {
    return {
      current: currentSeats,
      max: 0,
      canAddMore: false,
    };
  }

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, subscription.planId),
  });

  if (!plan) {
    return {
      current: currentSeats,
      max: 0,
      canAddMore: false,
    };
  }

  const maxSeats = plan.maxUsers;

  return {
    current: currentSeats,
    max: maxSeats,
    canAddMore: maxSeats === null || currentSeats < maxSeats,
  };
}

/**
 * Check if tenant has sufficient credits for an operation
 *
 * @param tenantId - The tenant's UUID
 * @param creditsRequired - Number of credits needed
 * @returns true if credits are available, false otherwise
 */
export async function checkCreditEntitlement(
  tenantId: string,
  creditsRequired: number
): Promise<boolean> {
  // First check if tenant has unlimited credits (enterprise plan)
  const subscription = await db.query.tenantSubscriptions.findFirst({
    where: and(
      eq(tenantSubscriptions.tenantId, tenantId),
      inArray(tenantSubscriptions.status, ['active', 'trialing'])
    ),
  });

  if (subscription) {
    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, subscription.planId),
    });

    // Unlimited credits (enterprise)
    if (plan && plan.monthlyCredits === null) {
      return true;
    }
  }

  // Get current period credit usage
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
  const creditUsage = await db.query.tenantCreditUsage.findFirst({
    where: and(
      eq(tenantCreditUsage.tenantId, tenantId),
      eq(tenantCreditUsage.period, currentPeriod)
    ),
  });

  if (!creditUsage) {
    return false;
  }

  // Check if adding required credits would exceed limit
  return creditUsage.creditsRemaining >= creditsRequired;
}

/**
 * Get full entitlement information for a tenant
 *
 * @param tenantId - The tenant's UUID
 * @returns Complete entitlement object with features, seats, credits, and subscription
 */
export async function getEntitlements(tenantId: string): Promise<{
  features: PlanFeatures;
  seats: {
    current: number;
    max: number | null;
    canAddMore: boolean;
  };
  credits: {
    allocated: number | null;
    used: number;
    remaining: number | null;
    unlimited: boolean;
  };
  subscription: {
    status: string;
    planSlug: string;
  };
}> {
  // Get tenant
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Get subscription
  const subscription = await db.query.tenantSubscriptions.findFirst({
    where: and(
      eq(tenantSubscriptions.tenantId, tenantId),
      inArray(tenantSubscriptions.status, ['active', 'trialing'])
    ),
  });

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  // Get plan
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, subscription.planId),
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  // Get seat info
  const seatInfo = await checkSeatLimit(tenantId);

  // Get credit info
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const creditUsage = await db.query.tenantCreditUsage.findFirst({
    where: and(
      eq(tenantCreditUsage.tenantId, tenantId),
      eq(tenantCreditUsage.period, currentPeriod)
    ),
  });

  const isUnlimited = plan.monthlyCredits === null;

  return {
    features: plan.features as PlanFeatures,
    seats: seatInfo,
    credits: {
      allocated: creditUsage?.creditsAllocated ?? plan.monthlyCredits,
      used: creditUsage?.creditsUsed ?? 0,
      remaining: isUnlimited ? null : (creditUsage?.creditsRemaining ?? plan.monthlyCredits ?? 0),
      unlimited: isUnlimited,
    },
    subscription: {
      status: subscription.status,
      planSlug: plan.slug,
    },
  };
}
