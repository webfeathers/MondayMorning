import { pgTable, uuid, text, numeric, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { tenantSubscriptions } from './tenant-subscriptions';

export const tenantInvoices = pgTable('tenant_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  subscriptionId: uuid('subscription_id').references(() => tenantSubscriptions.id),
  stripeInvoiceId: text('stripe_invoice_id').notNull().unique(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  status: text('status').notNull(), // draft, open, paid, void, uncollectible
  amountDue: numeric('amount_due').notNull(),
  amountPaid: numeric('amount_paid').notNull().default('0'),
  currency: text('currency').notNull().default('USD'),
  invoiceUrl: text('invoice_url'),
  invoicePdf: text('invoice_pdf'),
  dueDate: timestamp('due_date', { withTimezone: true, mode: 'date' }),
  paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
