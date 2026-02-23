import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { plans, tenantSubscriptions, tenantInvoices } from '@wf/db';

/**
 * Result of webhook handling
 */
export interface WebhookHandleResult {
  handled: boolean;
  eventId: string;
  eventType?: string;
}

/**
 * Main webhook handler - validates signature and routes to specific handlers
 */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string,
  webhookSecret: string,
  db: any // Using any for db type to avoid complex schema type imports
): Promise<WebhookHandleResult> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-01-27.acacia',
  });

  // Validate webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Invalid signature: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Route to specific handlers based on event type
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event, db);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event, db);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event, db);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event, db);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event, db);
      break;

    default:
      // Event type not handled - still return success to prevent retries
      return {
        handled: false,
        eventId: event.id,
        eventType: event.type,
      };
  }

  return {
    handled: true,
    eventId: event.id,
    eventType: event.type,
  };
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(
  event: Stripe.Event,
  db: any
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  // Extract tenant ID from metadata
  const tenantId = subscription.metadata.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID not found in metadata');
  }

  // Get the product ID from the subscription items to find the plan
  const priceId = subscription.items.data[0]?.price.id;
  const productId = typeof subscription.items.data[0]?.price.product === 'string'
    ? subscription.items.data[0]?.price.product
    : subscription.items.data[0]?.price.product?.id;

  // Find the plan by Stripe product ID
  const planResults = await db
    .select()
    .from(plans)
    .where(eq(plans.stripeProductId, productId!));

  const plan = planResults[0];
  if (!plan) {
    throw new Error(`Plan not found for product ID: ${productId}`);
  }

  // Get seat count from quantity
  const seatCount = subscription.items.data[0]?.quantity ?? 1;

  // Create subscription record (idempotent via onConflictDoNothing)
  await db
    .insert(tenantSubscriptions)
    .values({
      tenantId,
      planId: plan.id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      status: subscription.status,
      seatCount,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ? new Date(subscription.cancel_at_period_end * 1000) : null,
    })
    .onConflictDoNothing();
}

/**
 * Handle subscription update
 */
async function handleSubscriptionUpdated(
  event: Stripe.Event,
  db: any
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  // Extract tenant ID from metadata
  const tenantId = subscription.metadata.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID not found in metadata');
  }

  // Get the product ID from the subscription items to find the plan
  const productId = typeof subscription.items.data[0]?.price.product === 'string'
    ? subscription.items.data[0]?.price.product
    : subscription.items.data[0]?.price.product?.id;

  // Find the plan by Stripe product ID
  const planResults = await db
    .select()
    .from(plans)
    .where(eq(plans.stripeProductId, productId!));

  const plan = planResults[0];
  if (!plan) {
    throw new Error(`Plan not found for product ID: ${productId}`);
  }

  // Get seat count from quantity
  const seatCount = subscription.items.data[0]?.quantity ?? 1;

  // Update subscription record
  await db
    .update(tenantSubscriptions)
    .set({
      planId: plan.id,
      status: subscription.status,
      seatCount,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ? new Date(subscription.cancel_at_period_end * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(tenantSubscriptions.stripeSubscriptionId, subscription.id));
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(
  event: Stripe.Event,
  db: any
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  // Extract tenant ID from metadata
  const tenantId = subscription.metadata.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID not found in metadata');
  }

  // Mark subscription as canceled
  await db
    .update(tenantSubscriptions)
    .set({
      status: 'canceled',
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tenantSubscriptions.stripeSubscriptionId, subscription.id));
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  db: any
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  // Extract tenant ID from metadata
  const tenantId = invoice.metadata.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID not found in metadata');
  }

  // Find the subscription record by Stripe subscription ID
  let subscriptionId: string | null = null;
  if (invoice.subscription) {
    const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
    const subscriptionResults = await db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.stripeSubscriptionId, stripeSubId));

    subscriptionId = subscriptionResults[0]?.id ?? null;
  }

  // Convert cents to dollars
  const amountDue = (invoice.amount_due / 100).toFixed(2);
  const amountPaid = (invoice.amount_paid / 100).toFixed(2);

  // Create invoice record (idempotent via onConflictDoNothing)
  await db
    .insert(tenantInvoices)
    .values({
      tenantId,
      subscriptionId,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id ?? null,
      status: invoice.status ?? 'draft',
      amountDue,
      amountPaid,
      currency: invoice.currency.toUpperCase(),
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
      metadata: invoice.metadata as any,
    })
    .onConflictDoNothing();
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  db: any
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  // Extract tenant ID from metadata
  const tenantId = invoice.metadata.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID not found in metadata');
  }

  // Update existing invoice status
  await db
    .update(tenantInvoices)
    .set({
      status: invoice.status ?? 'open',
      updatedAt: new Date(),
    })
    .where(eq(tenantInvoices.stripeInvoiceId, invoice.id));
}
