import { pgTable, uuid, boolean, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const tenantAuthSettings = pgTable('tenant_auth_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id).unique(),
  ssoEnabled: boolean('sso_enabled').notNull().default(false),
  ssoProvider: text('sso_provider'), // 'okta', 'azure_ad', 'google_workspace', etc.
  ssoConfig: jsonb('sso_config').$type<{
    domain?: string;
    clientId?: string;
    issuer?: string;
  }>().default({}),
  sessionDurationMs: integer('session_duration_ms').notNull().default(14 * 24 * 60 * 60 * 1000), // 14 days
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
