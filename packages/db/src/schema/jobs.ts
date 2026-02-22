import { pgTable, uuid, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  type: text('type').notNull(), // 'sync_crm', 'run_crew', 'send_notification', etc.
  status: text('status').notNull().default('queued'), // 'queued', 'running', 'completed', 'failed', 'stalled'
  priority: integer('priority').notNull().default(1),
  payload: jsonb('payload').notNull().default({}),
  result: jsonb('result').default({}),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  lockedBy: text('locked_by'), // worker instance ID
  lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'date' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
