import { pgTable, uuid, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { crewTemplates } from './crew-templates';

export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  crewTemplateId: uuid('crew_template_id').references(() => crewTemplates.id),
  jobId: uuid('job_id'), // references jobs.id but avoiding circular dependency
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  creditsUsed: numeric('credits_used').notNull().default('0'),
  executionTimeMs: integer('execution_time_ms'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
