import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  resource: text('resource').notNull(), // 'dashboard', 'settings', 'crew', 'integrations', etc.
  action: text('action').notNull(), // 'view', 'create', 'update', 'delete', 'execute'
  description: text('description'),
  requiredRole: text('required_role').notNull(), // 'member', 'admin', 'owner'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
