/**
 * Individual Field Mapping Update API
 *
 * PATCH /api/integrations/connections/[id]/field-mappings/[fieldId]
 * - Updates a single field mapping
 * - Enforces immutability: cannot modify active or reindexing mappings
 * - Only pending mappings can be updated
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, customFieldDefinitions, integrationConnections } from '@wf/db';
import { eq, and } from 'drizzle-orm';
import { withPermission } from '@/lib/require-permission';

/**
 * Update individual field mapping
 *
 * @permission integrations:connect
 * @body Partial field mapping updates (excluding mappingStatus)
 */
export const PATCH = withPermission(
  'integrations:connect',
  async (
    request: NextRequest,
    context: { params: any; userId: string; tenantId: string }
  ) => {
    try {
      const { id: connectionId, fieldId } = context.params;
      const updates = await request.json();

      // Fetch connection from database
      const connection = await db.query.integrationConnections.findFirst({
        where: eq(integrationConnections.id, connectionId),
      });

      if (!connection) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        );
      }

      // Verify connection belongs to current tenant
      if (connection.tenantId !== context.tenantId) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        );
      }

      // Fetch the field mapping
      const fieldMapping = await db.query.customFieldDefinitions.findFirst({
        where: and(
          eq(customFieldDefinitions.id, fieldId),
          eq(customFieldDefinitions.tenantId, context.tenantId)
        ),
      });

      if (!fieldMapping) {
        return NextResponse.json(
          { error: 'Field mapping not found' },
          { status: 404 }
        );
      }

      // Enforce immutability: only pending mappings can be updated
      if (fieldMapping.mappingStatus !== 'pending') {
        return NextResponse.json(
          {
            error: `Field mappings are immutable once ${fieldMapping.mappingStatus}. Cannot modify field mappings that are not in pending status.`,
          },
          { status: 400 }
        );
      }

      // Prevent direct mappingStatus changes
      if (updates.mappingStatus) {
        return NextResponse.json(
          {
            error:
              'Cannot directly change mappingStatus. Use /activate endpoint to transition from pending to active.',
          },
          { status: 400 }
        );
      }

      // Update the field mapping
      await db
        .update(customFieldDefinitions)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(customFieldDefinitions.id, fieldId));

      return NextResponse.json({
        success: true,
        message: 'Field mapping updated successfully',
      });
    } catch (error) {
      console.error('Error updating field mapping:', error);
      return NextResponse.json(
        { error: 'Failed to update field mapping' },
        { status: 500 }
      );
    }
  }
);
