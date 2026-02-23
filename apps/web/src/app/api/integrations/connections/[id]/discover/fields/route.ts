/**
 * GET /api/integrations/connections/[id]/discover/fields?object=Deal
 *
 * Discovers all fields for a specific CRM object type.
 * Returns metadata about each field including type, whether it's required,
 * custom fields, and picklist values.
 *
 * This data drives the field mapping UI where users map CRM fields
 * to our normalized schema.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, integrationConnections } from '@wf/db';
import { eq } from 'drizzle-orm';
import { getProvider } from '@wf/integrations';
import { withPermission } from '@/lib/require-permission';

/**
 * Discover fields for a specific object type
 *
 * @permission integrations:view
 * @query object - The CRM object type (e.g., 'Deal', 'Account', 'Contact')
 */
export const GET = withPermission(
  'integrations:view',
  async (request: NextRequest, context: { params: any; userId: string; tenantId: string }) => {
    try {
      const { id: connectionId } = context.params;
      const { searchParams } = new URL(request.url);
      const objectType = searchParams.get('object');

      // Validate required query parameter
      if (!objectType) {
        return NextResponse.json(
          { error: 'Missing required query parameter: object' },
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

      return NextResponse.json({
        fields,
        metadata: {
          connectionId: connection.id,
          providerName: connection.providerName,
          objectType,
          discoveredAt: new Date().toISOString(),
          fieldCount: fields.length,
          customFieldCount: fields.filter((f) => f.custom).length,
        },
      });
    } catch (error) {
      console.error('Error discovering fields:', error);
      return NextResponse.json(
        { error: 'Failed to discover fields' },
        { status: 500 }
      );
    }
  }
);
