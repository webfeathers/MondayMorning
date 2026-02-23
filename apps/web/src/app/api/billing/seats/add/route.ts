import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
import { addSeats } from '@wf/billing';

/**
 * POST /api/billing/seats/add
 *
 * Adds seats to subscription with prorated charge
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

      const result = await addSeats(tenantId, count);

      return NextResponse.json({
        newSeatCount: result.newSeatCount,
        previousSeatCount: result.previousSeatCount,
        prorationAmount: result.prorationAmount,
      });
    } catch (error) {
      console.error('Error adding seats:', error);

      // Handle specific error cases
      if (error instanceof Error && error.message.includes('exceed plan limit')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to add seats' },
        { status: 500 }
      );
    }
  }
);
