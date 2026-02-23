import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
// TODO: Implement @wf/billing package in Phase 4
// import { getStripeClient } from '@wf/billing';
import { db, tenantSubscriptions } from '@wf/db';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * GET /api/billing/portal
 *
 * Creates and returns a Stripe billing portal session URL
 * Requires billing:view permission (admin+)
 *
 * TODO: This is a stub - implement in Phase 4 when @wf/billing is ready
 */
export const GET = withPermission(
  'billing:view',
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      // TODO: Implement Stripe billing portal in Phase 4
      // const stripe = getStripeClient();

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

      // TODO: Create billing portal session with Stripe in Phase 4
      // const session = await stripe.billingPortal.sessions.create({
      //   customer: subscription.stripeCustomerId,
      //   return_url: `${request.nextUrl.origin}/settings/billing`,
      // });

      // Stub response for now
      return NextResponse.json({
        url: 'https://billing.stripe.com/session/stub',
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
