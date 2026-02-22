import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const dashboardConfigs = pgTable('dashboard_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id), // null = default for role
  role: text('role'), // 'exec', 'ae', 'csm', etc. - used when userId is null
  layout: jsonb('layout').$type<{
    columns?: number;
    rows?: Array<{ height: number }>;
  }>().notNull().default({}),
  widgets: jsonb('widgets').$type<Array<{
    id: string;
    type: string;
    position: { x: number; y: number; w: number; h: number };
    config?: Record<string, unknown>;
  }>>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
