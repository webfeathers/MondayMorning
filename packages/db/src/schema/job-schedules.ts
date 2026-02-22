import { pgTable, uuid, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const jobSchedules = pgTable('job_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  jobType: text('job_type').notNull(),
  cronExpression: text('cron_expression').notNull(), // e.g., "0 */6 * * *" for every 6 hours
  payload: jsonb('payload').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true, mode: 'date' }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
