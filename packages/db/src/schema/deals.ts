import { pgTable, uuid, text, jsonb, timestamp, integer, numeric, date } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { organizations } from './organizations';
import { tenantMembers } from './tenant-members';

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  sourceProvider: text('source_provider'),
  sourceId: text('source_id'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  name: text('name').notNull(),
  amount: numeric('amount'),
  currency: text('currency').notNull().default('USD'),
  stage: text('stage'),
  probability: integer('probability'),
  closeDate: date('close_date'),
  ownerId: uuid('owner_id').references(() => tenantMembers.id),
  customFields: jsonb('custom_fields').default({}),
  sourceMetadata: jsonb('source_metadata').default({}),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
