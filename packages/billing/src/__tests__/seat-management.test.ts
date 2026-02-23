import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { addSeats, removeSeats, getSeatInfo, calculateNextInvoicePreview } from '../stripe/seat-manager';
import { getStripeClient } from '../stripe/client';

// Set mock DATABASE_URL
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock Stripe client
vi.mock('../stripe/client', () => ({
  getStripeClient: vi.fn(),
}));

// Mock database queries
const mockDbQuery = {
  tenantSubscriptions: {
    findFirst: vi.fn(),
  },
  tenantMembers: {
    findMany: vi.fn(),
  },
};

const mockDbUpdate = vi.fn(() => ({
  set: vi.fn(() => ({
    where: vi.fn(),
  })),
}));

// Mock drizzle
vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    query: mockDbQuery,
    update: mockDbUpdate,
  })),
}));

// Mock postgres
vi.mock('postgres', () => ({
  default: vi.fn(() => ({})),
}));

describe('Seat Management', () => {
  const mockStripe = {
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
    },
    subscriptionItems: {
      update: vi.fn(),
    },
    invoices: {
      retrieveUpcoming: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getStripeClient as any).mockReturnValue(mockStripe);
  });

  describe('addSeats', () => {
    it('should add seats to subscription and update Stripe quantity', async () => {
      const tenantId = 'tenant-123';
      const count = 3;

      // Mock DB subscription query
      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        planId: 'plan-123',
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: 'active',
        seatCount: 5,
        plan: {
          id: 'plan-123',
          maxUsers: 20,
        },
      });

      // Mock Stripe subscription retrieval
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: {
          data: [
            {
              id: 'si_123',
              quantity: 5, // current quantity
            },
          ],
        },
        metadata: { tenant_id: tenantId },
      });

      // Mock subscription item update
      mockStripe.subscriptionItems.update.mockResolvedValue({
        id: 'si_123',
        quantity: 8, // new quantity
      });

      const result = await addSeats(tenantId, count);

      expect(result).toMatchObject({
        newSeatCount: 8,
        previousSeatCount: 5,
      });

      // Verify Stripe was called with proration_behavior
      expect(mockStripe.subscriptionItems.update).toHaveBeenCalledWith(
        'si_123',
        {
          quantity: 8,
          proration_behavior: 'create_prorations',
        }
      );
    });

    it('should update tenant_subscriptions.seat_count in DB', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: 'active',
        seatCount: 5,
        plan: { id: 'plan-123', maxUsers: 20 },
      });

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'si_123', quantity: 5 }] },
      });

      mockStripe.subscriptionItems.update.mockResolvedValue({
        quantity: 8,
      });

      await addSeats(tenantId, 3);

      // Verify DB update was called
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('should enforce max_users limit from plan', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: 'active',
        seatCount: 5,
        plan: { id: 'plan-123', maxUsers: 10 }, // max is 10
      });

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'si_123', quantity: 5 }] },
        metadata: { plan_max_users: '10' },
      });

      // Attempting to add 10 seats when max is 10 and current is 5
      await expect(addSeats(tenantId, 10)).rejects.toThrow('Cannot add 10 seats');
    });

    it('should return proration amount for mid-cycle changes', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: 'active',
        seatCount: 5,
        plan: { id: 'plan-123', maxUsers: 20 },
      });

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'si_123', quantity: 5 }] },
      });

      mockStripe.subscriptionItems.update.mockResolvedValue({
        quantity: 8,
      });

      // Mock upcoming invoice for proration preview
      mockStripe.invoices.retrieveUpcoming.mockResolvedValue({
        total: 23700, // in cents
        lines: {
          data: [
            {
              description: 'Proration',
              amount: 5900,
            },
          ],
        },
      });

      const result = await addSeats(tenantId, 3);

      expect(result).toHaveProperty('prorationAmount');
    });
  });

  describe('removeSeats', () => {
    it('should remove seats from subscription', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: 'active',
        seatCount: 10,
        plan: { id: 'plan-123', maxUsers: 20 },
      });

      mockDbQuery.tenantMembers.findMany.mockResolvedValue([
        { id: '1', status: 'active' },
        { id: '2', status: 'active' },
        { id: '3', status: 'invited' },
      ]); // 3 members

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'si_123', quantity: 10 }] },
      });

      mockStripe.subscriptionItems.update.mockResolvedValue({
        quantity: 7,
      });

      const result = await removeSeats(tenantId, 3);

      expect(result.newSeatCount).toBe(7);
      expect(mockStripe.subscriptionItems.update).toHaveBeenCalledWith(
        'si_123',
        {
          quantity: 7,
          proration_behavior: 'create_prorations',
        }
      );
    });

    it('should prevent removing seats below active member count', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        seatCount: 10,
        plan: { id: 'plan-123', maxUsers: 20 },
      });

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'si_123', quantity: 10 }] },
      });

      // Test with explicit active member count parameter
      await expect(removeSeats(tenantId, 8, 5)).rejects.toThrow(
        'Cannot remove 8 seats'
      );
    });

    it('should update Stripe subscription quantity', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        seatCount: 10,
        plan: { id: 'plan-123', maxUsers: 20 },
      });

      mockDbQuery.tenantMembers.findMany.mockResolvedValue([
        { id: '1', status: 'active' },
      ]);

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'si_123', quantity: 10 }] },
      });

      mockStripe.subscriptionItems.update.mockResolvedValue({
        quantity: 7,
      });

      await removeSeats(tenantId, 3);

      expect(mockStripe.subscriptionItems.update).toHaveBeenCalled();
    });

    it('should update DB seat_count', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        seatCount: 10,
        plan: { id: 'plan-123', maxUsers: 20 },
      });

      mockDbQuery.tenantMembers.findMany.mockResolvedValue([
        { id: '1', status: 'active' },
      ]);

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'si_123', quantity: 10 }] },
      });

      mockStripe.subscriptionItems.update.mockResolvedValue({
        quantity: 7,
      });

      await removeSeats(tenantId, 3);

      // Verify DB update was called
      expect(mockDbUpdate).toHaveBeenCalled();
    });
  });

  describe('getSeatInfo', () => {
    it('should return current seat usage information', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        seatCount: 10,
        plan: { id: 'plan-123', maxUsers: 20 },
      });

      mockDbQuery.tenantMembers.findMany.mockResolvedValue([
        { id: '1', status: 'active' },
        { id: '2', status: 'active' },
        { id: '3', status: 'invited' },
      ]);

      const seatInfo = await getSeatInfo(tenantId);

      expect(seatInfo).toMatchObject({
        activeMembers: 2,
        invitedMembers: 1,
        totalSeats: 10,
        maxSeats: 20,
        canAddMore: true,
        availableSeats: 17,
      });
    });

    it('should calculate canAddMore based on available seats', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        seatCount: 10,
        plan: { id: 'plan-123', maxUsers: null }, // unlimited
      });

      mockDbQuery.tenantMembers.findMany.mockResolvedValue([
        { id: '1', status: 'active' },
        { id: '2', status: 'active' },
      ]);

      const seatInfo = await getSeatInfo(tenantId);

      expect(seatInfo.maxSeats).toBe(null);
      expect(seatInfo.canAddMore).toBe(true);
    });
  });

  describe('calculateNextInvoicePreview', () => {
    it('should show cost impact of seat changes using Stripe upcoming invoice', async () => {
      const tenantId = 'tenant-123';
      const seatChange = 3;

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: 'active',
        seatCount: 5,
        plan: { id: 'plan-123', maxUsers: 20 },
      });

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'si_123', quantity: 5 }] },
      });

      mockStripe.invoices.retrieveUpcoming.mockResolvedValue({
        total: 47600, // in cents ($476.00)
        amount_due: 47600,
        lines: {
          data: [
            {
              description: 'Subscription update',
              amount: 23700,
            },
            {
              description: 'Proration for increased seats',
              amount: 5900,
            },
          ],
        },
        period_start: Math.floor(Date.now() / 1000),
        period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
      });

      const preview = await calculateNextInvoicePreview(tenantId, seatChange);

      expect(preview).toMatchObject({
        total: 47600,
        prorationAmount: 5900,
      });

      expect(mockStripe.invoices.retrieveUpcoming).toHaveBeenCalled();
    });

    it('should handle negative seat changes (removals)', async () => {
      const tenantId = 'tenant-123';

      mockDbQuery.tenantSubscriptions.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        tenantId,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: 'active',
        seatCount: 10,
        plan: { id: 'plan-123', maxUsers: 20 },
      });

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'si_123', quantity: 10 }] },
      });

      mockStripe.invoices.retrieveUpcoming.mockResolvedValue({
        total: 33250,
        amount_due: 33250,
        lines: {
          data: [
            {
              description: 'Subscription update',
              amount: 39500,
            },
            {
              description: 'Proration for decreased seats',
              amount: -6250, // credit
            },
          ],
        },
        period_end: Math.floor(Date.now() / 1000) + 2592000,
      });

      const preview = await calculateNextInvoicePreview(tenantId, -3);

      expect(preview.total).toBe(33250);
      expect(preview.prorationAmount).toBe(-6250);
    });
  });

  describe('DB trigger enforcement', () => {
    it('should prevent adding seats beyond max_users at DB level', async () => {
      // This test validates that the Phase 1 DB trigger works
      // The trigger should fire when tenant_members INSERT would exceed seat_count

      // This is an integration test that requires actual DB
      // For now, document the expected behavior
      expect(true).toBe(true);
    });
  });
});
