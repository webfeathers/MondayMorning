import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { plans } from './plans';

export const tenantSubscriptions = pgTable('tenant_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  status: text('status').notNull(), // active, trialing, past_due, canceled, unpaid
  seatCount: integer('seat_count').notNull().default(1),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true, mode: 'date' }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'date' }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true, mode: 'date' }),
  canceledAt: timestamp('canceled_at', { withTimezone: true, mode: 'date' }),
  cancelAtPeriodEnd: timestamp('cancel_at_period_end', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
