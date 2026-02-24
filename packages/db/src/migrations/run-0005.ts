/**
 * Manual migration runner for 0005_update_ai_usage.sql
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function runMigration() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('Running migration 0005_update_ai_usage.sql...');

    const migrationSql = readFileSync(
      join(__dirname, '../../drizzle/0005_update_ai_usage.sql'),
      'utf-8'
    );

    // Execute the migration
    await sql.unsafe(migrationSql);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
