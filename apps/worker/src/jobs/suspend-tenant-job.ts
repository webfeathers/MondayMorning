/**
 * Suspend Tenant Job Handler
 *
 * Suspends a tenant by:
 * 1. Updating tenant status to 'suspended'
 * 2. Recording suspension reason and timestamp
 * 3. Canceling any active sync jobs
 * 4. Optionally notifying the tenant
 *
 * Job payload:
 * {
 *   tenantId: string;
 *   reason: string;
 *   notifyTenant?: boolean;
 * }
 *
 * Common suspension reasons:
 * - Payment failure
 * - Terms of service violation
 * - Administrative action
 * - Requested by tenant
 */

import { createClient } from '@wf/db/src/client';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@wf/db/src/schema';
import { eq, and } from 'drizzle-orm';
import type { JobHandler } from '../processor/job-processor';

/**
 * Job payload interface
 */
interface SuspendTenantPayload {
  tenantId: string;
  reason: string;
  notifyTenant?: boolean;
}

/**
 * Result of suspend operation
 */
interface SuspendTenantResult {
  success: boolean;
  tenantId: string;
  suspendedAt: Date;
  reason: string;
  activeJobsCanceled: number;
  error?: string;
}

/**
 * Suspend tenant job handler
 *
 * This job is triggered when:
 * - Payment fails
 * - Terms of service are violated
 * - Admin manually suspends tenant
 * - Tenant requests suspension
 */
export const suspendTenantJobHandler: JobHandler = async (context, payload) => {
  const { jobId, tenantId: contextTenantId } = context;

  console.log(`[Job ${jobId}] Starting tenant suspension`);

  const typedPayload = payload as SuspendTenantPayload;
  const { tenantId, reason, notifyTenant = false } = typedPayload;

  try {
    const client = await createClient();
    const db = drizzle(client, { schema });

    // Step 1: Verify tenant exists and is not already suspended
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    if (tenant.status === 'suspended') {
      console.log(`[Job ${jobId}] Tenant ${tenantId} is already suspended`);
      await client.end();
      return {
        success: true,
        tenantId,
        suspendedAt: new Date(),
        reason: 'Already suspended',
        activeJobsCanceled: 0,
      };
    }

    console.log(`[Job ${jobId}] Suspending tenant ${tenantId}: ${reason}`);

    // Step 2: Update tenant status to suspended
    await db
      .update(schema.tenants)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, tenantId));

    // Step 3: Cancel any queued jobs for this tenant
    const canceledJobs = await db
      .update(schema.jobs)
      .set({
        status: 'failed',
        error: `Job canceled due to tenant suspension: ${reason}`,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.jobs.tenantId, tenantId),
          eq(schema.jobs.status, 'queued')
        )
      )
      .returning();

    console.log(`[Job ${jobId}] Canceled ${canceledJobs.length} queued jobs`);

    // Step 4: Disable all integration connections
    const disabledConnections = await db
      .update(schema.integrationConnections)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.integrationConnections.tenantId, tenantId),
          eq(schema.integrationConnections.isActive, true)
        )
      )
      .returning();

    console.log(`[Job ${jobId}] Disabled ${disabledConnections.length} integration connections`);

    // Step 5: In a real implementation, we would:
    // - Send suspension notification email if notifyTenant is true
    // - Log the suspension in audit trail
    // - Revoke any active API tokens
    // - Clear cached data

    if (notifyTenant) {
      console.log(`[Job ${jobId}] Would send suspension notification to tenant ${tenantId}`);
    }

    await client.end();

    const result: SuspendTenantResult = {
      success: true,
      tenantId,
      suspendedAt: new Date(),
      reason,
      activeJobsCanceled: canceledJobs.length,
    };

    console.log(`[Job ${jobId}] Tenant suspension completed`);
    return result;

  } catch (error) {
    console.error(`[Job ${jobId}] Tenant suspension failed:`, error);

    const errorResult: SuspendTenantResult = {
      success: false,
      tenantId,
      suspendedAt: new Date(),
      reason,
      activeJobsCanceled: 0,
      error: error instanceof Error ? error.message : String(error),
    };

    throw error; // Re-throw to mark job as failed
  }
};
