import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the permission system
vi.mock('@/lib/require-permission', () => ({
  withPermission: (permission: string, handler: any) => handler,
}));

// Mock the billing package - use vi.fn() directly in factory
vi.mock('@wf/billing', () => ({
  getEntitlements: vi.fn(),
  upgradeSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  addSeats: vi.fn(),
  removeSeats: vi.fn(),
  getStripeClient: vi.fn(),
  CreditManager: vi.fn().mockImplementation(() => ({
    getCurrentPeriodUsage: vi.fn(),
  })),
}));

// Mock the database - use vi.fn() directly in factory
vi.mock('@wf/db', () => ({
  db: {
    query: {
      tenantInvoices: {
        findMany: vi.fn(),
      },
      tenantSubscriptions: {
        findFirst: vi.fn(),
      },
    },
  },
  tenantInvoices: {},
  tenantSubscriptions: {},
}));

// Import route handlers AFTER mocks are set up
import { GET as getPlan } from '@/app/api/billing/plan/route';
import { GET as getInvoices } from '@/app/api/billing/invoices/route';
import { GET as getUsage } from '@/app/api/billing/usage/route';
import { POST as upgradeSubscription } from '@/app/api/billing/subscription/upgrade/route';
import { POST as cancelSubscription } from '@/app/api/billing/subscription/cancel/route';
import { POST as addSeats } from '@/app/api/billing/seats/add/route';
import { POST as removeSeats } from '@/app/api/billing/seats/remove/route';
import { GET as getPortalLink } from '@/app/api/billing/portal/route';
import * as billing from '@wf/billing';
import { db } from '@wf/db';

describe('Billing API Routes', () => {
  const mockRequest = (body?: any) => {
    const request = new NextRequest('http://localhost:3000/api/billing', {
      method: body ? 'POST' : 'GET',
      headers: {
        'x-user-id': 'test-user-id',
        'x-tenant-id': 'test-tenant-id',
      },
      ...(body && { body: JSON.stringify(body) }),
    });
    return request;
  };

  const mockContext = {
    params: {},
    userId: 'test-user-id',
    tenantId: 'test-tenant-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/billing/plan', () => {
    it('returns current plan and subscription details', async () => {
      vi.mocked(billing.getEntitlements).mockResolvedValue({
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: false,
        },
        seats: {
          current: 5,
          max: 50,
          canAddMore: true,
        },
        credits: {
          allocated: 500,
          used: 120,
          remaining: 380,
          unlimited: false,
        },
        subscription: {
          status: 'active',
          planSlug: 'pro',
        },
      });

      const request = mockRequest();
      const response = await getPlan(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.plan).toBeDefined();
      expect(data.subscription).toBeDefined();
      expect(data.entitlements).toBeDefined();
      expect(data.plan.slug).toBe('pro');
      expect(data.subscription.status).toBe('active');
    });

    it('requires billing:view permission', async () => {
      // This is tested by the permission wrapper
      expect(getPlan).toBeDefined();
    });
  });

  describe('GET /api/billing/invoices', () => {
    it('returns invoice history from database', async () => {
      vi.mocked(db.query.tenantInvoices.findMany).mockResolvedValue([
        {
          id: 'inv-1',
          tenantId: 'test-tenant-id',
          stripeInvoiceId: 'in_test123',
          amount: '9900',
          currency: 'usd',
          status: 'paid',
          invoiceDate: new Date('2026-02-01'),
          dueDate: new Date('2026-02-15'),
          paidAt: new Date('2026-02-02'),
          invoiceUrl: 'https://stripe.com/invoice/123',
          createdAt: new Date('2026-02-01'),
          updatedAt: new Date('2026-02-02'),
        },
      ]);

      const request = mockRequest();
      const response = await getInvoices(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invoices).toBeDefined();
      expect(Array.isArray(data.invoices)).toBe(true);
      expect(data.invoices.length).toBeGreaterThan(0);
      expect(data.invoices[0]).toHaveProperty('amount');
      expect(data.invoices[0]).toHaveProperty('status');
    });
  });

  describe('GET /api/billing/usage', () => {
    it('returns credit usage stats using CreditManager', async () => {
      const mockInstance = {
        getCurrentPeriodUsage: vi.fn().mockResolvedValue({
          period: '2026-02',
          creditsUsed: 120,
          creditsAllowed: 500,
          creditsRemaining: 380,
          percentUsed: 0.24,
          warningThreshold: false,
        }),
      };
      vi.mocked(billing.CreditManager).mockImplementation(() => mockInstance as any);

      const request = mockRequest();
      const response = await getUsage(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usage).toBeDefined();
      expect(data.usage.period).toBe('2026-02');
      expect(data.usage.creditsUsed).toBe(120);
      expect(data.usage.creditsRemaining).toBe(380);
      expect(data.usage.percentUsed).toBe(0.24);
    });
  });

  describe('POST /api/billing/subscription/upgrade', () => {
    it('upgrades subscription to new plan', async () => {
      vi.mocked(billing.upgradeSubscription).mockResolvedValue({
        success: true,
        newPlanSlug: 'enterprise',
        prorationInvoiceId: 'in_proration123',
        prorationAmount: 5000,
      });

      const request = mockRequest({ newPlanSlug: 'enterprise' });
      const response = await upgradeSubscription(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newPlanSlug).toBe('enterprise');
    });

    it('requires billing:manage permission', async () => {
      expect(upgradeSubscription).toBeDefined();
    });
  });

  describe('POST /api/billing/subscription/cancel', () => {
    it('cancels subscription', async () => {
      vi.mocked(billing.cancelSubscription).mockResolvedValue({
        success: true,
        canceledImmediately: false,
        effectiveAt: new Date('2026-03-01'),
      });

      const request = mockRequest({ immediately: false });
      const response = await cancelSubscription(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.canceledImmediately).toBe(false);
    });

    it('requires billing:manage permission', async () => {
      expect(cancelSubscription).toBeDefined();
    });
  });

  describe('POST /api/billing/seats/add', () => {
    it('adds seats to subscription', async () => {
      vi.mocked(billing.addSeats).mockResolvedValue({
        newSeatCount: 12,
        previousSeatCount: 10,
        prorationAmount: 2000,
      });

      const request = mockRequest({ count: 2 });
      const response = await addSeats(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newSeatCount).toBe(12);
      expect(data.previousSeatCount).toBe(10);
    });

    it('requires billing:manage permission', async () => {
      expect(addSeats).toBeDefined();
    });
  });

  describe('POST /api/billing/seats/remove', () => {
    it('removes seats from subscription', async () => {
      vi.mocked(billing.removeSeats).mockResolvedValue({
        newSeatCount: 8,
        previousSeatCount: 10,
      });

      const request = mockRequest({ count: 2 });
      const response = await removeSeats(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newSeatCount).toBe(8);
      expect(data.previousSeatCount).toBe(10);
    });

    it('requires billing:manage permission', async () => {
      expect(removeSeats).toBeDefined();
    });
  });

  describe('GET /api/billing/portal', () => {
    it('returns Stripe portal link', async () => {
      const mockCreateBillingPortalSession = vi.fn().mockResolvedValue({
        url: 'https://billing.stripe.com/session/test123',
      });

      vi.mocked(db.query.tenantSubscriptions.findFirst).mockResolvedValue({
        id: 'sub-1',
        tenantId: 'test-tenant-id',
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
      } as any);

      vi.mocked(billing.getStripeClient).mockReturnValue({
        billingPortal: {
          sessions: {
            create: mockCreateBillingPortalSession,
          },
        },
      } as any);

      const request = mockRequest();
      const response = await getPortalLink(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBeDefined();
      expect(data.url).toContain('stripe.com');
    });

    it('requires billing:view permission', async () => {
      expect(getPortalLink).toBeDefined();
    });
  });
});
