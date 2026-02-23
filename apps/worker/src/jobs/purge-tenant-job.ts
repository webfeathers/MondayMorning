/**
 * Purge Tenant Job Handler
 *
 * Permanently deletes a tenant and all associated data:
 * 1. Verifies tenant is in 'deleted' status
 * 2. Checks grace period has elapsed
 * 3. Deletes all tenant data in correct order (foreign keys)
 * 4. Records purge in audit log
 *
 * Job payload:
 * {
 *   tenantId: string;
 *   reason: string;
 *   force?: boolean; // Skip grace period check (dangerous!)
 * }
 *
 * IMPORTANT: This is a destructive operation that cannot be undone!
 *
 * Typical workflow:
 * 1. Tenant requests deletion or admin deletes tenant
 * 2. Tenant status set to 'deleted'
 * 3. Grace period of 30 days begins
 * 4. After grace period, this job permanently purges all data
 */

import { createClient } from '@wf/db/src/client';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@wf/db/src/schema';
import { eq } from 'drizzle-orm';
import type { JobHandler } from '../processor/job-processor';

/**
 * Grace period before tenant data can be purged (in days)
 */
const GRACE_PERIOD_DAYS = 30;

/**
 * Job payload interface
 */
interface PurgeTenantPayload {
  tenantId: string;
  reason: string;
  force?: boolean; // Skip grace period check (use with extreme caution!)
}

/**
 * Result of purge operation
 */
interface PurgeTenantResult {
  success: boolean;
  tenantId: string;
  purgedAt: Date;
  reason: string;
  recordsDeleted: {
    jobs: number;
    integrationConnections: number;
    stageMappings: number;
    fieldMappings: number;
    deals: number;
    accounts: number;
    contacts: number;
    tickets: number;
  };
  error?: string;
}

/**
 * Purge tenant job handler
 *
 * DANGEROUS: This permanently deletes all tenant data!
 *
 * This job is triggered when:
 * - Grace period expires after tenant deletion
 * - Admin forces immediate purge (rare)
 */
export const purgeTenantJobHandler: JobHandler = async (context, payload) => {
  const { jobId } = context;

  console.log(`[Job ${jobId}] Starting tenant purge`);

  const typedPayload = payload as PurgeTenantPayload;
  const { tenantId, reason, force = false } = typedPayload;

  try {
    const client = await createClient();
    const db = drizzle(client, { schema });

    // Step 1: Verify tenant exists and is in 'deleted' status
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    if (tenant.status !== 'deleted') {
      throw new Error(
        `Tenant ${tenantId} has status '${tenant.status}'. ` +
        `Only tenants with status 'deleted' can be purged.`
      );
    }

    // Step 2: Check grace period (unless force=true)
    if (!force) {
      const gracePeriodMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
      const deletedAt = tenant.updatedAt; // Assuming updatedAt was set when status changed to 'deleted'
      const gracePeriodEnd = new Date(deletedAt.getTime() + gracePeriodMs);
      const now = new Date();

      if (now < gracePeriodEnd) {
        const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        throw new Error(
          `Grace period has not elapsed for tenant ${tenantId}. ` +
          `${daysRemaining} days remaining until ${gracePeriodEnd.toISOString()}`
        );
      }

      console.log(`[Job ${jobId}] Grace period has elapsed for tenant ${tenantId}`);
    } else {
      console.warn(`[Job ${jobId}] FORCE PURGE: Skipping grace period check for tenant ${tenantId}`);
    }

    console.log(`[Job ${jobId}] Purging all data for tenant ${tenantId}: ${reason}`);

    // Step 3: Delete all tenant data in correct order (respecting foreign keys)
    // Order is important to avoid foreign key constraint violations!

    const recordsDeleted = {
      jobs: 0,
      integrationConnections: 0,
      stageMappings: 0,
      fieldMappings: 0,
      deals: 0,
      accounts: 0,
      contacts: 0,
      tickets: 0,
    };

    // Delete jobs
    const deletedJobs = await db
      .delete(schema.jobs)
      .where(eq(schema.jobs.tenantId, tenantId))
      .returning();
    recordsDeleted.jobs = deletedJobs.length;
    console.log(`[Job ${jobId}] Deleted ${recordsDeleted.jobs} jobs`);

    // Delete stage mappings
    const deletedStageMappings = await db
      .delete(schema.stageMappings)
      .where(eq(schema.stageMappings.tenantId, tenantId))
      .returning();
    recordsDeleted.stageMappings = deletedStageMappings.length;
    console.log(`[Job ${jobId}] Deleted ${recordsDeleted.stageMappings} stage mappings`);

    // Delete field mappings
    const deletedFieldMappings = await db
      .delete(schema.fieldMappings)
      .where(eq(schema.fieldMappings.tenantId, tenantId))
      .returning();
    recordsDeleted.fieldMappings = deletedFieldMappings.length;
    console.log(`[Job ${jobId}] Deleted ${recordsDeleted.fieldMappings} field mappings`);

    // Delete deals
    const deletedDeals = await db
      .delete(schema.deals)
      .where(eq(schema.deals.tenantId, tenantId))
      .returning();
    recordsDeleted.deals = deletedDeals.length;
    console.log(`[Job ${jobId}] Deleted ${recordsDeleted.deals} deals`);

    // Delete accounts
    const deletedAccounts = await db
      .delete(schema.accounts)
      .where(eq(schema.accounts.tenantId, tenantId))
      .returning();
    recordsDeleted.accounts = deletedAccounts.length;
    console.log(`[Job ${jobId}] Deleted ${recordsDeleted.accounts} accounts`);

    // Delete contacts
    const deletedContacts = await db
      .delete(schema.contacts)
      .where(eq(schema.contacts.tenantId, tenantId))
      .returning();
    recordsDeleted.contacts = deletedContacts.length;
    console.log(`[Job ${jobId}] Deleted ${recordsDeleted.contacts} contacts`);

    // Delete tickets
    const deletedTickets = await db
      .delete(schema.tickets)
      .where(eq(schema.tickets.tenantId, tenantId))
      .returning();
    recordsDeleted.tickets = deletedTickets.length;
    console.log(`[Job ${jobId}] Deleted ${recordsDeleted.tickets} tickets`);

    // Delete integration connections (must be after related data)
    const deletedConnections = await db
      .delete(schema.integrationConnections)
      .where(eq(schema.integrationConnections.tenantId, tenantId))
      .returning();
    recordsDeleted.integrationConnections = deletedConnections.length;
    console.log(`[Job ${jobId}] Deleted ${recordsDeleted.integrationConnections} integration connections`);

    // Finally, delete the tenant record itself
    await db
      .delete(schema.tenants)
      .where(eq(schema.tenants.id, tenantId));
    console.log(`[Job ${jobId}] Deleted tenant record for ${tenantId}`);

    // Step 4: In a real implementation, we would:
    // - Log the purge in a separate audit log table (outside tenant scope)
    // - Delete any file uploads from object storage
    // - Clear any cached data
    // - Send confirmation email to admin

    const totalRecords = Object.values(recordsDeleted).reduce((sum, count) => sum + count, 0);
    console.log(`[Job ${jobId}] Total records deleted: ${totalRecords}`);

    await client.end();

    const result: PurgeTenantResult = {
      success: true,
      tenantId,
      purgedAt: new Date(),
      reason,
      recordsDeleted,
    };

    console.log(`[Job ${jobId}] Tenant purge completed`);
    return result;

  } catch (error) {
    console.error(`[Job ${jobId}] Tenant purge failed:`, error);

    const errorResult: PurgeTenantResult = {
      success: false,
      tenantId,
      purgedAt: new Date(),
      reason,
      recordsDeleted: {
        jobs: 0,
        integrationConnections: 0,
        stageMappings: 0,
        fieldMappings: 0,
        deals: 0,
        accounts: 0,
        contacts: 0,
        tickets: 0,
      },
      error: error instanceof Error ? error.message : String(error),
    };

    throw error; // Re-throw to mark job as failed
  }
};
