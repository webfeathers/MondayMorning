import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { plans } from '@wf/db';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@wf/db';

/**
 * Syncs plans between local database and Stripe
 *
 * Ensures Stripe products and prices exist for each plan in the database.
 * Updates the local database with Stripe product and price IDs.
 *
 * This function is idempotent - safe to run multiple times.
 *
 * @param db - Drizzle database instance
 * @param stripe - Stripe client instance
 */
export async function syncPlansToStripe(
  db: PostgresJsDatabase<typeof schema>,
  stripe: Stripe
): Promise<void> {
  console.log('🔄 Starting plan sync to Stripe...');

  // 1. Fetch all active plans from database
  const localPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true));

  console.log(`📋 Found ${localPlans.length} active plans in database`);

  // 2. Fetch all products from Stripe (with plan_slug metadata)
  const stripeProducts = await stripe.products.list({
    limit: 100,
    active: true,
  });

  console.log(`📦 Found ${stripeProducts.data.length} active products in Stripe`);

  // Build a map of plan_slug -> Stripe product for quick lookup
  const productsBySlug = new Map<string, Stripe.Product>();
  for (const product of stripeProducts.data) {
    const planSlug = product.metadata?.plan_slug;
    if (planSlug) {
      productsBySlug.set(planSlug, product);
    }
  }

  // 3. Process each plan
  for (const plan of localPlans) {
    console.log(`\n🔍 Processing plan: ${plan.slug} (${plan.name})`);

    let stripeProduct = productsBySlug.get(plan.slug);

    // 3a. Create Stripe product if it doesn't exist
    if (!stripeProduct) {
      console.log(`  ➕ Creating Stripe product for ${plan.slug}...`);
      stripeProduct = await stripe.products.create({
        name: plan.name,
        description: `${plan.name} plan - ${plan.monthlyCredits || 'Unlimited'} credits/month`,
        metadata: {
          plan_slug: plan.slug,
          plan_id: plan.id,
        },
      });
      console.log(`  ✅ Created product: ${stripeProduct.id}`);
    } else {
      console.log(`  ✓ Product already exists: ${stripeProduct.id}`);
    }

    // 3b. Find or create Stripe price for this product
    const existingPrices = await stripe.prices.list({
      product: stripeProduct.id,
      active: true,
      limit: 10,
    });

    // Look for a monthly recurring price
    let stripePrice = existingPrices.data.find(
      (price) => price.recurring?.interval === 'month' && price.active
    );

    if (!stripePrice && plan.pricePerSeatMonthly) {
      console.log(`  ➕ Creating Stripe price for ${plan.slug}...`);

      // Convert decimal price to cents
      const unitAmount = Math.round(parseFloat(plan.pricePerSeatMonthly) * 100);

      stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: unitAmount,
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          plan_slug: plan.slug,
          plan_id: plan.id,
        },
      });
      console.log(`  ✅ Created price: ${stripePrice.id} ($${plan.pricePerSeatMonthly}/month)`);
    } else if (stripePrice) {
      console.log(`  ✓ Price already exists: ${stripePrice.id}`);
    } else {
      console.log(`  ⚠️  No price needed (plan has no monthly price)`);
    }

    // 3c. Update local database with Stripe IDs
    const updates: { stripeProductId: string; stripePriceId?: string } = {
      stripeProductId: stripeProduct.id,
    };

    if (stripePrice) {
      updates.stripePriceId = stripePrice.id;
    }

    // Only update if the IDs have changed
    if (
      plan.stripeProductId !== stripeProduct.id ||
      (stripePrice && plan.stripePriceId !== stripePrice.id)
    ) {
      await db
        .update(plans)
        .set(updates)
        .where(eq(plans.id, plan.id));

      console.log(`  💾 Updated local plan with Stripe IDs`);
    } else {
      console.log(`  ✓ Local plan already has correct Stripe IDs`);
    }
  }

  console.log('\n✨ Plan sync completed successfully!');
}
