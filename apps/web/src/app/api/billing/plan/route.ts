import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
import { getEntitlements } from '@wf/billing';

/**
 * GET /api/billing/plan
 *
 * Returns current plan, subscription details, and entitlements
 * Requires billing:view permission (admin+)
 */
export const GET = withPermission(
  'billing:view',
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      // Get full entitlement information
      const entitlements = await getEntitlements(tenantId);

      return NextResponse.json({
        plan: {
          slug: entitlements.subscription.planSlug,
          features: entitlements.features,
        },
        subscription: {
          status: entitlements.subscription.status,
        },
        entitlements: {
          seats: entitlements.seats,
          credits: entitlements.credits,
        },
      });
    } catch (error) {
      console.error('Error fetching billing plan:', error);
      return NextResponse.json(
        { error: 'Failed to fetch billing plan' },
        { status: 500 }
      );
    }
  }
);
