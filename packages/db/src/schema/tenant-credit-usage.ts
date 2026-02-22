import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const tenantCreditUsage = pgTable('tenant_credit_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  period: text('period').notNull(), // YYYY-MM format for monthly tracking
  creditsAllocated: integer('credits_allocated').notNull(),
  creditsUsed: integer('credits_used').notNull().default(0),
  creditsRemaining: integer('credits_remaining').notNull(),
  rolloverCredits: integer('rollover_credits').notNull().default(0),
  resetAt: timestamp('reset_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
