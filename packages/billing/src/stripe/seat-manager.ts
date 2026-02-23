import { getStripeClient } from './client';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '@wf/db/src/schema';

/**
 * Seat information for a tenant
 */
export interface SeatInfo {
  activeMembers: number;
  invitedMembers: number;
  totalSeats: number;
  maxSeats: number | null;
  canAddMore: boolean;
  availableSeats: number;
}

/**
 * Result of seat addition/removal
 */
export interface SeatChangeResult {
  newSeatCount: number;
  previousSeatCount: number;
  prorationAmount?: number;
}

/**
 * Invoice preview for seat changes
 */
export interface InvoicePreview {
  total: number;
  prorationAmount: number;
  nextInvoiceDate: Date;
  lines: Array<{
    description: string;
    amount: number;
  }>;
}

/**
 * Get database client
 */
function getDbClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  const sql = postgres(connectionString);
  return drizzle(sql, { schema });
}

type DbClient = ReturnType<typeof getDbClient>;

/**
 * Get current subscription from database
 */
async function getCurrentSubscription(tenantId: string, db?: DbClient) {
  const dbClient = db || getDbClient();

  const subscription = await dbClient.query.tenantSubscriptions.findFirst({
    where: and(
      eq(schema.tenantSubscriptions.tenantId, tenantId),
      inArray(schema.tenantSubscriptions.status, ['active', 'trialing'])
    ),
    with: {
      plan: true,
    },
  });

  if (!subscription) {
    throw new Error(`No active subscription found for tenant ${tenantId}`);
  }

  return subscription;
}

/**
 * Add seats to a tenant's subscription
 *
 * @param tenantId - The tenant ID
 * @param count - Number of seats to add
 * @returns Result with new seat count and proration amount
 * @throws Error if max_users limit would be exceeded
 */
export async function addSeats(
  tenantId: string,
  count: number
): Promise<SeatChangeResult> {
  if (count <= 0) {
    throw new Error('Seat count must be positive');
  }

  const stripe = getStripeClient();
  const db = getDbClient();

  // Get current subscription from DB
  const subscription = await getCurrentSubscription(tenantId);

  if (!subscription.stripeSubscriptionId) {
    throw new Error('No Stripe subscription found for tenant');
  }

  const currentSeatCount = subscription.seatCount || 1;
  const newSeatCount = currentSeatCount + count;

  // Check max_users limit from plan
  const maxUsers = subscription.plan?.maxUsers;
  if (maxUsers !== null && maxUsers !== undefined && newSeatCount > maxUsers) {
    throw new Error(
      `Cannot add ${count} seats. Would exceed plan limit of ${maxUsers} users (current: ${currentSeatCount})`
    );
  }

  // Get Stripe subscription
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId
  );

  if (!stripeSubscription.items.data.length) {
    throw new Error('Subscription has no items');
  }

  const subscriptionItem = stripeSubscription.items.data[0];

  // Update subscription item quantity with proration
  await stripe.subscriptionItems.update(subscriptionItem.id, {
    quantity: newSeatCount,
    proration_behavior: 'create_prorations',
  });

  // Update DB seat_count
  await db
    .update(schema.tenantSubscriptions)
    .set({
      seatCount: newSeatCount,
      updatedAt: new Date(),
    })
    .where(eq(schema.tenantSubscriptions.id, subscription.id));

  // Get proration amount from upcoming invoice
  let prorationAmount: number | undefined;
  try {
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: subscription.stripeCustomerId!,
    });

    // Find proration line items
    const prorationLines = upcomingInvoice.lines.data.filter(
      line => line.description?.toLowerCase().includes('proration')
    );

    if (prorationLines.length > 0) {
      prorationAmount = prorationLines.reduce((sum, line) => sum + line.amount, 0);
    }
  } catch (error) {
    // If we can't get the invoice, continue without proration amount
    console.warn('Could not retrieve upcoming invoice for proration:', error);
  }

  return {
    newSeatCount,
    previousSeatCount: currentSeatCount,
    prorationAmount,
  };
}

/**
 * Remove seats from a tenant's subscription
 *
 * @param tenantId - The tenant ID
 * @param count - Number of seats to remove
 * @param activeMemberCount - Optional active member count (will query if not provided)
 * @returns Result with new seat count
 * @throws Error if removal would drop below active member count
 */
export async function removeSeats(
  tenantId: string,
  count: number,
  activeMemberCount?: number
): Promise<SeatChangeResult> {
  if (count <= 0) {
    throw new Error('Seat count must be positive');
  }

  const stripe = getStripeClient();
  const db = getDbClient();

  // Get current subscription
  const subscription = await getCurrentSubscription(tenantId);

  if (!subscription.stripeSubscriptionId) {
    throw new Error('No Stripe subscription found for tenant');
  }

  const currentSeatCount = subscription.seatCount || 1;
  const newSeatCount = currentSeatCount - count;

  if (newSeatCount < 1) {
    throw new Error('Cannot reduce seats below 1');
  }

  // Get active member count if not provided
  if (activeMemberCount === undefined) {
    const members = await db.query.tenantMembers.findMany({
      where: and(
        eq(schema.tenantMembers.tenantId, tenantId),
        inArray(schema.tenantMembers.status, ['active', 'invited'])
      ),
    });
    activeMemberCount = members.length;
  }

  // Ensure we don't drop below current active member count
  if (newSeatCount < activeMemberCount) {
    throw new Error(
      `Cannot remove ${count} seats. Would drop below active member count of ${activeMemberCount} (current seats: ${currentSeatCount})`
    );
  }

  // Get Stripe subscription
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId
  );

  if (!stripeSubscription.items.data.length) {
    throw new Error('Subscription has no items');
  }

  const subscriptionItem = stripeSubscription.items.data[0];

  // Update subscription item quantity with proration
  await stripe.subscriptionItems.update(subscriptionItem.id, {
    quantity: newSeatCount,
    proration_behavior: 'create_prorations',
  });

  // Update DB seat_count
  await db
    .update(schema.tenantSubscriptions)
    .set({
      seatCount: newSeatCount,
      updatedAt: new Date(),
    })
    .where(eq(schema.tenantSubscriptions.id, subscription.id));

  return {
    newSeatCount,
    previousSeatCount: currentSeatCount,
  };
}

/**
 * Get current seat information for a tenant
 *
 * @param tenantId - The tenant ID
 * @returns Seat usage information
 */
export async function getSeatInfo(tenantId: string): Promise<SeatInfo> {
  const db = getDbClient();

  // Get subscription
  const subscription = await getCurrentSubscription(tenantId);

  // Get member counts
  const members = await db.query.tenantMembers.findMany({
    where: eq(schema.tenantMembers.tenantId, tenantId),
  });

  const activeMembers = members.filter(m => m.status === 'active').length;
  const invitedMembers = members.filter(m => m.status === 'invited').length;
  const totalSeats = subscription.seatCount || 1;
  const maxSeats = subscription.plan?.maxUsers ?? null;

  const usedSeats = activeMembers + invitedMembers;
  const canAddMore = maxSeats === null ? true : usedSeats < maxSeats;
  const availableSeats = maxSeats === null ? Infinity : maxSeats - usedSeats;

  return {
    activeMembers,
    invitedMembers,
    totalSeats,
    maxSeats,
    canAddMore,
    availableSeats: availableSeats === Infinity ? -1 : availableSeats,
  };
}

/**
 * Calculate preview of next invoice with seat changes
 *
 * @param tenantId - The tenant ID
 * @param seatChange - Number of seats to add (positive) or remove (negative)
 * @returns Invoice preview with cost impact
 */
export async function calculateNextInvoicePreview(
  tenantId: string,
  seatChange: number
): Promise<InvoicePreview> {
  const stripe = getStripeClient();
  const db = getDbClient();

  // Get subscription
  const subscription = await getCurrentSubscription(tenantId);

  if (!subscription.stripeSubscriptionId || !subscription.stripeCustomerId) {
    throw new Error('No Stripe subscription found for tenant');
  }

  // Get Stripe subscription for current quantity
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId
  );

  if (!stripeSubscription.items.data.length) {
    throw new Error('Subscription has no items');
  }

  const subscriptionItem = stripeSubscription.items.data[0];
  const currentQuantity = subscriptionItem.quantity || 1;
  const newQuantity = currentQuantity + seatChange;

  if (newQuantity < 1) {
    throw new Error('Cannot preview seats below 1');
  }

  // Get upcoming invoice with proposed quantity change
  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
    customer: subscription.stripeCustomerId,
    subscription: subscription.stripeSubscriptionId,
    subscription_items: [
      {
        id: subscriptionItem.id,
        quantity: newQuantity,
      },
    ],
  });

  // Extract proration lines
  const lines = upcomingInvoice.lines.data.map(line => ({
    description: line.description || 'Unknown',
    amount: line.amount,
  }));

  const prorationLines = upcomingInvoice.lines.data.filter(
    line => line.description?.toLowerCase().includes('proration')
  );

  const prorationAmount = prorationLines.reduce((sum, line) => sum + line.amount, 0);

  return {
    total: upcomingInvoice.total,
    prorationAmount,
    nextInvoiceDate: new Date(upcomingInvoice.period_end * 1000),
    lines,
  };
}
