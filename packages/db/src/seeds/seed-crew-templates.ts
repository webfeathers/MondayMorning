/**
 * Seed crew templates into the database
 *
 * This script populates the crew_templates table with default AI crew configurations.
 * Can be run multiple times - uses upsert to update existing templates.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { crewTemplates } from '../schema/crew-templates';
import { crewTemplateSeeds } from './crew-templates.seed';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function seedCrewTemplates() {
  const sql = postgres(DATABASE_URL);
  const db = drizzle(sql);

  try {
    console.log('🌱 Seeding crew templates...\n');

    let inserted = 0;
    let updated = 0;

    for (const template of crewTemplateSeeds) {
      try {
        // Try to insert, on conflict update
        const existing = await db
          .select()
          .from(crewTemplates)
          .where(eq(crewTemplates.slug, template.slug))
          .limit(1);

        if (existing.length > 0) {
          // Update existing template
          await db
            .update(crewTemplates)
            .set({
              name: template.name,
              description: template.description,
              maxContext: template.maxContext,
              estimatedCreditCost: template.estimatedCreditCost,
              config: template.config,
              isActive: template.isActive,
              updatedAt: new Date(),
            })
            .where(eq(crewTemplates.slug, template.slug));

          updated++;
          console.log(`   ✅ Updated: ${template.name} (${template.slug})`);
        } else {
          // Insert new template
          await db.insert(crewTemplates).values(template);
          inserted++;
          console.log(`   ✨ Created: ${template.name} (${template.slug})`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to seed ${template.slug}:`, error);
      }
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Created: ${inserted}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Total: ${crewTemplateSeeds.length}\n`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seedCrewTemplates();
