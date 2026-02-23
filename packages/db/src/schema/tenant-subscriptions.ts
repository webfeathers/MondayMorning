import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenants';
import { plans } from './plans';

export const tenantSubscriptions = pgTable('tenant_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  scheduledPlanId: uuid('scheduled_plan_id').references(() => plans.id), // For downgrades scheduled at period end
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionScheduleId: text('stripe_subscription_schedule_id'), // For tracking scheduled changes
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

export const tenantSubscriptionsRelations = relations(tenantSubscriptions, ({ one }) => ({
  plan: one(plans, {
    fields: [tenantSubscriptions.planId],
    references: [plans.id],
  }),
  tenant: one(tenants, {
    fields: [tenantSubscriptions.tenantId],
    references: [tenants.id],
  }),
}));
