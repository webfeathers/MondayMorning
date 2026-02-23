/**
 * Sync Engine - Orchestrator of the integration flow
 *
 * Coordinates the full sync pipeline:
 * 1. Adapter (fetch raw CRM data)
 * 2. Field mapper (transform to normalized schema)
 * 3. Database upsert (insert new or update existing)
 * 4. Sync event logging (audit trail)
 *
 * Key features:
 * - Tenant-aware database operations
 * - Error handling (skip bad records, log errors)
 * - Pagination support
 * - Sync event logging for audit trail
 */

import { createTenantClient, deals, organizations, contacts, tickets, syncEvents } from '@wf/db';
import { eq, and } from 'drizzle-orm';
import type { CRMProvider } from '../types/crm-provider';
import type {
  FieldMapping,
  StageMapping,
  SyncOptions,
  RawDeal,
  RawAccount,
  RawContact,
  RawTicket,
} from '../types/sync-types';
import { mapFields, normalizeStage, extractCustomFields } from './field-mapper';

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  totalProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors?: Array<{ record: any; error: string }>;
}

/**
 * Internal type for upsert result
 */
interface UpsertResult {
  created: boolean;
  recordId: string;
}

/**
 * Sync deals from CRM adapter to normalized database
 *
 * @param tenantId - Tenant UUID
 * @param adapter - CRM adapter instance
 * @param integrationConnectionId - Integration connection UUID
 * @param sourceProvider - Source provider name (e.g., 'salesforce', 'hubspot')
 * @param fieldMappings - Field mapping configurations
 * @param stageMappings - Stage mapping configurations
 * @param syncOptions - Sync options (mode, cursor, filters, etc.)
 * @returns Sync result with metadata
 */
export async function syncDeals(
  tenantId: string,
  adapter: CRMProvider,
  integrationConnectionId: string,
  sourceProvider: string,
  fieldMappings: FieldMapping[],
  stageMappings: StageMapping[],
  syncOptions: SyncOptions
): Promise<SyncResult> {
  const client = createTenantClient(tenantId);
  const startTime = new Date();

  let totalProcessed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ record: any; error: string }> = [];

  try {
    let hasMore = true;
    let cursor = syncOptions.cursor;

    // Pagination loop - process all pages
    while (hasMore) {
      const syncResult = await adapter.syncDeals({
        ...syncOptions,
        cursor,
      });

      // Process each record in the batch
      for (const rawDeal of syncResult.records) {
        try {
          totalProcessed++;

          // Step 1: Map fields using field mapper
          const mappedFields = mapFields(rawDeal, fieldMappings);

          // Step 2: Normalize stage
          const stageResult = normalizeStage(mappedFields.stage, stageMappings);

          // Step 3: Extract custom fields
          const knownFields = fieldMappings.map((m) => m.sourceField);
          const customFields = extractCustomFields(rawDeal, knownFields);

          // Step 4: Validate required fields
          if (!mappedFields.name || mappedFields.name === '') {
            skipped++;
            errors.push({
              record: rawDeal,
              error: 'Missing required field: name',
            });
            continue;
          }

          // Step 5: Prepare normalized record
          const normalizedRecord = {
            tenantId,
            sourceProvider,
            sourceId: rawDeal.id,
            name: mappedFields.name,
            amount: mappedFields.amount ? String(mappedFields.amount) : null,
            currency: mappedFields.currency || 'USD',
            stage: stageResult.stage,
            probability: mappedFields.probability,
            closeDate: mappedFields.closeDate,
            customFields,
            sourceMetadata: {
              isClosed: stageResult.isClosed,
              isWon: stageResult.isWon,
              rawStage: rawDeal.stage,
            },
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          // Step 6: Upsert to database
          const upsertResult = await upsertDeal(
            client,
            tenantId,
            sourceProvider,
            rawDeal.id,
            normalizedRecord
          );

          if (upsertResult.created) {
            created++;
          } else {
            updated++;
          }
        } catch (error) {
          failed++;
          errors.push({
            record: rawDeal,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Check if more pages exist
      hasMore = syncResult.hasMore;
      cursor = syncResult.cursor;
    }

    // Step 7: Log sync event
    await logSyncEvent(
      client,
      tenantId,
      integrationConnectionId,
      'deal',
      syncOptions.mode,
      {
        totalProcessed,
        created,
        updated,
        skipped,
        failed,
      },
      startTime,
      new Date(),
      errors.length > 0 ? errors : undefined
    );

    return {
      success: true,
      totalProcessed,
      created,
      updated,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    // Log failed sync event
    await logSyncEvent(
      client,
      tenantId,
      integrationConnectionId,
      'deal',
      syncOptions.mode,
      {
        totalProcessed,
        created,
        updated,
        skipped,
        failed,
      },
      startTime,
      new Date(),
      [{ record: null, error: error instanceof Error ? error.message : String(error) }]
    );

    throw error;
  }
}

/**
 * Sync accounts/organizations from CRM adapter to normalized database
 *
 * @param tenantId - Tenant UUID
 * @param adapter - CRM adapter instance
 * @param integrationConnectionId - Integration connection UUID
 * @param sourceProvider - Source provider name
 * @param fieldMappings - Field mapping configurations
 * @param syncOptions - Sync options
 * @returns Sync result with metadata
 */
export async function syncAccounts(
  tenantId: string,
  adapter: CRMProvider,
  integrationConnectionId: string,
  sourceProvider: string,
  fieldMappings: FieldMapping[],
  syncOptions: SyncOptions
): Promise<SyncResult> {
  const client = createTenantClient(tenantId);
  const startTime = new Date();

  let totalProcessed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ record: any; error: string }> = [];

  try {
    let hasMore = true;
    let cursor = syncOptions.cursor;

    // Pagination loop
    while (hasMore) {
      const syncResult = await adapter.syncAccounts({
        ...syncOptions,
        cursor,
      });

      // Process each record
      for (const rawAccount of syncResult.records) {
        try {
          totalProcessed++;

          // Map fields
          const mappedFields = mapFields(rawAccount, fieldMappings);

          // Extract custom fields
          const knownFields = fieldMappings.map((m) => m.sourceField);
          const customFields = extractCustomFields(rawAccount, knownFields);

          // Validate required fields
          if (!mappedFields.name || mappedFields.name === '') {
            skipped++;
            errors.push({
              record: rawAccount,
              error: 'Missing required field: name',
            });
            continue;
          }

          // Prepare normalized record
          const normalizedRecord = {
            tenantId,
            sourceProvider,
            sourceId: rawAccount.id,
            name: mappedFields.name,
            domain: mappedFields.domain,
            industry: mappedFields.industry,
            employeeCount: mappedFields.employeeCount,
            annualRevenue: mappedFields.revenue ? String(mappedFields.revenue) : null,
            customFields,
            sourceMetadata: {},
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          // Upsert to database
          const upsertResult = await upsertAccount(
            client,
            tenantId,
            sourceProvider,
            rawAccount.id,
            normalizedRecord
          );

          if (upsertResult.created) {
            created++;
          } else {
            updated++;
          }
        } catch (error) {
          failed++;
          errors.push({
            record: rawAccount,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      hasMore = syncResult.hasMore;
      cursor = syncResult.cursor;
    }

    // Log sync event
    await logSyncEvent(
      client,
      tenantId,
      integrationConnectionId,
      'organization',
      syncOptions.mode,
      {
        totalProcessed,
        created,
        updated,
        skipped,
        failed,
      },
      startTime,
      new Date(),
      errors.length > 0 ? errors : undefined
    );

    return {
      success: true,
      totalProcessed,
      created,
      updated,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    await logSyncEvent(
      client,
      tenantId,
      integrationConnectionId,
      'organization',
      syncOptions.mode,
      {
        totalProcessed,
        created,
        updated,
        skipped,
        failed,
      },
      startTime,
      new Date(),
      [{ record: null, error: error instanceof Error ? error.message : String(error) }]
    );

    throw error;
  }
}

/**
 * Sync contacts from CRM adapter to normalized database
 *
 * @param tenantId - Tenant UUID
 * @param adapter - CRM adapter instance
 * @param integrationConnectionId - Integration connection UUID
 * @param sourceProvider - Source provider name
 * @param fieldMappings - Field mapping configurations
 * @param syncOptions - Sync options
 * @returns Sync result with metadata
 */
export async function syncContacts(
  tenantId: string,
  adapter: CRMProvider,
  integrationConnectionId: string,
  sourceProvider: string,
  fieldMappings: FieldMapping[],
  syncOptions: SyncOptions
): Promise<SyncResult> {
  const client = createTenantClient(tenantId);
  const startTime = new Date();

  let totalProcessed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ record: any; error: string }> = [];

  try {
    let hasMore = true;
    let cursor = syncOptions.cursor;

    // Pagination loop
    while (hasMore) {
      const syncResult = await adapter.syncContacts({
        ...syncOptions,
        cursor,
      });

      // Process each record
      for (const rawContact of syncResult.records) {
        try {
          totalProcessed++;

          // Map fields
          const mappedFields = mapFields(rawContact, fieldMappings);

          // Extract custom fields
          const knownFields = fieldMappings.map((m) => m.sourceField);
          const customFields = extractCustomFields(rawContact, knownFields);

          // Prepare normalized record (contacts don't require validation - can have minimal info)
          const normalizedRecord = {
            tenantId,
            sourceProvider,
            sourceId: rawContact.id,
            firstName: mappedFields.firstName,
            lastName: mappedFields.lastName,
            email: mappedFields.email,
            phone: mappedFields.phone,
            title: mappedFields.title,
            customFields,
            sourceMetadata: {},
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          // Upsert to database
          const upsertResult = await upsertContact(
            client,
            tenantId,
            sourceProvider,
            rawContact.id,
            normalizedRecord
          );

          if (upsertResult.created) {
            created++;
          } else {
            updated++;
          }
        } catch (error) {
          failed++;
          errors.push({
            record: rawContact,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      hasMore = syncResult.hasMore;
      cursor = syncResult.cursor;
    }

    // Log sync event
    await logSyncEvent(
      client,
      tenantId,
      integrationConnectionId,
      'contact',
      syncOptions.mode,
      {
        totalProcessed,
        created,
        updated,
        skipped,
        failed,
      },
      startTime,
      new Date(),
      errors.length > 0 ? errors : undefined
    );

    return {
      success: true,
      totalProcessed,
      created,
      updated,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    await logSyncEvent(
      client,
      tenantId,
      integrationConnectionId,
      'contact',
      syncOptions.mode,
      {
        totalProcessed,
        created,
        updated,
        skipped,
        failed,
      },
      startTime,
      new Date(),
      [{ record: null, error: error instanceof Error ? error.message : String(error) }]
    );

    throw error;
  }
}

/**
 * Sync tickets from CRM adapter to normalized database
 *
 * @param tenantId - Tenant UUID
 * @param adapter - CRM adapter instance
 * @param integrationConnectionId - Integration connection UUID
 * @param sourceProvider - Source provider name
 * @param fieldMappings - Field mapping configurations
 * @param syncOptions - Sync options
 * @returns Sync result with metadata
 */
export async function syncTickets(
  tenantId: string,
  adapter: CRMProvider,
  integrationConnectionId: string,
  sourceProvider: string,
  fieldMappings: FieldMapping[],
  syncOptions: SyncOptions
): Promise<SyncResult> {
  const client = createTenantClient(tenantId);
  const startTime = new Date();

  let totalProcessed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ record: any; error: string }> = [];

  try {
    let hasMore = true;
    let cursor = syncOptions.cursor;

    // Pagination loop
    while (hasMore) {
      const syncResult = await adapter.syncTickets({
        ...syncOptions,
        cursor,
      });

      // Process each record
      for (const rawTicket of syncResult.records) {
        try {
          totalProcessed++;

          // Map fields
          const mappedFields = mapFields(rawTicket, fieldMappings);

          // Extract custom fields
          const knownFields = fieldMappings.map((m) => m.sourceField);
          const customFields = extractCustomFields(rawTicket, knownFields);

          // Validate required fields
          if (!mappedFields.subject || mappedFields.subject === '') {
            skipped++;
            errors.push({
              record: rawTicket,
              error: 'Missing required field: subject',
            });
            continue;
          }

          // Prepare normalized record
          const normalizedRecord = {
            tenantId,
            sourceProvider,
            sourceId: rawTicket.id,
            subject: mappedFields.subject,
            status: mappedFields.status,
            priority: mappedFields.priority,
            category: mappedFields.category,
            assigneeId: mappedFields.assigneeId,
            customFields,
            sourceMetadata: {},
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          // Upsert to database
          const upsertResult = await upsertTicket(
            client,
            tenantId,
            sourceProvider,
            rawTicket.id,
            normalizedRecord
          );

          if (upsertResult.created) {
            created++;
          } else {
            updated++;
          }
        } catch (error) {
          failed++;
          errors.push({
            record: rawTicket,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      hasMore = syncResult.hasMore;
      cursor = syncResult.cursor;
    }

    // Log sync event
    await logSyncEvent(
      client,
      tenantId,
      integrationConnectionId,
      'ticket',
      syncOptions.mode,
      {
        totalProcessed,
        created,
        updated,
        skipped,
        failed,
      },
      startTime,
      new Date(),
      errors.length > 0 ? errors : undefined
    );

    return {
      success: true,
      totalProcessed,
      created,
      updated,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    await logSyncEvent(
      client,
      tenantId,
      integrationConnectionId,
      'ticket',
      syncOptions.mode,
      {
        totalProcessed,
        created,
        updated,
        skipped,
        failed,
      },
      startTime,
      new Date(),
      [{ record: null, error: error instanceof Error ? error.message : String(error) }]
    );

    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Upsert a deal record to the database
 * Checks if record exists by sourceProvider + sourceId, then updates or inserts
 *
 * @param client - Tenant-aware database client
 * @param tenantId - Tenant UUID
 * @param sourceProvider - Source provider name
 * @param sourceId - Source record ID
 * @param record - Normalized record data
 * @returns Upsert result indicating created or updated
 */
async function upsertDeal(
  client: ReturnType<typeof createTenantClient>,
  tenantId: string,
  sourceProvider: string,
  sourceId: string,
  record: any
): Promise<UpsertResult> {
  return client.withTenantContext(async (tx) => {
    // Check if record exists
    const existing = await tx
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.tenantId, tenantId),
          eq(deals.sourceProvider, sourceProvider),
          eq(deals.sourceId, sourceId)
        )
      );

    if (existing.length > 0) {
      // Update existing record
      const [updated] = await tx
        .update(deals)
        .set(record)
        .where(eq(deals.id, existing[0].id))
        .returning();

      return {
        created: false,
        recordId: updated.id,
      };
    } else {
      // Insert new record
      const [inserted] = await tx
        .insert(deals)
        .values(record)
        .returning();

      return {
        created: true,
        recordId: inserted.id,
      };
    }
  });
}

/**
 * Upsert an account/organization record to the database
 */
async function upsertAccount(
  client: ReturnType<typeof createTenantClient>,
  tenantId: string,
  sourceProvider: string,
  sourceId: string,
  record: any
): Promise<UpsertResult> {
  return client.withTenantContext(async (tx) => {
    const existing = await tx
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.tenantId, tenantId),
          eq(organizations.sourceProvider, sourceProvider),
          eq(organizations.sourceId, sourceId)
        )
      );

    if (existing.length > 0) {
      const [updated] = await tx
        .update(organizations)
        .set(record)
        .where(eq(organizations.id, existing[0].id))
        .returning();

      return {
        created: false,
        recordId: updated.id,
      };
    } else {
      const [inserted] = await tx
        .insert(organizations)
        .values(record)
        .returning();

      return {
        created: true,
        recordId: inserted.id,
      };
    }
  });
}

/**
 * Upsert a contact record to the database
 */
async function upsertContact(
  client: ReturnType<typeof createTenantClient>,
  tenantId: string,
  sourceProvider: string,
  sourceId: string,
  record: any
): Promise<UpsertResult> {
  return client.withTenantContext(async (tx) => {
    const existing = await tx
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          eq(contacts.sourceProvider, sourceProvider),
          eq(contacts.sourceId, sourceId)
        )
      );

    if (existing.length > 0) {
      const [updated] = await tx
        .update(contacts)
        .set(record)
        .where(eq(contacts.id, existing[0].id))
        .returning();

      return {
        created: false,
        recordId: updated.id,
      };
    } else {
      const [inserted] = await tx
        .insert(contacts)
        .values(record)
        .returning();

      return {
        created: true,
        recordId: inserted.id,
      };
    }
  });
}

/**
 * Upsert a ticket record to the database
 */
async function upsertTicket(
  client: ReturnType<typeof createTenantClient>,
  tenantId: string,
  sourceProvider: string,
  sourceId: string,
  record: any
): Promise<UpsertResult> {
  return client.withTenantContext(async (tx) => {
    const existing = await tx
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(tickets.sourceProvider, sourceProvider),
          eq(tickets.sourceId, sourceId)
        )
      );

    if (existing.length > 0) {
      const [updated] = await tx
        .update(tickets)
        .set(record)
        .where(eq(tickets.id, existing[0].id))
        .returning();

      return {
        created: false,
        recordId: updated.id,
      };
    } else {
      const [inserted] = await tx
        .insert(tickets)
        .values(record)
        .returning();

      return {
        created: true,
        recordId: inserted.id,
      };
    }
  });
}

/**
 * Log a sync event to the database for audit trail
 *
 * @param client - Tenant-aware database client
 * @param tenantId - Tenant UUID
 * @param integrationConnectionId - Integration connection UUID
 * @param entityType - Entity type being synced
 * @param syncMode - Sync mode (full, incremental, etc.)
 * @param metadata - Sync metadata (counts, errors, etc.)
 * @param startTime - Sync start time
 * @param endTime - Sync end time
 * @param errors - Optional array of errors
 */
async function logSyncEvent(
  client: ReturnType<typeof createTenantClient>,
  tenantId: string,
  integrationConnectionId: string,
  entityType: string,
  syncMode: string,
  metadata: {
    totalProcessed: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  },
  startTime: Date,
  endTime: Date,
  errors?: Array<{ record: any; error: string }>
): Promise<void> {
  await client.withTenantContext(async (tx) => {
    await tx.insert(syncEvents).values({
      tenantId,
      integrationConnectionId,
      eventType: syncMode,
      entityType,
      recordsProcessed: metadata.totalProcessed,
      recordsCreated: metadata.created,
      recordsUpdated: metadata.updated,
      recordsSkipped: metadata.skipped,
      recordsFailed: metadata.failed,
      status: errors && errors.length > 0 ? 'partial' : 'completed',
      errorMessage: errors && errors.length > 0 ? `${errors.length} errors occurred` : null,
      metadata: {
        errors: errors?.slice(0, 10), // Limit to first 10 errors
        duration: endTime.getTime() - startTime.getTime(),
      },
      startedAt: startTime,
      completedAt: endTime,
    });
  });
}
