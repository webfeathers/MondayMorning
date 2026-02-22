import { describe, it, expect } from 'vitest';
import { plans, tenantSubscriptions, tenantInvoices, tenantCreditUsage, creditTopUps } from '../schema';

describe('Billing Schema', () => {
  it('plans table has required columns', () => {
    const columns = Object.keys(plans);
    expect(columns).toContain('id');
    expect(columns).toContain('slug');
    expect(columns).toContain('name');
    expect(columns).toContain('monthlyCredits');
    expect(columns).toContain('maxUsers');
    expect(columns).toContain('allowedModels');
    expect(columns).toContain('features');
    expect(columns).toContain('pricePerSeatMonthly');
    expect(columns).toContain('isActive');
  });

  it('tenant_subscriptions table has required columns', () => {
    const columns = Object.keys(tenantSubscriptions);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('planId');
    expect(columns).toContain('stripeSubscriptionId');
    expect(columns).toContain('status');
    expect(columns).toContain('seatCount');
    expect(columns).toContain('trialEndsAt');
  });

  it('tenant_invoices table has required columns', () => {
    const columns = Object.keys(tenantInvoices);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('stripeInvoiceId');
    expect(columns).toContain('status');
    expect(columns).toContain('amountDue');
    expect(columns).toContain('amountPaid');
  });

  it('tenant_credit_usage table has required columns', () => {
    const columns = Object.keys(tenantCreditUsage);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('period');
    expect(columns).toContain('creditsUsed');
    expect(columns).toContain('creditsRemaining');
  });

  it('credit_top_ups table has required columns', () => {
    const columns = Object.keys(creditTopUps);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('credits');
    expect(columns).toContain('stripePaymentIntentId');
    expect(columns).toContain('status');
  });
});
