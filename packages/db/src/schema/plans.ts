import { pgTable, uuid, text, jsonb, integer, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  monthlyCredits: integer('monthly_credits'), // nullable = unlimited
  maxUsers: integer('max_users'), // nullable = unlimited
  allowedModels: jsonb('allowed_models').$type<string[]>().notNull().default([]),
  allowedIntegrationTypes: jsonb('allowed_integration_types').$type<string[]>().notNull().default([]),
  features: jsonb('features').$type<{
    configurableDashboards: boolean;
    webhookSync: boolean;
    whiteLabel: boolean;
    apiAccess: boolean;
  }>().notNull().default({}),
  pricePerSeatMonthly: numeric('price_per_seat_monthly'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
