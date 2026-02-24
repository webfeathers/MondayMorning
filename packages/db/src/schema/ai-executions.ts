/**
 * Schema for AI crew executions and results.
 */

import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

/**
 * AI crew execution records.
 * Tracks all crew executions with their status and results.
 */
export const aiExecutions = pgTable('ai_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Crew details
  crewTemplateId: text('crew_template_id').notNull(), // e.g., 'account_health'
  entityType: text('entity_type'), // e.g., 'account', 'deal', 'ticket'
  entityId: text('entity_id'), // ID of the entity being analyzed

  // Execution status
  status: text('status').notNull().default('pending'), // pending, running, completed, failed, cancelled
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),

  // Input data
  contextData: jsonb('context_data'), // The assembled context passed to the crew
  crewConfig: jsonb('crew_config'), // The crew configuration used

  // Results
  result: jsonb('result'), // Structured output from the crew
  rawOutput: text('raw_output'), // Raw text output

  // Metrics
  tokenUsage: jsonb('token_usage'), // { prompt_tokens, completion_tokens, total_tokens }
  creditsConsumed: integer('credits_consumed').default(0),
  executionTimeSeconds: integer('execution_time_seconds'),
  modelName: text('model_name'),

  // Error information
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),

  // Metadata
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/**
 * AI execution job queue entries.
 * Jobs to be processed by the worker.
 */
export const aiExecutionJobs = pgTable('ai_execution_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  executionId: uuid('execution_id')
    .notNull()
    .references(() => aiExecutions.id, { onDelete: 'cascade' }),

  // Job details
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  priority: integer('priority').default(0), // Higher = more priority
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(3),

  // Scheduling
  scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'date' }),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),

  // Error tracking
  lastError: text('last_error'),
  errorDetails: jsonb('error_details'),

  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type AiExecution = typeof aiExecutions.$inferSelect;
export type NewAiExecution = typeof aiExecutions.$inferInsert;
export type AiExecutionJob = typeof aiExecutionJobs.$inferSelect;
export type NewAiExecutionJob = typeof aiExecutionJobs.$inferInsert;
