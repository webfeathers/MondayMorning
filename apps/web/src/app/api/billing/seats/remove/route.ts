import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
// TODO: Implement @wf/billing package in Phase 4
// import { removeSeats } from '@wf/billing';

/**
 * POST /api/billing/seats/remove
 *
 * Removes seats from subscription
 * Requires billing:manage permission (owner only)
 */
export const POST = withPermission(
  'billing:manage',
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      const body = await request.json();
      const { count } = body;

      if (!count || typeof count !== 'number' || count <= 0) {
        return NextResponse.json(
          { error: 'count is required and must be a positive number' },
          { status: 400 }
        );
      }

      // Stub implementation for Phase 6 - will be replaced in Phase 4
      const result = {
        newSeatCount: Math.max(1, 10 - count),
        previousSeatCount: 10,
      };

      return NextResponse.json({
        newSeatCount: result.newSeatCount,
        previousSeatCount: result.previousSeatCount,
      });
    } catch (error) {
      console.error('Error removing seats:', error);

      // Handle specific error cases
      if (error instanceof Error && error.message.includes('below active member count')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to remove seats' },
        { status: 500 }
      );
    }
  }
);
