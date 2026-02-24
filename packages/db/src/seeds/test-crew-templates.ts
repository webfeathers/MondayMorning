/**
 * Test script to verify crew templates were seeded correctly
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { crewTemplates } from '../schema/crew-templates';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function testCrewTemplates() {
  const sql = postgres(DATABASE_URL);
  const db = drizzle(sql);

  try {
    console.log('🧪 Testing crew templates retrieval...\n');

    const templates = await db.select().from(crewTemplates);

    console.log(`✅ Found ${templates.length} crew templates:\n`);

    for (const template of templates) {
      console.log(`   📋 ${template.name}`);
      console.log(`      Slug: ${template.slug}`);
      console.log(`      Estimated Cost: ${template.estimatedCreditCost} credits`);
      console.log(`      Max Context:`, template.maxContext);
      console.log(`      Active: ${template.isActive}`);
      console.log(`      Agents: ${template.config?.agents?.length || 0}`);
      console.log(`      Tasks: ${template.config?.tasks?.length || 0}`);
      console.log();
    }

    console.log('✅ Test complete!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testCrewTemplates();
