import { pgTable, uuid, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { crewTemplates } from './crew-templates';

export const tenantCrewOverrides = pgTable('tenant_crew_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  crewTemplateId: uuid('crew_template_id').notNull().references(() => crewTemplates.id),
  isEnabled: boolean('is_enabled').notNull().default(true),
  overrideConfig: jsonb('override_config').$type<{
    agents?: Array<{ role: string; goal: string; backstory: string }>;
    tasks?: Array<{ description: string; expectedOutput: string }>;
    maxContext?: Record<string, number>;
  }>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
