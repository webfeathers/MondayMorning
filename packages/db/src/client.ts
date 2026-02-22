import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Base database client factory
 * Returns a raw Drizzle instance without tenant isolation
 */
export function createBaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });

  return { db, sql };
}
