import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { organizations } from './organizations';

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  sourceProvider: text('source_provider'),
  sourceId: text('source_id'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  title: text('title'),
  customFields: jsonb('custom_fields').default({}),
  sourceMetadata: jsonb('source_metadata').default({}),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
