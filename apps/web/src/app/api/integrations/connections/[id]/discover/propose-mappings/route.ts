/**
 * POST /api/integrations/connections/[id]/discover/propose-mappings
 *
 * Generates intelligent field mapping suggestions using fuzzy matching
 * and pattern detection. Analyzes CRM field names and proposes mappings
 * to our normalized schema.
 *
 * Request body:
 * {
 *   "objectType": "Deal"
 * }
 *
 * Response:
 * {
 *   "proposedMappings": [...],
 *   "stageMappings": [...]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, integrationConnections } from '@wf/db';
import { eq } from 'drizzle-orm';
import { getProvider } from '@wf/integrations';
import { proposeMappings } from '@/lib/integrations/mapping-proposer';
import { withPermission } from '@/lib/require-permission';

/**
 * Propose field mappings for a CRM object
 *
 * @permission integrations:view
 * @body objectType - The CRM object type to propose mappings for
 */
export const POST = withPermission(
  'integrations:view',
  async (request: NextRequest, context: { params: any; userId: string; tenantId: string }) => {
    try {
      const { id: connectionId } = context.params;
      const body = await request.json();
      const { objectType } = body;

      // Validate required field
      if (!objectType) {
        return NextResponse.json(
          { error: 'Missing required field: objectType' },
          { status: 400 }
        );
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

      // Get provider adapter
      const provider = getProvider(connection.providerName, connection.credentials);

      // Discover fields for the specified object
      const fields = await provider.discoverFields(objectType);

      // Generate mapping proposals
      const proposal = proposeMappings(fields, objectType);

      return NextResponse.json({
        proposedMappings: proposal.fieldMappings,
        stageMappings: proposal.stageMappings,
        metadata: {
          connectionId: connection.id,
          providerName: connection.providerName,
          objectType,
          totalFields: fields.length,
          mappedFields: proposal.fieldMappings.length,
          unmappedFields: fields.length - proposal.fieldMappings.length,
          stageCount: proposal.stageMappings.length,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error proposing mappings:', error);
      return NextResponse.json(
        { error: 'Failed to propose mappings' },
        { status: 500 }
      );
    }
  }
);
