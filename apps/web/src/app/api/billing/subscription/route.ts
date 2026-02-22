import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';

/**
 * GET /api/billing/subscription
 * Protected route that requires 'billing:view' permission (admin+)
 */
export const GET = withPermission(
  'billing:view',
  async (request, { userId, tenantId }) => {
    // User is guaranteed to have 'billing:view' permission (admin or owner)

    return NextResponse.json({
      success: true,
      subscription: {
        tenantId,
        plan: 'pro',
        status: 'active',
        seats: 10,
        billingPeriod: 'monthly',
        currentPeriodEnd: '2026-03-22',
      },
    });
  }
);

/**
 * PATCH /api/billing/subscription
 * Protected route that requires 'billing:manage' permission (owner only)
 *
 * This demonstrates the highest permission level - only tenant owners can manage billing.
 */
export const PATCH = withPermission(
  'billing:manage',
  async (request, { userId, tenantId }) => {
    // User is guaranteed to have 'billing:manage' permission (owner only)

    const body = await request.json();

    // Update subscription
    // ... actual Stripe integration would go here

    return NextResponse.json({
      success: true,
      message: 'Subscription updated successfully',
      updatedBy: userId,
      tenantId,
      updates: body,
    });
  }
);
