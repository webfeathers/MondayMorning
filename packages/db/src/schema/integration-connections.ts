import { pgTable, uuid, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const integrationConnections = pgTable('integration_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  providerType: text('provider_type').notNull(), // 'crm', 'meeting', 'ticketing', etc.
  providerName: text('provider_name').notNull(), // 'salesforce', 'hubspot', 'avoma', etc.
  credentials: jsonb('credentials').notNull(), // Encrypted OAuth tokens, API keys, etc.
  syncState: jsonb('sync_state').default({}), // Last sync cursor, watermarks, etc.
  syncSchedule: text('sync_schedule'), // Cron expression or interval
  isActive: boolean('is_active').notNull().default(true),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),
  lastSyncStatus: text('last_sync_status'), // 'success', 'failed', 'partial'
  lastSyncError: text('last_sync_error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
