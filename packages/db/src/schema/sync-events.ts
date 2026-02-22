import { pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { integrationConnections } from './integration-connections';

export const syncEvents = pgTable('sync_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  integrationConnectionId: uuid('integration_connection_id').notNull().references(() => integrationConnections.id),
  eventType: text('event_type').notNull(), // 'full_sync', 'incremental_sync', 'manual_sync', 'webhook_sync'
  entityType: text('entity_type').notNull(), // 'deal', 'organization', 'contact', 'meeting', etc.
  recordsProcessed: integer('records_processed').notNull().default(0),
  recordsCreated: integer('records_created').notNull().default(0),
  recordsUpdated: integer('records_updated').notNull().default(0),
  recordsSkipped: integer('records_skipped').notNull().default(0),
  recordsFailed: integer('records_failed').notNull().default(0),
  status: text('status').notNull(), // 'running', 'completed', 'failed', 'partial'
  errorMessage: text('error_message'),
  metadata: jsonb('metadata').default({}), // Sync cursor, error details, performance metrics, etc.
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(), // Append-only: never update after creation
});
