import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database client - must be defined before imports that use it
vi.mock('@wf/db', () => {
  const mockDb = {
    query: {
      tenants: {
        findFirst: vi.fn(),
      },
      tenantSubscriptions: {
        findFirst: vi.fn(),
      },
      plans: {
        findFirst: vi.fn(),
      },
      tenantMembers: {
        findMany: vi.fn(),
      },
      tenantCreditUsage: {
        findFirst: vi.fn(),
      },
    },
  };

  return {
    db: mockDb,
    tenants: {},
    tenantSubscriptions: {},
    plans: {},
    tenantMembers: {},
    tenantCreditUsage: {},
  };
});

import { db } from '@wf/db';
import {
  checkFeatureEntitlement,
  checkSeatLimit,
  checkCreditEntitlement,
  getEntitlements
} from '../entitlements/check-entitlements';

// Get reference to mocked db for test setup
const mockDb = db as any;

describe('Entitlements - Feature Checking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checkFeatureEntitlement returns true for feature included in plan', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenants.findFirst.mockResolvedValue({
      id: tenantId,
      status: 'active',
    });

    mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue({
      tenantId,
      planId: 'plan-pro',
      status: 'active',
    });

    mockDb.query.plans.findFirst.mockResolvedValue({
      id: 'plan-pro',
      slug: 'pro',
      features: {
        configurableDashboards: true,
        webhookSync: true,
        whiteLabel: false,
        apiAccess: false,
      },
    });

    const result = await checkFeatureEntitlement(tenantId, 'configurableDashboards');
    expect(result).toBe(true);
  });

  it('checkFeatureEntitlement returns false for feature not in plan', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenants.findFirst.mockResolvedValue({
      id: tenantId,
      status: 'active',
    });

    mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue({
      tenantId,
      planId: 'plan-starter',
      status: 'active',
    });

    mockDb.query.plans.findFirst.mockResolvedValue({
      id: 'plan-starter',
      slug: 'starter',
      features: {
        configurableDashboards: false,
        webhookSync: false,
        whiteLabel: false,
        apiAccess: false,
      },
    });

    const result = await checkFeatureEntitlement(tenantId, 'configurableDashboards');
    expect(result).toBe(false);
  });

  it('checkFeatureEntitlement returns true for trial tenants', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenants.findFirst.mockResolvedValue({
      id: tenantId,
      status: 'trial',
    });

    mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue({
      tenantId,
      planId: 'plan-pro',
      status: 'trialing',
    });

    mockDb.query.plans.findFirst.mockResolvedValue({
      id: 'plan-pro',
      slug: 'pro',
      features: {
        configurableDashboards: true,
        webhookSync: true,
        whiteLabel: false,
        apiAccess: false,
      },
    });

    const result = await checkFeatureEntitlement(tenantId, 'configurableDashboards');
    expect(result).toBe(true);
  });

  it('checkFeatureEntitlement returns false for suspended tenants', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenants.findFirst.mockResolvedValue({
      id: tenantId,
      status: 'suspended',
    });

    const result = await checkFeatureEntitlement(tenantId, 'configurableDashboards');
    expect(result).toBe(false);
  });

  it('checkFeatureEntitlement returns false for churned tenants', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenants.findFirst.mockResolvedValue({
      id: tenantId,
      status: 'churned',
    });

    const result = await checkFeatureEntitlement(tenantId, 'configurableDashboards');
    expect(result).toBe(false);
  });
});

describe('Entitlements - Seat Limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checkSeatLimit returns current and max seat counts', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenantMembers.findMany.mockResolvedValue([
      { id: '1', status: 'active' },
      { id: '2', status: 'active' },
      { id: '3', status: 'invited' },
    ]);

    mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue({
      tenantId,
      planId: 'plan-starter',
      status: 'active',
    });

    mockDb.query.plans.findFirst.mockResolvedValue({
      id: 'plan-starter',
      maxUsers: 5,
    });

    const result = await checkSeatLimit(tenantId);

    expect(result).toEqual({
      current: 3,
      max: 5,
      canAddMore: true,
    });
  });

  it('checkSeatLimit returns unlimited for null maxUsers', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenantMembers.findMany.mockResolvedValue([
      { id: '1', status: 'active' },
      { id: '2', status: 'active' },
    ]);

    mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue({
      tenantId,
      planId: 'plan-enterprise',
      status: 'active',
    });

    mockDb.query.plans.findFirst.mockResolvedValue({
      id: 'plan-enterprise',
      maxUsers: null, // unlimited
    });

    const result = await checkSeatLimit(tenantId);

    expect(result).toEqual({
      current: 2,
      max: null,
      canAddMore: true,
    });
  });

  it('checkSeatLimit indicates when at capacity', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenantMembers.findMany.mockResolvedValue([
      { id: '1', status: 'active' },
      { id: '2', status: 'active' },
      { id: '3', status: 'active' },
      { id: '4', status: 'active' },
      { id: '5', status: 'active' },
    ]);

    mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue({
      tenantId,
      planId: 'plan-starter',
      status: 'active',
    });

    mockDb.query.plans.findFirst.mockResolvedValue({
      id: 'plan-starter',
      maxUsers: 5,
    });

    const result = await checkSeatLimit(tenantId);

    expect(result).toEqual({
      current: 5,
      max: 5,
      canAddMore: false,
    });
  });
});

describe('Entitlements - Credit Checking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checkCreditEntitlement returns true when credits available', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenantCreditUsage.findFirst.mockResolvedValue({
      tenantId,
      period: '2026-02',
      creditsAllocated: 50,
      creditsUsed: 20,
      creditsRemaining: 30,
    });

    const result = await checkCreditEntitlement(tenantId, 10);
    expect(result).toBe(true);
  });

  it('checkCreditEntitlement returns false when insufficient credits', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenantCreditUsage.findFirst.mockResolvedValue({
      tenantId,
      period: '2026-02',
      creditsAllocated: 50,
      creditsUsed: 45,
      creditsRemaining: 5,
    });

    const result = await checkCreditEntitlement(tenantId, 10);
    expect(result).toBe(false);
  });

  it('checkCreditEntitlement returns true for enterprise unlimited credits', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue({
      tenantId,
      planId: 'plan-enterprise',
      status: 'active',
    });

    mockDb.query.plans.findFirst.mockResolvedValue({
      id: 'plan-enterprise',
      slug: 'enterprise',
      monthlyCredits: null, // unlimited
    });

    mockDb.query.tenantCreditUsage.findFirst.mockResolvedValue(null);

    const result = await checkCreditEntitlement(tenantId, 100);
    expect(result).toBe(true);
  });
});

describe('Entitlements - Full Entitlement Object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getEntitlements returns complete entitlement object', async () => {
    const tenantId = 'tenant-1';

    mockDb.query.tenants.findFirst.mockResolvedValue({
      id: tenantId,
      status: 'active',
    });

    mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue({
      tenantId,
      planId: 'plan-pro',
      status: 'active',
    });

    mockDb.query.plans.findFirst.mockResolvedValue({
      id: 'plan-pro',
      slug: 'pro',
      monthlyCredits: 500,
      maxUsers: 50,
      features: {
        configurableDashboards: true,
        webhookSync: true,
        whiteLabel: false,
        apiAccess: false,
      },
    });

    mockDb.query.tenantMembers.findMany.mockResolvedValue([
      { id: '1', status: 'active' },
      { id: '2', status: 'active' },
    ]);

    mockDb.query.tenantCreditUsage.findFirst.mockResolvedValue({
      tenantId,
      period: '2026-02',
      creditsAllocated: 500,
      creditsUsed: 200,
      creditsRemaining: 300,
    });

    const result = await getEntitlements(tenantId);

    expect(result).toEqual({
      features: {
        configurableDashboards: true,
        webhookSync: true,
        whiteLabel: false,
        apiAccess: false,
      },
      seats: {
        current: 2,
        max: 50,
        canAddMore: true,
      },
      credits: {
        allocated: 500,
        used: 200,
        remaining: 300,
        unlimited: false,
      },
      subscription: {
        status: 'active',
        planSlug: 'pro',
      },
    });
  });
});
