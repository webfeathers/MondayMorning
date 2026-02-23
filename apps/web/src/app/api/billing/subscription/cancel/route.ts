import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
import { cancelSubscription } from '@wf/billing';

/**
 * POST /api/billing/subscription/cancel
 *
 * Cancels subscription either immediately or at period end
 * Requires billing:manage permission (owner only)
 */
export const POST = withPermission(
  'billing:manage',
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      const body = await request.json();
      const { immediately = false } = body;

      const result = await cancelSubscription(tenantId, immediately);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to cancel subscription' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        canceledImmediately: result.canceledImmediately,
        effectiveAt: result.effectiveAt,
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }
  }
);
