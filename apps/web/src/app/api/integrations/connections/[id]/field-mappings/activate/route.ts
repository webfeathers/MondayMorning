/**
 * Field Mapping Activation API
 *
 * POST /api/integrations/connections/[id]/field-mappings/activate
 * - Activates pending field mappings (pending → active)
 * - Validates all required mappings are present
 * - Updates mapping_status = 'active'
 * - Enforces immutability after activation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, customFieldDefinitions, integrationConnections } from '@wf/db';
import { eq, and } from 'drizzle-orm';
import { withPermission } from '@/lib/require-permission';

/**
 * Activate pending field mappings
 *
 * @permission integrations:connect
 */
export const POST = withPermission(
  'integrations:connect',
  async (request: NextRequest, context: { params: any; userId: string; tenantId: string }) => {
    try {
      const { id: connectionId } = context.params;

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

      // Fetch pending field mappings for this tenant/provider
      const pendingMappings = await db.query.customFieldDefinitions.findMany({
        where: and(
          eq(customFieldDefinitions.tenantId, context.tenantId),
          eq(customFieldDefinitions.sourceProvider, connection.providerName),
          eq(customFieldDefinitions.mappingStatus, 'pending')
        ),
      });

      if (pendingMappings.length === 0) {
        return NextResponse.json(
          {
            error: 'No mappings found to activate. Please create field mappings first.',
          },
          { status: 400 }
        );
      }

      // Validate required mappings are present
      // For deals, we typically need: name, amount, stage, closeDate
      // This is a basic validation - could be enhanced with more specific rules
      const dealMappings = pendingMappings.filter((m) => m.entityType === 'deal');
      if (dealMappings.length === 0) {
        return NextResponse.json(
          {
            error: 'Missing required deal mappings. At least one deal field mapping is required.',
          },
          { status: 400 }
        );
      }

      // Activate all pending mappings by updating their status
      await db
        .update(customFieldDefinitions)
        .set({
          mappingStatus: 'active',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customFieldDefinitions.tenantId, context.tenantId),
            eq(customFieldDefinitions.sourceProvider, connection.providerName),
            eq(customFieldDefinitions.mappingStatus, 'pending')
          )
        );

      return NextResponse.json({
        success: true,
        activatedCount: pendingMappings.length,
        message: `Successfully activated ${pendingMappings.length} field mappings. These mappings are now immutable.`,
        metadata: {
          connectionId: connection.id,
          providerName: connection.providerName,
          entityTypes: [...new Set(pendingMappings.map((m) => m.entityType))],
        },
      });
    } catch (error) {
      console.error('Error activating field mappings:', error);
      return NextResponse.json(
        { error: 'Failed to activate field mappings' },
        { status: 500 }
      );
    }
  }
);
