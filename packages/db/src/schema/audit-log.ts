import { pgTable, uuid, text, jsonb, inet, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id), // nullable for system actions
  action: text('action').notNull(), // 'created', 'updated', 'deleted', 'accessed', etc.
  resource: text('resource').notNull(), // 'tenant', 'user', 'integration', 'crew', etc.
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata').default({}), // before/after values, additional context
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
