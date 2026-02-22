import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const tenantAiSettings = pgTable('tenant_ai_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id).unique(),
  preferredModel: text('preferred_model').notNull().default('gemini-2.0-flash'),
  maxConcurrentCrews: integer('max_concurrent_crews').notNull().default(1),
  autoRunEnabled: boolean('auto_run_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
