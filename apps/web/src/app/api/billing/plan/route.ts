import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
// TODO: Implement @wf/billing package in Phase 4
// import { getEntitlements } from '@wf/billing';

/**
 * GET /api/billing/plan
 *
 * Returns current plan, subscription details, and entitlements
 * Requires billing:view permission (admin+)
 *
 * TODO: This is a stub - implement in Phase 4 when @wf/billing is ready
 */
export const GET = withPermission(
  'billing:view',
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      // TODO: Implement getEntitlements from @wf/billing in Phase 4
      // const entitlements = await getEntitlements(tenantId);

      // Stub response for now
      return NextResponse.json({
        plan: {
          slug: 'pro',
          features: {
            configurableDashboards: true,
            webhookSync: true,
            whiteLabel: false,
            apiAccess: false,
          },
        },
        subscription: {
          status: 'active',
        },
        entitlements: {
          seats: { used: 1, limit: 50 },
          credits: { used: 0, limit: 500, remaining: 500 },
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
