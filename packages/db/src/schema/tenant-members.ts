import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const tenantMembers = pgTable('tenant_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id), // Nullable for invited members who haven't accepted yet
  email: text('email'), // Store email for invited members
  role: text('role').notNull().default('member'),
  appRole: text('app_role').notNull().default('ae'),
  invitedBy: uuid('invited_by').references(() => users.id),
  invitationTokenHash: text('invitation_token_hash'), // SHA-256 hash of invitation token
  invitationCreatedAt: timestamp('invitation_created_at', { withTimezone: true, mode: 'date' }),
  joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }),
  status: text('status').notNull().default('invited'), // 'invited' or 'active'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
