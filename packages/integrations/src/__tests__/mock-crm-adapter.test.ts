/**
 * Tests for MockCRMAdapter
 *
 * Verifies that the mock adapter correctly implements the CRMProvider interface
 * and returns realistic canned data for testing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockCRMAdapter } from '../adapters/mock-crm-adapter';
import type { CRMProvider } from '../types/crm-provider';

describe('MockCRMAdapter', () => {
  let adapter: CRMProvider;

  beforeEach(() => {
    adapter = new MockCRMAdapter();
  });

  // ============================================
  // AUTHENTICATION TESTS
  // ============================================

  describe('authenticate', () => {
    it('returns success with mock token', async () => {
      const result = await adapter.authenticate({ apiKey: 'mock-key' });

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock_access_token_abc123');
      expect(result.refreshToken).toBe('mock_refresh_token_xyz789');
      expect(result.expiresAt).toBeDefined();
    });

    it('includes metadata in auth result', async () => {
      const result = await adapter.authenticate({ apiKey: 'mock-key' });

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.instanceUrl).toBe('https://mock-crm.example.com');
    });
  });

  describe('refreshToken', () => {
    it('returns new tokens when refreshing', async () => {
      const result = await adapter.refreshToken('old_refresh_token');

      expect(result.accessToken).toBe('mock_access_token_refreshed');
      expect(result.refreshToken).toBe('mock_refresh_token_refreshed');
    });
  });

  describe('testConnection', () => {
    it('returns true for healthy connection', async () => {
      const isHealthy = await adapter.testConnection();

      expect(isHealthy).toBe(true);
    });
  });

  // ============================================
  // SCHEMA DISCOVERY TESTS
  // ============================================

  describe('discoverObjects', () => {
    it('returns mock CRM object schemas', async () => {
      const objects = await adapter.discoverObjects();

      expect(objects).toHaveLength(4);
      expect(objects.map(o => o.name)).toEqual(['Account', 'Contact', 'Deal', 'Ticket']);
    });

    it('marks all objects as syncable', async () => {
      const objects = await adapter.discoverObjects();

      objects.forEach(object => {
        expect(object.syncable).toBe(true);
      });
    });
  });

  describe('discoverFields', () => {
    it('returns Deal field definitions', async () => {
      const fields = await adapter.discoverFields('Deal');

      expect(fields.length).toBeGreaterThan(0);
      expect(fields.find(f => f.name === 'Name')).toBeDefined();
      expect(fields.find(f => f.name === 'Amount')).toBeDefined();
      expect(fields.find(f => f.name === 'Stage')).toBeDefined();
      expect(fields.find(f => f.name === 'CloseDate')).toBeDefined();
    });

    it('includes custom fields with custom flag', async () => {
      const fields = await adapter.discoverFields('Deal');
      const customField = fields.find(f => f.name === 'Custom_Score__c');

      expect(customField).toBeDefined();
      expect(customField?.custom).toBe(true);
      expect(customField?.type).toBe('number');
    });

    it('returns Account field definitions', async () => {
      const fields = await adapter.discoverFields('Account');

      expect(fields.length).toBeGreaterThan(0);
      expect(fields.find(f => f.name === 'Name')).toBeDefined();
      expect(fields.find(f => f.name === 'Domain')).toBeDefined();
      expect(fields.find(f => f.name === 'Industry')).toBeDefined();
    });
  });

  describe('getObjectMetadata', () => {
    it('returns Deal metadata with capabilities', async () => {
      const metadata = await adapter.getObjectMetadata('Deal');

      expect(metadata.queryable).toBe(true);
      expect(metadata.creatable).toBe(true);
      expect(metadata.updateable).toBe(true);
      expect(metadata.deletable).toBe(true);
      expect(metadata.supportsSoftDelete).toBe(true);
      expect(metadata.estimatedRecordCount).toBeGreaterThan(0);
    });
  });

  // ============================================
  // DATA SYNC TESTS
  // ============================================

  describe('syncDeals', () => {
    it('returns canned deal data', async () => {
      const result = await adapter.syncDeals({ mode: 'full' });

      expect(result.records).toHaveLength(10);
      expect(result.hasMore).toBe(false);
      expect(result.metadata.totalProcessed).toBe(10);
    });

    it('includes realistic deal fields', async () => {
      const result = await adapter.syncDeals({ mode: 'full' });
      const deal = result.records[0];

      expect(deal.id).toBeDefined();
      expect(deal.name).toBeDefined();
      expect(deal.amount).toBeGreaterThan(0);
      expect(deal.currency).toBe('USD');
      expect(deal.stage).toBeDefined();
      expect(deal.probability).toBeGreaterThanOrEqual(0);
      expect(deal.probability).toBeLessThanOrEqual(100);
      expect(deal.closeDate).toBeDefined();
      expect(deal.createdAt).toBeDefined();
      expect(deal.updatedAt).toBeDefined();
    });

    it('includes custom fields in deal data', async () => {
      const result = await adapter.syncDeals({ mode: 'full' });
      const deal = result.records[0];

      expect(deal.customFields).toBeDefined();
      expect(deal.customFields.Custom_Score__c).toBeDefined();
      expect(deal.customFields.Lead_Source__c).toBeDefined();
    });

    it('supports pagination with cursor', async () => {
      const firstPage = await adapter.syncDeals({ mode: 'full', limit: 5 });

      expect(firstPage.records).toHaveLength(5);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.cursor).toBeDefined();

      const secondPage = await adapter.syncDeals({
        mode: 'incremental',
        cursor: firstPage.cursor,
        limit: 5
      });

      expect(secondPage.records).toHaveLength(5);
      expect(secondPage.hasMore).toBe(false);
    });
  });

  describe('syncAccounts', () => {
    it('returns canned account data', async () => {
      const result = await adapter.syncAccounts({ mode: 'full' });

      expect(result.records).toHaveLength(10);
      expect(result.hasMore).toBe(false);
    });

    it('includes realistic account fields', async () => {
      const result = await adapter.syncAccounts({ mode: 'full' });
      const account = result.records[0];

      expect(account.id).toBeDefined();
      expect(account.name).toBeDefined();
      expect(account.domain).toBeDefined();
      expect(account.industry).toBeDefined();
      expect(account.employeeCount).toBeGreaterThan(0);
      expect(account.revenue).toBeGreaterThan(0);
      expect(account.customFields).toBeDefined();
    });
  });

  describe('syncContacts', () => {
    it('returns canned contact data', async () => {
      const result = await adapter.syncContacts({ mode: 'full' });

      expect(result.records).toHaveLength(10);
      expect(result.hasMore).toBe(false);
    });

    it('includes realistic contact fields', async () => {
      const result = await adapter.syncContacts({ mode: 'full' });
      const contact = result.records[0];

      expect(contact.id).toBeDefined();
      expect(contact.firstName).toBeDefined();
      expect(contact.lastName).toBeDefined();
      expect(contact.email).toBeDefined();
      expect(contact.title).toBeDefined();
      expect(contact.customFields).toBeDefined();
    });
  });

  describe('syncTickets', () => {
    it('returns canned ticket data', async () => {
      const result = await adapter.syncTickets({ mode: 'full' });

      expect(result.records).toHaveLength(10);
      expect(result.hasMore).toBe(false);
    });

    it('includes realistic ticket fields', async () => {
      const result = await adapter.syncTickets({ mode: 'full' });
      const ticket = result.records[0];

      expect(ticket.id).toBeDefined();
      expect(ticket.subject).toBeDefined();
      expect(ticket.status).toBeDefined();
      expect(ticket.priority).toBeDefined();
      expect(ticket.category).toBeDefined();
      expect(ticket.customFields).toBeDefined();
    });
  });

  // ============================================
  // RATE LIMITING TESTS
  // ============================================

  describe('getRateLimitStatus', () => {
    it('returns mock rate limit info', async () => {
      const status = await adapter.getRateLimitStatus();

      expect(status.limit).toBe(100000);
      expect(status.remaining).toBe(95000);
      expect(status.resetAt).toBeDefined();
      expect(status.percentUsed).toBeCloseTo(0.05, 2);
    });
  });

  describe('checkQuotaRemaining', () => {
    it('returns true indicating quota available', async () => {
      const hasQuota = await adapter.checkQuotaRemaining();

      expect(hasQuota).toBe(true);
    });
  });

  // ============================================
  // WEBHOOK TESTS
  // ============================================

  describe('webhook support', () => {
    it('indicates webhook support', () => {
      const supported = adapter.supportsWebhooks();

      expect(supported).toBe(true);
    });

    it('registers a webhook successfully', async () => {
      const registration = await adapter.registerWebhook(
        'https://app.example.com/webhooks/mock',
        ['deal.created', 'deal.updated']
      );

      expect(registration.id).toBeDefined();
      expect(registration.url).toBe('https://app.example.com/webhooks/mock');
      expect(registration.events).toEqual(['deal.created', 'deal.updated']);
      expect(registration.secret).toBeDefined();
      expect(registration.createdAt).toBeDefined();
    });

    it('unregisters a webhook successfully', async () => {
      await expect(
        adapter.unregisterWebhook('webhook_123')
      ).resolves.toBeUndefined();
    });
  });
});
