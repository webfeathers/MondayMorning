import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTenant } from '@/lib/get-tenant';
import {
  testConnection as testConnectionManager,
  getConnection as getConnectionManager,
} from '@wf/integrations';

/**
 * POST /api/integrations/connections/[id]/test
 * Tests the health of an integration connection
 *
 * This endpoint calls the adapter's testConnection() method to verify
 * that the connection credentials are valid and the external API is reachable.
 *
 * Returns:
 * - 200: Connection test result (success: true/false)
 * - 401: Not authenticated
 * - 404: Tenant or connection not found
 * - 500: Internal server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Validate session
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get tenant from subdomain
    const tenant = await getTenant();
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // 3. Verify connection exists and belongs to tenant
    const connection = await getConnectionManager(params.id);
    if (!connection || connection.tenantId !== tenant.id) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // 4. Test connection using connection manager
    const result = await testConnectionManager(params.id);

    // 5. Return test result
    return NextResponse.json({
      success: result.success,
      error: result.error,
      connectionId: params.id,
      providerName: connection.providerName,
      testedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error testing integration connection:', error);
    return NextResponse.json(
      {
        error: 'Failed to test integration connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
