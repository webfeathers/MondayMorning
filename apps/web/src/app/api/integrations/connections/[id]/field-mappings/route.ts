/**
 * Field Mappings API
 *
 * POST /api/integrations/connections/[id]/field-mappings
 * - Saves tenant's reviewed field mappings with immutable status tracking
 * - Sets initial mapping_status to 'pending'
 * - Validates each mapping (sourceField, targetField, entity type)
 *
 * GET /api/integrations/connections/[id]/field-mappings
 * - Retrieves all field mappings for a connection
 * - Returns both field mappings and stage mappings
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, customFieldDefinitions, stageMappings, integrationConnections } from '@wf/db';
import { eq, and } from 'drizzle-orm';
import { withPermission } from '@/lib/require-permission';

/**
 * Validate field mapping structure
 */
function validateFieldMapping(mapping: any): string | null {
  if (!mapping.entityType) return 'entityType is required';
  if (!mapping.fieldName) return 'fieldName is required';
  if (!mapping.fieldType) return 'fieldType is required';
  return null;
}

/**
 * Save field mappings for a connection
 *
 * @permission integrations:connect
 * @body mappings - Array of field mapping objects
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
        const error = validateFieldMapping(mapping);
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

      // Insert field mappings with pending status
      const mappingRecords = mappings.map((mapping) => ({
        tenantId: context.tenantId,
        entityType: mapping.entityType,
        fieldName: mapping.fieldName,
        fieldType: mapping.fieldType,
        sourceProvider: mapping.sourceProvider || connection.providerName,
        sourceFieldName: mapping.sourceFieldName || null,
        mappingStatus: 'pending' as const,
        isRequired: mapping.isRequired || false,
        defaultValue: mapping.defaultValue || null,
        validationRules: mapping.validationRules || {},
        displayOrder: mapping.displayOrder || null,
      }));

      await db.insert(customFieldDefinitions).values(mappingRecords);

      return NextResponse.json(
        {
          success: true,
          count: mappingRecords.length,
          status: 'pending',
          message: 'Field mappings saved. Call /activate to make them active.',
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Error saving field mappings:', error);
      return NextResponse.json(
        { error: 'Failed to save field mappings' },
        { status: 500 }
      );
    }
  }
);

/**
 * Retrieve all field mappings for a connection
 *
 * @permission integrations:view
 */
export const GET = withPermission(
  'integrations:view',
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

      // Fetch field mappings
      const fieldMappings = await db.query.customFieldDefinitions.findMany({
        where: and(
          eq(customFieldDefinitions.tenantId, context.tenantId),
          eq(customFieldDefinitions.sourceProvider, connection.providerName)
        ),
      });

      // Fetch stage mappings
      const stageMappingsData = await db.query.stageMappings.findMany({
        where: and(
          eq(stageMappings.tenantId, context.tenantId),
          eq(stageMappings.integrationConnectionId, connectionId)
        ),
      });

      return NextResponse.json({
        fieldMappings,
        stageMappings: stageMappingsData,
        metadata: {
          connectionId: connection.id,
          providerName: connection.providerName,
          fieldMappingCount: fieldMappings.length,
          stageMappingCount: stageMappingsData.length,
        },
      });
    } catch (error) {
      console.error('Error retrieving field mappings:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve field mappings' },
        { status: 500 }
      );
    }
  }
);
