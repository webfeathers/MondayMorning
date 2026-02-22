import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql as rawSql } from 'drizzle-orm';
import * as schema from './schema';

/**
 * Creates a tenant-aware database client with transaction isolation
 *
 * @param tenantId - The UUID of the tenant to isolate queries for
 * @returns A client with db instance, tenantId, and withTenantContext method
 *
 * @example
 * const client = createTenantClient('tenant-uuid');
 * await client.withTenantContext(async (tx) => {
 *   // All queries in this transaction are isolated to the tenant
 *   const deals = await tx.select().from(schema.deals);
 *   return deals;
 * });
 */
export function createTenantClient(tenantId: string) {
  if (!tenantId) {
    throw new Error('tenant ID is required');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });

  return {
    db,
    tenantId,
    /**
     * Execute a function within a transaction with tenant context set
     * Uses SET LOCAL to scope tenant_id to the transaction only
     * This prevents tenant data leakage in connection-pooled environments (PgBouncer/Supavisor)
     *
     * @param fn - Function to execute within the tenant-scoped transaction
     * @returns The result of the function
     */
    async withTenantContext<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => {
        // SET LOCAL scopes this setting to the current transaction only
        // This is critical for connection pooling safety
        await tx.execute(
          rawSql.raw(`SET LOCAL app.current_tenant_id = '${tenantId}'`)
        );
        return fn(tx as unknown as typeof db);
      });
    },
  };
}
