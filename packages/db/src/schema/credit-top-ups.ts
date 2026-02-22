import { pgTable, uuid, integer, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const creditTopUps = pgTable('credit_top_ups', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  credits: integer('credits').notNull(),
  amountPaid: numeric('amount_paid').notNull(),
  currency: text('currency').notNull().default('USD'),
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull(),
  status: text('status').notNull(), // succeeded, pending, failed
  purchasedBy: uuid('purchased_by').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
