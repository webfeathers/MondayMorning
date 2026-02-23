import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
import { db, tenantInvoices } from '@wf/db';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/billing/invoices
 *
 * Returns invoice history from database
 * Requires billing:view permission (admin+)
 */
export const GET = withPermission(
  'billing:view',
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      // Query invoices for this tenant, ordered by date (newest first)
      const invoices = await db.query.tenantInvoices.findMany({
        where: eq(tenantInvoices.tenantId, tenantId),
        orderBy: [desc(tenantInvoices.createdAt)],
        limit: 50, // Return last 50 invoices
      });

      return NextResponse.json({
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          stripeInvoiceId: invoice.stripeInvoiceId,
          amountDue: invoice.amountDue,
          amountPaid: invoice.amountPaid,
          currency: invoice.currency,
          status: invoice.status,
          createdAt: invoice.createdAt,
          dueDate: invoice.dueDate,
          paidAt: invoice.paidAt,
          invoiceUrl: invoice.invoiceUrl,
        })),
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return NextResponse.json(
        { error: 'Failed to fetch invoices' },
        { status: 500 }
      );
    }
  }
);
