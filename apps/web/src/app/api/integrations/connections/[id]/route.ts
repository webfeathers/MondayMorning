import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTenant } from '@/lib/get-tenant';
import { hasPermission } from '@wf/auth';
import { createTenantClient } from '@wf/db';
import {
  getConnection as getConnectionManager,
  deleteConnection as deleteConnectionManager,
} from '@wf/integrations';

/**
 * GET /api/integrations/connections/[id]
 * Gets details of a specific integration connection
 *
 * Returns:
 * - 200: Connection details
 * - 401: Not authenticated
 * - 404: Tenant or connection not found
 * - 500: Internal server error
 */
export async function GET(
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

    // 3. Get connection using connection manager
    const connection = await getConnectionManager(params.id);

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // 4. Verify connection belongs to the tenant
    if (connection.tenantId !== tenant.id) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // 5. Return connection details (without sensitive credentials)
    return NextResponse.json({
      id: connection.id,
      tenantId: connection.tenantId,
      providerType: connection.providerType,
      providerName: connection.providerName,
      isActive: connection.isActive,
      syncState: connection.syncState,
      syncSchedule: connection.syncSchedule,
      lastSyncedAt: connection.lastSyncedAt,
      lastSyncStatus: connection.lastSyncStatus,
      lastSyncError: connection.lastSyncError,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    });
  } catch (error) {
    console.error('Error getting integration connection:', error);
    return NextResponse.json(
      {
        error: 'Failed to get integration connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/connections/[id]
 * Deletes (soft-deletes) an integration connection
 *
 * Required permission: integrations:disconnect
 *
 * Returns:
 * - 200: Connection deleted successfully
 * - 401: Not authenticated
 * - 403: Permission denied
 * - 404: Tenant or connection not found
 * - 500: Internal server error
 */
export async function DELETE(
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

    // 3. Check permission: 'integrations:disconnect'
    const dbClient = createTenantClient(tenant.id);
    const canDisconnect = await hasPermission(
      dbClient.db,
      session.userId,
      tenant.id,
      'integrations:disconnect'
    );

    if (!canDisconnect) {
      return NextResponse.json(
        { error: 'Permission denied: integrations:disconnect' },
        { status: 403 }
      );
    }

    // 4. Verify connection exists and belongs to tenant before deleting
    const connection = await getConnectionManager(params.id);
    if (!connection || connection.tenantId !== tenant.id) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // 5. Delete connection using connection manager
    const result = await deleteConnectionManager(params.id);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Connection not found or already deleted' },
        { status: 404 }
      );
    }

    // 6. Return success response
    return NextResponse.json({
      success: true,
      message: 'Connection deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting integration connection:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete integration connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
