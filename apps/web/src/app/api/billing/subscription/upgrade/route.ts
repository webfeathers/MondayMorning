import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
import { upgradeSubscription } from '@wf/billing';

/**
 * POST /api/billing/subscription/upgrade
 *
 * Upgrades subscription to a new plan
 * Requires billing:manage permission (owner only)
 */
export const POST = withPermission(
  'billing:manage',
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      const body = await request.json();
      const { newPlanSlug } = body;

      if (!newPlanSlug || typeof newPlanSlug !== 'string') {
        return NextResponse.json(
          { error: 'newPlanSlug is required and must be a string' },
          { status: 400 }
        );
      }

      const result = await upgradeSubscription(tenantId, newPlanSlug);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to upgrade subscription' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        newPlanSlug: result.newPlanSlug,
        prorationInvoiceId: result.prorationInvoiceId,
        prorationAmount: result.prorationAmount,
      });
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      return NextResponse.json(
        { error: 'Failed to upgrade subscription' },
        { status: 500 }
      );
    }
  }
);
