import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTenant } from '@/lib/get-tenant';
import { hasPermission } from '@wf/auth';
import { createTenantClient } from '@wf/db';
import {
  createConnection as createConnectionManager,
  listConnections as listConnectionsManager,
} from '@wf/integrations';

/**
 * POST /api/integrations/connections
 * Creates a new integration connection
 *
 * Required permission: integrations:connect
 *
 * Request body:
 * - providerName: string (e.g., 'salesforce', 'hubspot')
 * - credentials: object (OAuth tokens or API keys)
 *
 * Returns:
 * - 201: Connection created successfully
 * - 400: Invalid request body
 * - 401: Not authenticated
 * - 403: Permission denied
 * - 404: Tenant not found
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
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

    // 3. Check permission: 'integrations:connect'
    const dbClient = createTenantClient(tenant.id);
    const canConnect = await hasPermission(
      dbClient.db,
      session.userId,
      tenant.id,
      'integrations:connect'
    );

    if (!canConnect) {
      return NextResponse.json(
        { error: 'Permission denied: integrations:connect' },
        { status: 403 }
      );
    }

    // 4. Parse and validate request body
    const body = await request.json();
    const { providerName, credentials } = body;

    if (!providerName || typeof providerName !== 'string') {
      return NextResponse.json(
        { error: 'providerName is required and must be a string' },
        { status: 400 }
      );
    }

    if (!credentials || typeof credentials !== 'object') {
      return NextResponse.json(
        { error: 'credentials is required and must be an object' },
        { status: 400 }
      );
    }

    // 5. Create connection using connection manager
    const connection = await createConnectionManager(
      tenant.id,
      providerName,
      credentials
    );

    // 6. Return connection (without sensitive credentials)
    return NextResponse.json(
      {
        id: connection.id,
        tenantId: connection.tenantId,
        providerType: connection.providerType,
        providerName: connection.providerName,
        isActive: connection.isActive,
        lastSyncedAt: connection.lastSyncedAt,
        lastSyncStatus: connection.lastSyncStatus,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating integration connection:', error);
    return NextResponse.json(
      {
        error: 'Failed to create integration connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/connections
 * Lists all active integration connections for the current tenant
 *
 * Returns:
 * - 200: List of connections
 * - 401: Not authenticated
 * - 404: Tenant not found
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
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

    // 3. List connections using connection manager
    const connections = await listConnectionsManager(tenant.id);

    // 4. Return connections (without sensitive credentials)
    return NextResponse.json({
      connections: connections.map((conn) => ({
        id: conn.id,
        providerType: conn.providerType,
        providerName: conn.providerName,
        isActive: conn.isActive,
        lastSyncedAt: conn.lastSyncedAt,
        lastSyncStatus: conn.lastSyncStatus,
        lastSyncError: conn.lastSyncError,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error listing integration connections:', error);
    return NextResponse.json(
      {
        error: 'Failed to list integration connections',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
