import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
// TODO: Implement @wf/billing package in Phase 4
// import { cancelSubscription } from '@wf/billing';

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

      // Stub implementation for Phase 6 - will be replaced in Phase 4
      const result = {
        success: true,
        canceledImmediately: immediately,
        effectiveAt: immediately
          ? new Date().toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        error: undefined as string | undefined,
      };

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
