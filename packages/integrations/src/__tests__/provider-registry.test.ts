/**
 * Tests for provider registry
 *
 * Verifies provider type mapping, adapter retrieval, dynamic registration,
 * provider listing, and error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProviderType,
  getAdapter,
  registerProvider,
  listProviders,
  getProviderMetadata,
} from '../core/provider-registry';
import { MockCRMAdapter } from '../adapters/mock-crm-adapter';

describe('Provider Registry', () => {
  describe('getProviderType', () => {
    it('maps Salesforce to CRM', () => {
      expect(getProviderType('salesforce')).toBe('crm');
    });

    it('maps HubSpot to CRM', () => {
      expect(getProviderType('hubspot')).toBe('crm');
    });

    it('maps Pipedrive to CRM', () => {
      expect(getProviderType('pipedrive')).toBe('crm');
    });

    it('maps Avoma to meeting', () => {
      expect(getProviderType('avoma')).toBe('meeting');
    });

    it('maps Zendesk to ticketing', () => {
      expect(getProviderType('zendesk')).toBe('ticketing');
    });

    it('maps ZoomInfo to enrichment', () => {
      expect(getProviderType('zoominfo')).toBe('enrichment');
    });

    it('is case-insensitive', () => {
      expect(getProviderType('SALESFORCE')).toBe('crm');
      expect(getProviderType('SalesForce')).toBe('crm');
    });

    it('throws error for unknown provider', () => {
      expect(() => getProviderType('unknown')).toThrow('Unknown provider: unknown');
    });
  });

  describe('getAdapter', () => {
    it('returns MockCRMAdapter instance for Salesforce', () => {
      const adapter = getAdapter('salesforce', { apiKey: 'test' });
      expect(adapter).toBeInstanceOf(MockCRMAdapter);
    });

    it('returns MockCRMAdapter instance for HubSpot', () => {
      const adapter = getAdapter('hubspot', { apiKey: 'test' });
      expect(adapter).toBeInstanceOf(MockCRMAdapter);
    });

    it('returns adapter with credentials', () => {
      const credentials = { apiKey: 'test-key', domain: 'test.com' };
      const adapter = getAdapter('salesforce', credentials);
      expect(adapter).toBeDefined();
    });

    it('throws error for non-CRM provider type', () => {
      expect(() => getAdapter('avoma', {})).toThrow(
        'No adapter available for provider type: meeting'
      );
    });

    it('throws error for unknown provider', () => {
      expect(() => getAdapter('unknown', {})).toThrow('Unknown provider: unknown');
    });
  });

  describe('registerProvider', () => {
    it('allows registering a new provider', () => {
      registerProvider('customcrm', 'crm', MockCRMAdapter);
      expect(getProviderType('customcrm')).toBe('crm');
    });

    it('allows getting adapter for registered provider', () => {
      registerProvider('customcrm2', 'crm', MockCRMAdapter);
      const adapter = getAdapter('customcrm2', {});
      expect(adapter).toBeInstanceOf(MockCRMAdapter);
    });

    it('allows overriding existing provider', () => {
      class CustomAdapter extends MockCRMAdapter {}
      // Use a test-specific provider to avoid affecting other tests
      registerProvider('testoverride', 'crm', MockCRMAdapter);
      registerProvider('testoverride', 'crm', CustomAdapter);
      const adapter = getAdapter('testoverride', {});
      expect(adapter).toBeInstanceOf(CustomAdapter);
    });

    it('validates provider type is non-empty', () => {
      expect(() => registerProvider('test', '', MockCRMAdapter)).toThrow(
        'Provider type cannot be empty'
      );
    });

    it('validates provider name is non-empty', () => {
      expect(() => registerProvider('', 'crm', MockCRMAdapter)).toThrow(
        'Provider name cannot be empty'
      );
    });
  });

  describe('listProviders', () => {
    it('returns all registered providers', () => {
      const providers = listProviders();
      expect(providers).toBeInstanceOf(Array);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('includes built-in CRM providers', () => {
      const providers = listProviders();
      const providerNames = providers.map((p) => p.name);
      expect(providerNames).toContain('salesforce');
      expect(providerNames).toContain('hubspot');
      expect(providerNames).toContain('pipedrive');
    });

    it('filters by provider type', () => {
      const crmProviders = listProviders('crm');
      expect(crmProviders.every((p) => p.type === 'crm')).toBe(true);
    });

    it('returns empty array for non-existent type', () => {
      const providers = listProviders('nonexistent');
      expect(providers).toEqual([]);
    });

    it('includes dynamically registered providers', () => {
      registerProvider('dynamictest', 'crm', MockCRMAdapter);
      const providers = listProviders();
      const providerNames = providers.map((p) => p.name);
      expect(providerNames).toContain('dynamictest');
    });
  });

  describe('getProviderMetadata', () => {
    it('returns metadata for Salesforce', () => {
      const metadata = getProviderMetadata('salesforce');
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('salesforce');
      expect(metadata.type).toBe('crm');
      expect(metadata.displayName).toBeDefined();
      expect(metadata.description).toBeDefined();
    });

    it('returns metadata with required credentials', () => {
      const metadata = getProviderMetadata('salesforce');
      expect(metadata.requiredCredentials).toBeInstanceOf(Array);
      expect(metadata.requiredCredentials.length).toBeGreaterThan(0);
    });

    it('returns metadata with capabilities', () => {
      const metadata = getProviderMetadata('salesforce');
      expect(typeof metadata.supportsWebhooks).toBe('boolean');
      expect(metadata.supportedObjects).toBeInstanceOf(Array);
    });

    it('throws error for unknown provider', () => {
      expect(() => getProviderMetadata('unknown')).toThrow(
        'Unknown provider: unknown'
      );
    });

    it('includes metadata for all provider types', () => {
      // CRM
      expect(getProviderMetadata('salesforce').type).toBe('crm');
      expect(getProviderMetadata('hubspot').type).toBe('crm');

      // Meeting
      expect(getProviderMetadata('avoma').type).toBe('meeting');

      // Ticketing
      expect(getProviderMetadata('zendesk').type).toBe('ticketing');

      // Enrichment
      expect(getProviderMetadata('zoominfo').type).toBe('enrichment');
    });
  });
});
