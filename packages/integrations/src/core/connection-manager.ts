/**
 * Connection Manager
 *
 * Manages OAuth token storage, refresh, and health checks for integration connections.
 *
 * Key features:
 * - Encrypted credential storage (AES-256-GCM)
 * - OAuth token refresh automation
 * - Connection health monitoring
 * - Sync state tracking (cursor/watermark)
 * - Tenant-scoped connections
 */

import { createTenantClient } from '@wf/db';
import { integrationConnections } from '@wf/db';
import { eq, and } from 'drizzle-orm';
import { encryptCredentials, decryptCredentials } from './encryption';
import { getAdapter, getProviderType } from './provider-registry';

/**
 * Connection object returned from the database
 */
interface Connection {
  id: string;
  tenantId: string;
  providerType: string;
  providerName: string;
  credentials: any;
  syncState: any;
  syncSchedule: string | null;
  isActive: boolean;
  lastSyncedAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a new integration connection
 *
 * @param tenantId - Tenant ID
 * @param providerName - Provider name (e.g., 'salesforce', 'hubspot')
 * @param credentials - OAuth tokens or API keys
 * @returns Created connection with encrypted credentials
 */
export async function createConnection(
  tenantId: string,
  providerName: string,
  credentials: any
): Promise<Connection> {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret) {
    throw new Error('SESSION_SIGNING_SECRET environment variable is required');
  }

  // Encrypt credentials
  const encryptedCredentials = encryptCredentials(credentials, secret);

  // Determine provider type
  const providerType = getProviderType(providerName);

  // Create tenant client
  const client = createTenantClient(tenantId);

  // Insert connection
  const [connection] = await client.db
    .insert(integrationConnections)
    .values({
      tenantId,
      providerType,
      providerName: providerName.toLowerCase(),
      credentials: encryptedCredentials,
      syncState: {},
      isActive: true,
    })
    .returning();

  // Decrypt credentials for return value
  return {
    ...connection,
    credentials: decryptCredentials(connection.credentials, secret),
  };
}

/**
 * Retrieves a connection and decrypts credentials
 *
 * @param connectionId - Connection ID
 * @returns Connection with decrypted credentials, or null if not found
 */
export async function getConnection(connectionId: string): Promise<Connection | null> {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret) {
    throw new Error('SESSION_SIGNING_SECRET environment variable is required');
  }

  // We need to get the tenant ID first to create a tenant client
  // For now, we'll use a raw query approach
  // In production, this would use a service account or admin client
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;

  const sql = postgres(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema: { integrationConnections } });

  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
    .limit(1);

  await sql.end();

  if (!connection) {
    return null;
  }

  // Decrypt credentials
  return {
    ...connection,
    credentials: decryptCredentials(connection.credentials, secret),
  };
}

/**
 * Refreshes OAuth token using the adapter's refresh mechanism
 *
 * @param connectionId - Connection ID
 * @returns Result with success status and updated credentials
 */
export async function refreshConnection(connectionId: string): Promise<{
  success: boolean;
  credentials?: any;
  error?: string;
}> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    return { success: false, error: 'Connection not found' };
  }

  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret) {
    return { success: false, error: 'SESSION_SIGNING_SECRET not configured' };
  }

  try {
    // Get adapter
    const adapter = getAdapter(connection.providerName, connection.credentials);

    // Refresh token using the refresh_token from credentials
    const refreshToken = connection.credentials.refreshToken || connection.credentials.refresh_token;
    if (!refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    const authResult = await adapter.refreshToken(refreshToken);

    // Build new credentials object from AuthResult
    const newCredentials = {
      access_token: authResult.accessToken,
      refresh_token: authResult.refreshToken,
      expires_at: authResult.expiresAt,
      metadata: authResult.metadata,
    };

    // Encrypt new credentials
    const encryptedCredentials = encryptCredentials(newCredentials, secret);

    // Update database
    const client = createTenantClient(connection.tenantId);
    await client.db
      .update(integrationConnections)
      .set({
        credentials: encryptedCredentials,
        updatedAt: new Date(),
      })
      .where(eq(integrationConnections.id, connectionId));

    return { success: true, credentials: newCredentials };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tests connection health
 *
 * @param connectionId - Connection ID
 * @returns Result with success status
 */
export async function testConnection(connectionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    return { success: false, error: 'Connection not found' };
  }

  try {
    // Get adapter
    const adapter = getAdapter(connection.providerName, connection.credentials);

    // Test connection (returns boolean)
    const isHealthy = await adapter.testConnection();

    return {
      success: isHealthy,
      error: isHealthy ? undefined : 'Connection test failed',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Lists all connections for a tenant
 *
 * @param tenantId - Tenant ID
 * @returns Array of connections with decrypted credentials
 */
export async function listConnections(tenantId: string): Promise<Connection[]> {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret) {
    throw new Error('SESSION_SIGNING_SECRET environment variable is required');
  }

  const client = createTenantClient(tenantId);

  const connections = await client.db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.tenantId, tenantId),
        eq(integrationConnections.isActive, true)
      )
    );

  // Decrypt credentials for all connections
  return connections.map((conn) => ({
    ...conn,
    credentials: decryptCredentials(conn.credentials, secret),
  }));
}

/**
 * Soft deletes a connection
 *
 * @param connectionId - Connection ID
 * @returns Result with success status
 */
export async function deleteConnection(connectionId: string): Promise<{
  success: boolean;
}> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    return { success: false };
  }

  const client = createTenantClient(connection.tenantId);

  await client.db
    .update(integrationConnections)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(integrationConnections.id, connectionId));

  return { success: true };
}

/**
 * Updates sync state (cursor, watermark, etc.)
 *
 * @param connectionId - Connection ID
 * @param state - New sync state (merged with existing)
 * @returns Result with success status and updated sync state
 */
export async function updateSyncState(
  connectionId: string,
  state: any
): Promise<{
  success: boolean;
  syncState?: any;
}> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    return { success: false };
  }

  // Merge with existing sync state
  const newSyncState = {
    ...connection.syncState,
    ...state,
  };

  const client = createTenantClient(connection.tenantId);

  await client.db
    .update(integrationConnections)
    .set({
      syncState: newSyncState,
      updatedAt: new Date(),
    })
    .where(eq(integrationConnections.id, connectionId));

  return { success: true, syncState: newSyncState };
}
