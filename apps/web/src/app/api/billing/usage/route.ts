import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';
import { CreditManager } from '@wf/billing';

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
      const creditManager = new CreditManager(tenantId);
      const usage = await creditManager.getCurrentPeriodUsage();

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
