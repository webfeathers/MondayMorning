import { pgTable, uuid, text, jsonb, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const crewTemplates = pgTable('crew_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  maxContext: jsonb('max_context').$type<{
    deals?: number;
    meetings?: number;
    tickets?: number;
    contacts?: number;
    organizations?: number;
  }>().notNull().default({}),
  estimatedCreditCost: integer('estimated_credit_cost').notNull().default(1),
  config: jsonb('config').$type<{
    agents?: Array<{ role: string; goal: string; backstory: string }>;
    tasks?: Array<{ description: string; expectedOutput: string }>;
    contextRequirements?: string[];
  }>().notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
