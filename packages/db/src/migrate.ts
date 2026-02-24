/**
 * Custom migration script to apply the latest migration.
 * This script loads the DATABASE_URL from the root .env file.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the project root (two levels up from this file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

// Load DATABASE_URL from root .env file
let DATABASE_URL: string | undefined;
try {
  const envPath = join(projectRoot, '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  const match = envContent.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
  if (match) {
    DATABASE_URL = match[1].trim();
  }
} catch (error) {
  console.error('Error loading .env file:', error);
}

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env file');
  process.exit(1);
}

// Connect to database
const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

async function migrate() {
  try {
    // Read the latest migration file
    const migrationPath = join(__dirname, '../drizzle/0004_wooden_beast.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('Applying migration 0004_wooden_beast...');

    // Split by statement breakpoint and execute each statement
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        await client.unsafe(statement);
        console.log('✓ Executed statement');
      } catch (error: any) {
        // Ignore "already exists" errors for idempotency
        if (error.code === '42P07') {
          console.log('⊘ Table already exists, skipping');
        } else {
          throw error;
        }
      }
    }

    console.log('✓ Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
