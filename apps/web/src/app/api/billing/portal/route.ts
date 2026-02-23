import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
import { getStripeClient } from '@wf/billing';
import { db, tenantSubscriptions } from '@wf/db';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * GET /api/billing/portal
 *
 * Creates and returns a Stripe billing portal session URL
 * Requires billing:view permission (admin+)
 */
export const GET = withPermission(
  'billing:view',
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      const stripe = getStripeClient();

      // Get tenant's Stripe customer ID
      const subscription = await db.query.tenantSubscriptions.findFirst({
        where: and(
          eq(tenantSubscriptions.tenantId, tenantId),
          inArray(tenantSubscriptions.status, ['active', 'trialing'])
        ),
      });

      if (!subscription || !subscription.stripeCustomerId) {
        return NextResponse.json(
          { error: 'No active subscription found' },
          { status: 404 }
        );
      }

      // Create billing portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${request.nextUrl.origin}/settings/billing`,
      });

      return NextResponse.json({
        url: session.url,
      });
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      return NextResponse.json(
        { error: 'Failed to create billing portal session' },
        { status: 500 }
      );
    }
  }
);
