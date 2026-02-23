import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncPlansToStripe } from '../stripe/plan-sync';
import Stripe from 'stripe';

// Mock database
let mockPlansData: any[] = [];
const mockDbWhere = vi.fn();
const mockDbSet = vi.fn();
const mockFrom = vi.fn();

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(mockPlansData)),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve([])),
    })),
  })),
} as any;

// Mock Stripe
const mockStripe = {
  products: {
    list: vi.fn(),
    create: vi.fn(),
  },
  prices: {
    list: vi.fn(),
    create: vi.fn(),
  },
} as any;

describe('Plan Sync', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockPlansData = [];
  });

  it('should create Stripe products for plans without stripeProductId', async () => {
    // Setup: Plan without Stripe product
    mockPlansData = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'starter',
        name: 'Starter',
        pricePerSeatMonthly: '29',
        stripeProductId: null,
        stripePriceId: null,
        isActive: true,
      },
    ];

    // Mock Stripe responses
    mockStripe.products.list.mockResolvedValue({ data: [] });
    mockStripe.products.create.mockResolvedValue({
      id: 'prod_test123',
      name: 'Starter',
      metadata: { plan_slug: 'starter' },
    });
    mockStripe.prices.list.mockResolvedValue({ data: [] });
    mockStripe.prices.create.mockResolvedValue({
      id: 'price_test123',
      product: 'prod_test123',
      unit_amount: 2900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    await syncPlansToStripe(mockDb, mockStripe);

    // Verify Stripe product was created
    expect(mockStripe.products.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Starter',
        metadata: expect.objectContaining({ plan_slug: 'starter' }),
      })
    );
  });

  it('should create Stripe prices for each plan', async () => {
    mockPlansData = [
      {
        id: '456e7890-e89b-12d3-a456-426614174001',
        slug: 'pro',
        name: 'Pro',
        pricePerSeatMonthly: '79',
        stripeProductId: null,
        stripePriceId: null,
        isActive: true,
      },
    ];

    // Mock existing product but no price
    mockStripe.products.list.mockResolvedValue({
      data: [
        {
          id: 'prod_existing',
          metadata: { plan_slug: 'pro' },
        },
      ],
    });
    mockStripe.prices.list.mockResolvedValue({ data: [] });
    mockStripe.prices.create.mockResolvedValue({
      id: 'price_test456',
      product: 'prod_existing',
      unit_amount: 7900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    await syncPlansToStripe(mockDb, mockStripe);

    // Verify Stripe price was created with monthly recurring
    expect(mockStripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'prod_existing',
        unit_amount: 7900,
        currency: 'usd',
        recurring: { interval: 'month' },
      })
    );
  });

  it('should sync Stripe product and price IDs back to plans table', async () => {
    const productId = 'prod_synced123';
    const priceId = 'price_synced123';

    mockPlansData = [
      {
        id: '789e0123-e89b-12d3-a456-426614174002',
        slug: 'enterprise',
        name: 'Enterprise',
        pricePerSeatMonthly: '149',
        stripeProductId: null,
        stripePriceId: null,
        isActive: true,
      },
    ];

    mockStripe.products.list.mockResolvedValue({ data: [] });
    mockStripe.products.create.mockResolvedValue({
      id: productId,
      metadata: { plan_slug: 'enterprise' },
    });
    mockStripe.prices.list.mockResolvedValue({ data: [] });
    mockStripe.prices.create.mockResolvedValue({
      id: priceId,
      product: productId,
    });

    await syncPlansToStripe(mockDb, mockStripe);

    // Verify the database was updated with Stripe IDs
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should be idempotent - running twice does not create duplicates', async () => {
    mockPlansData = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'starter',
        name: 'Starter',
        pricePerSeatMonthly: '29',
        stripeProductId: 'prod_existing',
        stripePriceId: 'price_existing',
        isActive: true,
      },
    ];

    const existingProduct = {
      id: 'prod_existing',
      metadata: { plan_slug: 'starter' },
    };
    const existingPrice = {
      id: 'price_existing',
      product: 'prod_existing',
      unit_amount: 2900,
      currency: 'usd',
      recurring: { interval: 'month' },
      active: true,
    };

    // Mock: Products and prices already exist
    mockStripe.products.list.mockResolvedValue({ data: [existingProduct] });
    mockStripe.prices.list.mockResolvedValue({ data: [existingPrice] });

    await syncPlansToStripe(mockDb, mockStripe);

    // Should NOT create new products or prices
    expect(mockStripe.products.create).not.toHaveBeenCalled();
    expect(mockStripe.prices.create).not.toHaveBeenCalled();
  });

  it('should sync from Stripe to local database', async () => {
    mockPlansData = [
      {
        id: '456e7890-e89b-12d3-a456-426614174001',
        slug: 'pro',
        name: 'Pro',
        pricePerSeatMonthly: '79',
        stripeProductId: null,
        stripePriceId: null,
        isActive: true,
      },
    ];

    const stripeProduct = {
      id: 'prod_from_stripe',
      name: 'Pro',
      metadata: { plan_slug: 'pro' },
    };
    const stripePrice = {
      id: 'price_from_stripe',
      product: 'prod_from_stripe',
      unit_amount: 7900,
      currency: 'usd',
      recurring: { interval: 'month' },
      active: true,
    };

    mockStripe.products.list.mockResolvedValue({ data: [stripeProduct] });
    mockStripe.prices.list.mockResolvedValue({ data: [stripePrice] });

    await syncPlansToStripe(mockDb, mockStripe);

    // The function should have synced Stripe IDs to the local plan
    expect(mockStripe.products.list).toHaveBeenCalled();
    expect(mockStripe.prices.list).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should use plan_slug metadata to link Stripe products to local plans', async () => {
    mockPlansData = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'starter',
        name: 'Starter',
        pricePerSeatMonthly: '29',
        stripeProductId: null,
        stripePriceId: null,
        isActive: true,
      },
    ];

    mockStripe.products.list.mockResolvedValue({ data: [] });
    mockStripe.products.create.mockResolvedValue({
      id: 'prod_test',
      metadata: { plan_slug: 'starter', plan_id: '123e4567-e89b-12d3-a456-426614174000' },
    });
    mockStripe.prices.list.mockResolvedValue({ data: [] });
    mockStripe.prices.create.mockResolvedValue({
      id: 'price_test',
      product: 'prod_test',
    });

    await syncPlansToStripe(mockDb, mockStripe);

    // Verify metadata includes plan_slug
    expect(mockStripe.products.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          plan_slug: 'starter',
        }),
      })
    );
  });
});
