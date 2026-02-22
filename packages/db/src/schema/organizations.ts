import { pgTable, uuid, text, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  sourceProvider: text('source_provider'),
  sourceId: text('source_id'),
  name: text('name').notNull(),
  domain: text('domain'),
  industry: text('industry'),
  employeeCount: integer('employee_count'),
  annualRevenue: text('annual_revenue'),
  customFields: jsonb('custom_fields').default({}),
  sourceMetadata: jsonb('source_metadata').default({}),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
