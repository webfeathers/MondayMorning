import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/require-permission';

/**
 * GET /api/settings
 * Protected route that requires 'settings:view' permission
 *
 * This demonstrates how to use the permission system to protect API routes.
 * The withPermission wrapper automatically checks permissions before executing the handler.
 */
export const GET = withPermission(
  'settings:view',
  async (request, { userId, tenantId }) => {
    // User is guaranteed to have 'settings:view' permission here
    // This would typically fetch tenant settings from the database

    return NextResponse.json({
      success: true,
      settings: {
        tenantId,
        userId,
        // Example settings data
        notifications: {
          email: true,
          slack: false,
        },
        integrations: {
          crm: 'salesforce',
          meeting: 'avoma',
        },
      },
    });
  }
);

/**
 * PATCH /api/settings
 * Protected route that requires 'settings:update' permission
 *
 * This demonstrates a higher permission level (admin) required for updates.
 */
export const PATCH = withPermission(
  'settings:update',
  async (request, { userId, tenantId }) => {
    // User is guaranteed to have 'settings:update' permission here
    // This would typically update tenant settings in the database

    const body = await request.json();

    // Validate and update settings
    // ... actual update logic would go here

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      updatedBy: userId,
      tenantId,
      updates: body,
    });
  }
);

/**
 * DELETE /api/settings
 * Protected route that requires 'settings:update' permission
 *
 * This demonstrates deleting/resetting settings.
 */
export const DELETE = withPermission(
  'settings:update',
  async (request, { userId, tenantId }) => {
    // User is guaranteed to have 'settings:update' permission here
    // This would typically reset tenant settings to defaults

    return NextResponse.json({
      success: true,
      message: 'Settings reset to defaults',
      resetBy: userId,
      tenantId,
    });
  }
);
