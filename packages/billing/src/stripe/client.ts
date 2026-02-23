import Stripe from 'stripe';

/**
 * Get a configured Stripe client instance
 *
 * @throws {Error} If STRIPE_SECRET_KEY is not set
 * @returns {Stripe} Configured Stripe instance
 */
export function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }

  // Initialize Stripe with latest stable API version
  return new Stripe(apiKey, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
    // Add request timeout and retries for production resilience
    timeout: 30000, // 30 seconds
    maxNetworkRetries: 2,
  });
}

// Singleton instance for reuse
let stripeInstance: Stripe | null = null;

/**
 * Get or create a singleton Stripe client
 * Reuses the same instance across calls to avoid unnecessary instantiation
 *
 * @throws {Error} If STRIPE_SECRET_KEY is not set
 * @returns {Stripe} Configured Stripe instance
 */
export function getStripeClientSingleton(): Stripe {
  if (!stripeInstance) {
    stripeInstance = getStripeClient();
  }
  return stripeInstance;
}
