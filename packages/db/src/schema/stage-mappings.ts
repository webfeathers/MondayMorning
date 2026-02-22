import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { integrationConnections } from './integration-connections';

export const stageMappings = pgTable('stage_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  integrationConnectionId: uuid('integration_connection_id').notNull().references(() => integrationConnections.id),
  sourceStage: text('source_stage').notNull(), // Original stage name from CRM (e.g., "Closed Won")
  normalizedStage: text('normalized_stage').notNull(), // Our normalized stage name (e.g., "won")
  isClosed: boolean('is_closed').notNull().default(false), // Is this a terminal/closed stage?
  isWon: boolean('is_won').notNull().default(false), // Did we win the deal? (only meaningful if isClosed=true)
  sortOrder: text('sort_order'), // For pipeline visualization
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
