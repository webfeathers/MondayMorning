/**
 * Reactivate Tenant Job Handler
 *
 * Reactivates a suspended tenant by:
 * 1. Updating tenant status to 'active'
 * 2. Recording reactivation timestamp
 * 3. Re-enabling integration connections (optional)
 * 4. Optionally notifying the tenant
 *
 * Job payload:
 * {
 *   tenantId: string;
 *   reason: string;
 *   reEnableIntegrations?: boolean;
 *   notifyTenant?: boolean;
 * }
 *
 * Common reactivation reasons:
 * - Payment received
 * - Issue resolved
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
interface ReactivateTenantPayload {
  tenantId: string;
  reason: string;
  reEnableIntegrations?: boolean;
  notifyTenant?: boolean;
}

/**
 * Result of reactivate operation
 */
interface ReactivateTenantResult {
  success: boolean;
  tenantId: string;
  reactivatedAt: Date;
  reason: string;
  integrationsReEnabled: number;
  error?: string;
}

/**
 * Reactivate tenant job handler
 *
 * This job is triggered when:
 * - Payment is received after suspension
 * - Terms of service issue is resolved
 * - Admin manually reactivates tenant
 * - Tenant requests reactivation
 */
export const reactivateTenantJobHandler: JobHandler = async (context, payload) => {
  const { jobId } = context;

  console.log(`[Job ${jobId}] Starting tenant reactivation`);

  const typedPayload = payload as ReactivateTenantPayload;
  const { tenantId, reason, reEnableIntegrations = false, notifyTenant = false } = typedPayload;

  try {
    const client = await createClient();
    const db = drizzle(client, { schema });

    // Step 1: Verify tenant exists and is suspended
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    if (tenant.status === 'active') {
      console.log(`[Job ${jobId}] Tenant ${tenantId} is already active`);
      await client.end();
      return {
        success: true,
        tenantId,
        reactivatedAt: new Date(),
        reason: 'Already active',
        integrationsReEnabled: 0,
      };
    }

    if (tenant.status !== 'suspended') {
      throw new Error(`Tenant ${tenantId} has status '${tenant.status}', expected 'suspended'`);
    }

    console.log(`[Job ${jobId}] Reactivating tenant ${tenantId}: ${reason}`);

    // Step 2: Update tenant status to active
    await db
      .update(schema.tenants)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, tenantId));

    let integrationsReEnabled = 0;

    // Step 3: Optionally re-enable integration connections
    if (reEnableIntegrations) {
      const enabledConnections = await db
        .update(schema.integrationConnections)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.integrationConnections.tenantId, tenantId),
            eq(schema.integrationConnections.isActive, false)
          )
        )
        .returning();

      integrationsReEnabled = enabledConnections.length;
      console.log(`[Job ${jobId}] Re-enabled ${integrationsReEnabled} integration connections`);
    } else {
      console.log(`[Job ${jobId}] Skipping integration re-enablement (reEnableIntegrations=false)`);
    }

    // Step 4: In a real implementation, we would:
    // - Send reactivation notification email if notifyTenant is true
    // - Log the reactivation in audit trail
    // - Restore any suspended features
    // - Clear suspension-related flags

    if (notifyTenant) {
      console.log(`[Job ${jobId}] Would send reactivation notification to tenant ${tenantId}`);
    }

    await client.end();

    const result: ReactivateTenantResult = {
      success: true,
      tenantId,
      reactivatedAt: new Date(),
      reason,
      integrationsReEnabled,
    };

    console.log(`[Job ${jobId}] Tenant reactivation completed`);
    return result;

  } catch (error) {
    console.error(`[Job ${jobId}] Tenant reactivation failed:`, error);

    const errorResult: ReactivateTenantResult = {
      success: false,
      tenantId,
      reactivatedAt: new Date(),
      reason,
      integrationsReEnabled: 0,
      error: error instanceof Error ? error.message : String(error),
    };

    throw error; // Re-throw to mark job as failed
  }
};
