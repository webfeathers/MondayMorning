import { pgTable, uuid, text, integer, numeric, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';
import { aiExecutions } from './ai-executions';

/**
 * AI usage tracking table for analytics and billing.
 * Records every AI API call with token usage, cost, and performance metrics.
 */
export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),

  // References
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  executionId: uuid('execution_id').references(() => aiExecutions.id, { onDelete: 'set null' }),

  // Crew details
  crewTemplateId: text('crew_template_id').notNull(), // e.g., 'account_health'
  entityType: text('entity_type'), // e.g., 'account', 'deal'
  entityId: text('entity_id'),

  // Model and tokens
  modelName: text('model_name').notNull(), // e.g., 'claude-sonnet-4-20250514'
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),

  // Cost and credits
  estimatedCostUsd: numeric('estimated_cost_usd', { precision: 10, scale: 6 }), // Actual USD cost estimate
  creditsConsumed: integer('credits_consumed').notNull().default(0), // Platform credits used

  // Performance
  executionTimeSeconds: integer('execution_time_seconds'),

  // Status
  status: text('status').notNull().default('completed'), // completed, failed, partial
  errorMessage: text('error_message'),

  // Additional context
  metadata: jsonb('metadata'), // Additional tracking data

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type AiUsage = typeof aiUsage.$inferSelect;
export type NewAiUsage = typeof aiUsage.$inferInsert;
