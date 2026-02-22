import { pgTable, uuid, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const customFieldDefinitions = pgTable('tenant_custom_field_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  entityType: text('entity_type').notNull(), // 'deal', 'organization', 'contact', etc.
  fieldName: text('field_name').notNull(), // Normalized field name in our schema
  fieldType: text('field_type').notNull(), // 'text', 'number', 'date', 'boolean', 'select', etc.
  sourceProvider: text('source_provider'), // Which CRM this field comes from
  sourceFieldName: text('source_field_name'), // Original field name in the CRM
  mappingStatus: text('mapping_status').notNull().default('pending'), // 'pending', 'active', 'reindexing'
  isRequired: boolean('is_required').notNull().default(false),
  defaultValue: text('default_value'),
  validationRules: jsonb('validation_rules').default({}), // Min/max, regex, allowed values, etc.
  displayOrder: text('display_order'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
