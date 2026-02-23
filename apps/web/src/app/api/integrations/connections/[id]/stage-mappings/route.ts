/**
 * Stage Mappings API
 *
 * POST /api/integrations/connections/[id]/stage-mappings
 * - Saves stage mappings with terminal state flags (is_closed, is_won)
 * - Validates required fields and boolean flags
 * - Enables CRM-agnostic terminal stage queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, stageMappings, integrationConnections } from '@wf/db';
import { eq } from 'drizzle-orm';
import { withPermission } from '@/lib/require-permission';

/**
 * Validate stage mapping structure
 */
function validateStageMapping(mapping: any): string | null {
  if (!mapping.sourceStage) return 'sourceStage is required';
  if (!mapping.normalizedStage) return 'normalizedStage is required';
  if (typeof mapping.isClosed !== 'boolean') return 'isClosed must be a boolean';
  if (typeof mapping.isWon !== 'boolean') return 'isWon must be a boolean';
  return null;
}

/**
 * Save stage mappings for a connection
 *
 * @permission integrations:connect
 * @body mappings - Array of stage mapping objects with terminal state flags
 */
export const POST = withPermission(
  'integrations:connect',
  async (request: NextRequest, context: { params: any; userId: string; tenantId: string }) => {
    try {
      const { id: connectionId } = context.params;
      const body = await request.json();
      const { mappings } = body;

      // Validate request body
      if (!Array.isArray(mappings)) {
        return NextResponse.json(
          { error: 'mappings must be an array' },
          { status: 400 }
        );
      }

      // Validate each mapping
      for (const mapping of mappings) {
        const error = validateStageMapping(mapping);
        if (error) {
          return NextResponse.json({ error }, { status: 400 });
        }
      }

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

      // Insert stage mappings
      const stageMappingRecords = mappings.map((mapping) => ({
        tenantId: context.tenantId,
        integrationConnectionId: connectionId,
        sourceStage: mapping.sourceStage,
        normalizedStage: mapping.normalizedStage,
        isClosed: mapping.isClosed,
        isWon: mapping.isWon,
        sortOrder: mapping.sortOrder || null,
      }));

      await db.insert(stageMappings).values(stageMappingRecords);

      return NextResponse.json(
        {
          success: true,
          count: stageMappingRecords.length,
          message: 'Stage mappings saved successfully',
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Error saving stage mappings:', error);
      return NextResponse.json(
        { error: 'Failed to save stage mappings' },
        { status: 500 }
      );
    }
  }
);
