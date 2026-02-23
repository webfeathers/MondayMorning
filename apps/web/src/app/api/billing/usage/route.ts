import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
// TODO: Implement @wf/billing package in Phase 4
// import { CreditManager } from '@wf/billing';

/**
 * GET /api/billing/usage
 *
 * Returns credit usage stats for current period using CreditManager
 * Requires billing:view permission (admin+)
 */
export const GET = withPermission(
  'billing:view',
  async (request: NextRequest, { userId, tenantId }) => {
    try {
      // Stub implementation for Phase 6 - will be replaced in Phase 4
      const usage = {
        period: '2026-02', // Current month period
        creditsUsed: 245,
        creditsAllowed: 500,
        creditsRemaining: 255,
        percentUsed: 49,
        warningThreshold: 80,
      };

      return NextResponse.json({
        usage: {
          period: usage.period,
          creditsUsed: usage.creditsUsed,
          creditsAllowed: usage.creditsAllowed,
          creditsRemaining: usage.creditsRemaining,
          percentUsed: usage.percentUsed,
          warningThreshold: usage.warningThreshold,
        },
      });
    } catch (error) {
      console.error('Error fetching credit usage:', error);
      return NextResponse.json(
        { error: 'Failed to fetch credit usage' },
        { status: 500 }
      );
    }
  }
);
