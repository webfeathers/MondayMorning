import type Stripe from 'stripe';

/**
 * Customer data mapped from Stripe to our domain
 */
export interface CustomerData {
  id: string;
  email: string | null;
  name: string | null;
  metadata: Record<string, string>;
  created: Date;
  balance: number;
  currency: string | null;
  defaultPaymentMethod: string | null;
}

/**
 * Subscription data mapped from Stripe to our domain
 */
export interface SubscriptionData {
  id: string;
  customerId: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  canceledAt: Date | null;
  cancelAtPeriodEnd: boolean;
  items: SubscriptionItemData[];
  metadata: Record<string, string>;
}

/**
 * Subscription item (represents a price on a subscription)
 */
export interface SubscriptionItemData {
  id: string;
  priceId: string;
  productId: string;
  quantity: number;
}

/**
 * Invoice data mapped from Stripe to our domain
 */
export interface InvoiceData {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Price data mapped from Stripe to our domain
 */
export interface PriceData {
  id: string;
  productId: string;
  active: boolean;
  currency: string;
  unitAmount: number | null;
  recurring: {
    interval: 'day' | 'week' | 'month' | 'year';
    intervalCount: number;
  } | null;
  type: 'one_time' | 'recurring';
  metadata: Record<string, string>;
}

/**
 * Product data mapped from Stripe to our domain
 */
export interface ProductData {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, string>;
  images: string[];
}

/**
 * Helper functions to convert Stripe objects to our domain types
 */
export function mapStripeCustomer(customer: Stripe.Customer): CustomerData {
  return {
    id: customer.id,
    email: customer.email ?? null,
    name: customer.name ?? null,
    metadata: customer.metadata,
    created: new Date(customer.created * 1000),
    balance: customer.balance,
    currency: customer.currency ?? null,
    defaultPaymentMethod: typeof customer.invoice_settings.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings.default_payment_method?.id ?? null,
  };
}

export function mapStripeSubscription(subscription: Stripe.Subscription): SubscriptionData {
  return {
    id: subscription.id,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    items: subscription.items.data.map((item) => ({
      id: item.id,
      priceId: typeof item.price === 'string' ? item.price : item.price.id,
      productId: typeof item.price === 'string' ? '' : (typeof item.price.product === 'string' ? item.price.product : item.price.product.id),
      quantity: item.quantity ?? 1,
    })),
    metadata: subscription.metadata,
  };
}

export function mapStripeInvoice(invoice: Stripe.Invoice): InvoiceData {
  return {
    id: invoice.id,
    customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? '',
    subscriptionId: typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null,
    status: invoice.status ?? 'draft',
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    created: new Date(invoice.created * 1000),
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
    paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
    periodStart: new Date(invoice.period_start * 1000),
    periodEnd: new Date(invoice.period_end * 1000),
  };
}

export function mapStripePrice(price: Stripe.Price): PriceData {
  return {
    id: price.id,
    productId: typeof price.product === 'string' ? price.product : price.product.id,
    active: price.active,
    currency: price.currency,
    unitAmount: price.unit_amount,
    recurring: price.recurring ? {
      interval: price.recurring.interval,
      intervalCount: price.recurring.interval_count,
    } : null,
    type: price.type,
    metadata: price.metadata,
  };
}

export function mapStripeProduct(product: Stripe.Product): ProductData {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    active: product.active,
    metadata: product.metadata,
    images: product.images,
  };
}
