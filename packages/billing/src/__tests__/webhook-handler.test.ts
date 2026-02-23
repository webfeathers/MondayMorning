import { describe, it, expect, beforeEach, vi } from 'vitest';
import Stripe from 'stripe';
import { handleStripeWebhook } from '../stripe/webhook-handler';

// Mock Stripe
vi.mock('stripe');

// Mock database
const mockDb = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
};

describe('Stripe Webhook Handler', () => {
  let mockStripeInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Stripe instance
    mockStripeInstance = {
      webhooks: {
        constructEvent: vi.fn(),
      },
    };

    (Stripe as any).mockImplementation(() => mockStripeInstance);
  });

  describe('handleStripeWebhook', () => {
    it('validates webhook signature', async () => {
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature';
      const webhookSecret = 'whsec_test';

      // Mock signature validation failure
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any)
      ).rejects.toThrow('Invalid signature');

      expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        rawBody,
        signature,
        webhookSecret
      );
    });

    it('returns handled status for valid webhook', async () => {
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature';
      const webhookSecret = 'whsec_test';

      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
            metadata: { tenantId: 'tenant-123' },
            current_period_start: 1640000000,
            current_period_end: 1642592000,
            items: {
              data: [{
                price: {
                  id: 'price_test',
                  product: 'prod_test',
                },
                quantity: 5,
              }],
            },
            trial_start: null,
            trial_end: null,
            canceled_at: null,
            cancel_at_period_end: false,
          },
        },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock DB operations
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([{ id: 'plan-uuid' }]);
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);
      mockDb.onConflictDoNothing.mockResolvedValue([]);

      const result = await handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any);

      expect(result.handled).toBe(true);
      expect(result.eventId).toBe('evt_test');
    });

    it('handles customer.subscription.created event', async () => {
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature';
      const webhookSecret = 'whsec_test';

      const mockSubscription = {
        id: 'sub_test',
        customer: 'cus_test',
        status: 'active',
        metadata: { tenantId: 'tenant-123' },
        current_period_start: 1640000000,
        current_period_end: 1642592000,
        items: {
          data: [{
            price: {
              id: 'price_test',
              product: 'prod_test',
            },
            quantity: 5,
          }],
        },
        trial_start: null,
        trial_end: null,
        canceled_at: null,
        cancel_at_period_end: false,
      };

      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.created',
        data: { object: mockSubscription },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock DB operations
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([{ id: 'plan-uuid' }]);
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);
      mockDb.onConflictDoNothing.mockResolvedValue([]);

      await handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          stripeSubscriptionId: 'sub_test',
          status: 'active',
          seatCount: 5,
        })
      );
    });

    it('handles customer.subscription.updated event', async () => {
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature';
      const webhookSecret = 'whsec_test';

      const mockSubscription = {
        id: 'sub_test',
        customer: 'cus_test',
        status: 'past_due',
        metadata: { tenantId: 'tenant-123' },
        current_period_start: 1640000000,
        current_period_end: 1642592000,
        items: {
          data: [{
            price: {
              id: 'price_test',
              product: 'prod_test',
            },
            quantity: 10,
          }],
        },
        trial_start: null,
        trial_end: null,
        canceled_at: null,
        cancel_at_period_end: false,
      };

      const mockEvent = {
        id: 'evt_test2',
        type: 'customer.subscription.updated',
        data: { object: mockSubscription },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock DB operations
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([{ id: 'plan-uuid' }]);
      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);

      await handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'past_due',
          seatCount: 10,
        })
      );
    });

    it('handles customer.subscription.deleted event', async () => {
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature';
      const webhookSecret = 'whsec_test';

      const mockSubscription = {
        id: 'sub_test',
        customer: 'cus_test',
        status: 'canceled',
        metadata: { tenantId: 'tenant-123' },
        current_period_start: 1640000000,
        current_period_end: 1642592000,
        items: {
          data: [{
            price: {
              id: 'price_test',
              product: 'prod_test',
            },
            quantity: 5,
          }],
        },
        trial_start: null,
        trial_end: null,
        canceled_at: 1640500000,
        cancel_at_period_end: false,
      };

      const mockEvent = {
        id: 'evt_test3',
        type: 'customer.subscription.deleted',
        data: { object: mockSubscription },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock DB operations
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([{ id: 'plan-uuid' }]);
      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);

      await handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'canceled',
        })
      );
    });

    it('handles invoice.payment_succeeded event', async () => {
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature';
      const webhookSecret = 'whsec_test';

      const mockInvoice = {
        id: 'in_test',
        customer: 'cus_test',
        subscription: 'sub_test',
        status: 'paid',
        amount_due: 10000,
        amount_paid: 10000,
        currency: 'usd',
        hosted_invoice_url: 'https://invoice.stripe.com/test',
        invoice_pdf: 'https://invoice.stripe.com/test.pdf',
        metadata: { tenantId: 'tenant-123' },
        due_date: 1640000000,
        status_transitions: {
          paid_at: 1640000000,
        },
        created: 1639900000,
        period_start: 1639900000,
        period_end: 1640000000,
      };

      const mockEvent = {
        id: 'evt_test4',
        type: 'invoice.payment_succeeded',
        data: { object: mockInvoice },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock DB operations
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([{ id: 'subscription-uuid' }]);
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);
      mockDb.onConflictDoNothing.mockResolvedValue([]);

      await handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          stripeInvoiceId: 'in_test',
          status: 'paid',
          amountDue: '100.00',
          amountPaid: '100.00',
        })
      );
    });

    it('handles invoice.payment_failed event', async () => {
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature';
      const webhookSecret = 'whsec_test';

      const mockInvoice = {
        id: 'in_test',
        customer: 'cus_test',
        subscription: 'sub_test',
        status: 'open',
        amount_due: 10000,
        amount_paid: 0,
        currency: 'usd',
        hosted_invoice_url: 'https://invoice.stripe.com/test',
        invoice_pdf: 'https://invoice.stripe.com/test.pdf',
        metadata: { tenantId: 'tenant-123' },
        due_date: 1640000000,
        status_transitions: {
          paid_at: null,
        },
        created: 1639900000,
        period_start: 1639900000,
        period_end: 1640000000,
      };

      const mockEvent = {
        id: 'evt_test5',
        type: 'invoice.payment_failed',
        data: { object: mockInvoice },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock DB operations for finding existing invoice
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([{ id: 'invoice-uuid' }]);
      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);

      await handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'open',
        })
      );
    });

    it('is idempotent - processing same event twice does not duplicate', async () => {
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature';
      const webhookSecret = 'whsec_test';

      const mockEvent = {
        id: 'evt_duplicate',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
            metadata: { tenantId: 'tenant-123' },
            current_period_start: 1640000000,
            current_period_end: 1642592000,
            items: {
              data: [{
                price: {
                  id: 'price_test',
                  product: 'prod_test',
                },
                quantity: 5,
              }],
            },
            trial_start: null,
            trial_end: null,
            canceled_at: null,
            cancel_at_period_end: false,
          },
        },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Mock DB operations
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([{ id: 'plan-uuid' }]);
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);

      // First call - no conflict
      mockDb.onConflictDoNothing.mockResolvedValueOnce([{ id: 'new-subscription' }]);

      const result1 = await handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any);
      expect(result1.handled).toBe(true);

      vi.clearAllMocks();

      // Reset mocks for second call
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue([{ id: 'plan-uuid' }]);
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);

      // Second call - conflict (already exists), should still return handled
      mockDb.onConflictDoNothing.mockResolvedValueOnce([]);

      const result2 = await handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any);
      expect(result2.handled).toBe(true);

      // Both should succeed idempotently
      expect(result1.eventId).toBe(result2.eventId);
    });

    it('throws error if tenant not found in metadata', async () => {
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature';
      const webhookSecret = 'whsec_test';

      const mockEvent = {
        id: 'evt_no_tenant',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
            metadata: {}, // No tenantId
            current_period_start: 1640000000,
            current_period_end: 1642592000,
            items: {
              data: [{
                price: {
                  id: 'price_test',
                  product: 'prod_test',
                },
                quantity: 5,
              }],
            },
            trial_start: null,
            trial_end: null,
            canceled_at: null,
            cancel_at_period_end: false,
          },
        },
      };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      await expect(
        handleStripeWebhook(rawBody, signature, webhookSecret, mockDb as any)
      ).rejects.toThrow('Tenant ID not found in metadata');
    });
  });
});
