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

// Singleton database instance for non-tenant-specific operations
// (e.g., authentication, user lookup)
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const { db } = createBaseClient();
    _db = db;
  }
  return _db;
}

// Lazy getter for db to avoid initialization during build
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const realDb = getDb();
    return (realDb as any)[prop];
  },
});
