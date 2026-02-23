/**
 * Sync CRM Job Handler
 *
 * Synchronizes CRM data (deals, accounts, contacts, tickets) from external CRMs
 * into our normalized database schema.
 *
 * Job payload:
 * {
 *   connectionId: string;
 *   syncMode: 'full' | 'incremental';
 *   entities: ('deals' | 'accounts' | 'contacts' | 'tickets')[];
 *   cursor?: string; // Optional cursor for resuming
 * }
 *
 * Features:
 * - Uses integration framework for CRM abstraction
 * - Updates connection sync state (lastSyncedAt, cursor, status)
 * - Logs sync events for audit trail
 * - Handles errors gracefully with detailed error messages
 */

import {
  getConnection,
  getAdapter,
  syncDeals,
  syncAccounts,
  syncContacts,
  syncTickets,
  updateSyncState,
  type SyncEngineResult,
} from '@wf/integrations';
import { createClient } from '@wf/db/src/client';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@wf/db/src/schema';
import { eq, and } from 'drizzle-orm';
import type { FieldMapping, StageMapping } from '@wf/integrations';
import type { JobHandler } from '../processor/job-processor';
import { getCircuitBreaker, CircuitBreakerOpenError } from '../processor/circuit-breaker';

/**
 * Job payload interface
 */
interface SyncCRMPayload {
  connectionId: string;
  syncMode: 'full' | 'incremental';
  entities: ('deals' | 'accounts' | 'contacts' | 'tickets')[];
  cursor?: string;
}

/**
 * Result of sync operation
 */
interface SyncCRMResult {
  success: boolean;
  connectionId: string;
  entitiesProcessed: string[];
  results: {
    entity: string;
    totalProcessed: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  }[];
  error?: string;
}

/**
 * Default field mappings for common CRM fields
 *
 * Note: In production, these would come from a field_mappings table
 * where users can customize field mappings per integration.
 * For now, we use sensible 1:1 mappings for common fields.
 */
const DEFAULT_DEAL_FIELD_MAPPINGS: FieldMapping[] = [
  { sourceField: 'id', targetField: 'sourceId' },
  { sourceField: 'name', targetField: 'name' },
  { sourceField: 'amount', targetField: 'amount' },
  { sourceField: 'currency', targetField: 'currency' },
  { sourceField: 'stage', targetField: 'stage' },
  { sourceField: 'probability', targetField: 'probability' },
  { sourceField: 'closeDate', targetField: 'closeDate' },
];

const DEFAULT_ACCOUNT_FIELD_MAPPINGS: FieldMapping[] = [
  { sourceField: 'id', targetField: 'sourceId' },
  { sourceField: 'name', targetField: 'name' },
  { sourceField: 'domain', targetField: 'domain' },
  { sourceField: 'industry', targetField: 'industry' },
  { sourceField: 'employeeCount', targetField: 'employeeCount' },
  { sourceField: 'revenue', targetField: 'revenue' },
];

const DEFAULT_CONTACT_FIELD_MAPPINGS: FieldMapping[] = [
  { sourceField: 'id', targetField: 'sourceId' },
  { sourceField: 'firstName', targetField: 'firstName' },
  { sourceField: 'lastName', targetField: 'lastName' },
  { sourceField: 'email', targetField: 'email' },
  { sourceField: 'phone', targetField: 'phone' },
  { sourceField: 'title', targetField: 'title' },
];

const DEFAULT_TICKET_FIELD_MAPPINGS: FieldMapping[] = [
  { sourceField: 'id', targetField: 'sourceId' },
  { sourceField: 'subject', targetField: 'subject' },
  { sourceField: 'status', targetField: 'status' },
  { sourceField: 'priority', targetField: 'priority' },
  { sourceField: 'category', targetField: 'category' },
];

/**
 * Sync CRM job handler
 *
 * Orchestrates the sync process:
 * 1. Fetch connection and credentials
 * 2. Get CRM adapter
 * 3. Fetch stage mappings from database
 * 4. Sync each requested entity type
 * 5. Update connection sync state
 */
export const syncCRMJobHandler: JobHandler = async (context, payload) => {
  const { jobId, tenantId } = context;

  console.log(`[Job ${jobId}] Starting CRM sync for tenant ${tenantId}`);

  const typedPayload = payload as SyncCRMPayload;
  const {
    connectionId,
    syncMode,
    entities,
    cursor,
  } = typedPayload;

  try {
    // Step 1: Get connection with decrypted credentials
    const connection = await getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (!connection.isActive) {
      throw new Error(`Connection ${connectionId} is not active`);
    }

    console.log(`[Job ${jobId}] Retrieved connection for provider: ${connection.providerName}`);

    // Step 2: Get CRM adapter
    const adapter = getAdapter(connection.providerName, connection.credentials);
    console.log(`[Job ${jobId}] Created adapter for ${connection.providerName}`);

    // Step 3: Get circuit breaker for this provider
    const circuitBreakerName = `crm:${connection.providerName}`;
    const circuitBreaker = getCircuitBreaker(circuitBreakerName);
    console.log(
      `[Job ${jobId}] Circuit breaker state: ${circuitBreaker.getState()}`
    );

    // Step 4: Test connection health (with circuit breaker protection)
    try {
      const isHealthy = await circuitBreaker.execute(() => adapter.testConnection());
      if (!isHealthy) {
        throw new Error(`Connection test failed for ${connection.providerName}`);
      }
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        throw new Error(
          `Circuit breaker is OPEN for ${connection.providerName}. ` +
          `Service may be down or experiencing issues. Will retry later.`
        );
      }
      throw error;
    }

    // Step 5: Fetch stage mappings from database
    const client = await createClient();
    const db = drizzle(client, { schema });

    const stageMappings = await db
      .select()
      .from(schema.stageMappings)
      .where(
        and(
          eq(schema.stageMappings.tenantId, tenantId),
          eq(schema.stageMappings.integrationConnectionId, connectionId)
        )
      );

    // Convert to expected format
    const stageMappingsFormatted: StageMapping[] = stageMappings.map((m) => ({
      sourceStage: m.sourceStage,
      targetStage: m.normalizedStage,
      isClosed: m.isClosed,
      isWon: m.isWon,
    }));

    console.log(`[Job ${jobId}] Found ${stageMappingsFormatted.length} stage mappings`);

    // Step 6: Sync each entity type (with circuit breaker protection)
    const results: SyncCRMResult['results'] = [];

    for (const entity of entities) {
      console.log(`[Job ${jobId}] Syncing ${entity}...`);

      const syncOptions = {
        mode: syncMode,
        cursor: cursor || connection.syncState?.cursor,
        limit: 1000, // Process in batches of 1000
      };

      let result: SyncEngineResult;

      // Wrap sync operations in circuit breaker
      try {
        switch (entity) {
          case 'deals':
            result = await circuitBreaker.execute(() =>
              syncDeals(
                tenantId,
                adapter,
                connectionId,
                connection.providerName,
                DEFAULT_DEAL_FIELD_MAPPINGS,
                stageMappingsFormatted,
                syncOptions
              )
            );
            break;

          case 'accounts':
            result = await circuitBreaker.execute(() =>
              syncAccounts(
                tenantId,
                adapter,
                connectionId,
                connection.providerName,
                DEFAULT_ACCOUNT_FIELD_MAPPINGS,
                syncOptions
              )
            );
            break;

          case 'contacts':
            result = await circuitBreaker.execute(() =>
              syncContacts(
                tenantId,
                adapter,
                connectionId,
                connection.providerName,
                DEFAULT_CONTACT_FIELD_MAPPINGS,
                syncOptions
              )
            );
            break;

          case 'tickets':
            result = await circuitBreaker.execute(() =>
              syncTickets(
                tenantId,
                adapter,
                connectionId,
                connection.providerName,
                DEFAULT_TICKET_FIELD_MAPPINGS,
                syncOptions
              )
            );
            break;

          default:
            throw new Error(`Unknown entity type: ${entity}`);
        }
      } catch (error) {
        if (error instanceof CircuitBreakerOpenError) {
          throw new Error(
            `Circuit breaker is OPEN for ${connection.providerName} during ${entity} sync. ` +
            `Service may be experiencing issues. Job will be retried later.`
          );
        }
        throw error;
      }

      results.push({
        entity,
        totalProcessed: result.totalProcessed,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      });

      console.log(
        `[Job ${jobId}] Synced ${entity}: ` +
        `${result.totalProcessed} processed, ` +
        `${result.created} created, ` +
        `${result.updated} updated, ` +
        `${result.skipped} skipped, ` +
        `${result.failed} failed`
      );
    }

    // Step 7: Update connection sync state
    await db
      .update(schema.integrationConnections)
      .set({
        lastSyncedAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.integrationConnections.id, connectionId));

    await client.end();

    const finalResult: SyncCRMResult = {
      success: true,
      connectionId,
      entitiesProcessed: entities,
      results,
    };

    console.log(`[Job ${jobId}] CRM sync completed successfully`);
    return finalResult;

  } catch (error) {
    console.error(`[Job ${jobId}] CRM sync failed:`, error);

    // Update connection with error status
    try {
      const client = await createClient();
      const db = drizzle(client, { schema });

      await db
        .update(schema.integrationConnections)
        .set({
          lastSyncStatus: 'failed',
          lastSyncError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        })
        .where(eq(schema.integrationConnections.id, connectionId));

      await client.end();
    } catch (updateError) {
      console.error(`[Job ${jobId}] Failed to update connection status:`, updateError);
    }

    // Return error result
    const errorResult: SyncCRMResult = {
      success: false,
      connectionId,
      entitiesProcessed: [],
      results: [],
      error: error instanceof Error ? error.message : String(error),
    };

    throw error; // Re-throw to mark job as failed
  }
};
