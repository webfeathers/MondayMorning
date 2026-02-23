/**
 * GET /api/integrations/connections/[id]/discover/objects
 *
 * Discovers all available objects (entities) from the connected CRM.
 * Returns metadata about objects like Account, Contact, Deal, etc.
 *
 * This enables dynamic UI for users to select which objects to sync.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, integrationConnections } from '@wf/db';
import { eq } from 'drizzle-orm';
import { getProvider } from '@wf/integrations';
import { withPermission } from '@/lib/require-permission';

/**
 * Discover objects from connected CRM
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

      // Get provider adapter
      const provider = getProvider(connection.providerName, connection.credentials);

      // Discover objects
      const objects = await provider.discoverObjects();

      return NextResponse.json({
        objects,
        metadata: {
          connectionId: connection.id,
          providerName: connection.providerName,
          discoveredAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error discovering objects:', error);
      return NextResponse.json(
        { error: 'Failed to discover objects' },
        { status: 500 }
      );
    }
  }
);
