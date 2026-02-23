/**
 * Provision Tenant Job Handler
 *
 * Provisions a new tenant by:
 * 1. Creating tenant record in database
 * 2. Setting up initial configuration
 * 3. Creating any required initial data
 *
 * Job payload:
 * {
 *   tenantId: string;
 *   companyName: string;
 *   subdomain: string;
 *   plan: 'free' | 'starter' | 'professional' | 'enterprise';
 *   ownerEmail: string;
 * }
 */

import { createClient } from '@wf/db/src/client';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@wf/db/src/schema';
import { eq } from 'drizzle-orm';
import type { JobHandler } from '../processor/job-processor';

/**
 * Job payload interface
 */
interface ProvisionTenantPayload {
  tenantId: string;
  companyName: string;
  subdomain: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  ownerEmail: string;
}

/**
 * Result of provision operation
 */
interface ProvisionTenantResult {
  success: boolean;
  tenantId: string;
  provisionedAt: Date;
  error?: string;
}

/**
 * Provision tenant job handler
 *
 * This job is triggered when a new tenant signs up or is created
 * by an admin. It sets up the tenant's initial state.
 */
export const provisionTenantJobHandler: JobHandler = async (context, payload) => {
  const { jobId } = context;

  console.log(`[Job ${jobId}] Starting tenant provisioning`);

  const typedPayload = payload as ProvisionTenantPayload;
  const { tenantId, companyName, subdomain, plan, ownerEmail } = typedPayload;

  try {
    const client = await createClient();
    const db = drizzle(client, { schema });

    // Step 1: Verify tenant doesn't already exist
    const existingTenant = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    if (existingTenant.length > 0) {
      throw new Error(`Tenant ${tenantId} already exists`);
    }

    console.log(`[Job ${jobId}] Creating tenant record for ${companyName}`);

    // Step 2: Create tenant record
    await db
      .insert(schema.tenants)
      .values({
        id: tenantId,
        name: companyName,
        subdomain,
        plan,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    console.log(`[Job ${jobId}] Tenant ${tenantId} provisioned successfully`);

    // Step 3: In a real implementation, we would:
    // - Create default settings/preferences
    // - Set up initial user accounts
    // - Configure default integrations
    // - Send welcome email
    // For now, we'll just log these steps

    console.log(`[Job ${jobId}] Setting up initial configuration for ${tenantId}`);
    console.log(`[Job ${jobId}] Owner email: ${ownerEmail}`);
    console.log(`[Job ${jobId}] Plan: ${plan}`);

    await client.end();

    const result: ProvisionTenantResult = {
      success: true,
      tenantId,
      provisionedAt: new Date(),
    };

    console.log(`[Job ${jobId}] Tenant provisioning completed`);
    return result;

  } catch (error) {
    console.error(`[Job ${jobId}] Tenant provisioning failed:`, error);

    const errorResult: ProvisionTenantResult = {
      success: false,
      tenantId,
      provisionedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    };

    throw error; // Re-throw to mark job as failed
  }
};
