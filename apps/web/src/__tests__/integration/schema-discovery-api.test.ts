/**
 * Integration tests for schema discovery API
 *
 * Tests the API routes that:
 * - Discover objects from connected CRM
 * - Discover fields for a specific object
 * - Propose field mappings based on fuzzy matching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Create a mock CRM adapter
class MockCRMAdapter {
  async discoverObjects() {
    return [
      { name: 'Account', label: 'Accounts', syncable: true },
      { name: 'Contact', label: 'Contacts', syncable: true },
      { name: 'Deal', label: 'Deals', syncable: true },
    ];
  }

  async discoverFields(objectType: string) {
    if (objectType === 'Deal') {
      return [
        { name: 'Id', label: 'Deal ID', type: 'id', required: true, custom: false },
        { name: 'Name', label: 'Deal Name', type: 'string', required: true, custom: false },
        { name: 'Amount', label: 'Amount', type: 'currency', required: false, custom: false },
        { name: 'Stage', label: 'Stage', type: 'picklist', required: true, custom: false },
        { name: 'CloseDate', label: 'Close Date', type: 'date', required: true, custom: false },
        { name: 'Account_Name__c', label: 'Account Name', type: 'string', required: false, custom: true },
        { name: 'Owner_Id__c', label: 'Owner ID', type: 'reference', required: false, custom: true },
      ];
    }
    return [];
  }
}

// Mock the integrations package
vi.mock('@wf/integrations', () => ({
  getProvider: vi.fn(() => new MockCRMAdapter()),
  MockCRMAdapter,
}));

// Mock the database
vi.mock('@wf/db', () => ({
  db: {
    query: {
      integrationConnections: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'conn-123',
          tenantId: 'tenant-123',
          providerName: 'mock',
          credentials: {},
        }),
      },
    },
  },
  integrationConnections: {}, // Mock the schema export
}));

// Mock the auth package
vi.mock('@wf/auth', () => ({
  hasPermission: vi.fn().mockResolvedValue(true), // Default to allow
}));

describe('Schema Discovery API', () => {
  const mockConnectionId = 'conn-123';
  const mockUserId = 'user-123';
  const mockTenantId = 'tenant-123';

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default permission to allow
    const { hasPermission } = await import('@wf/auth');
    vi.mocked(hasPermission).mockResolvedValue(true);
  });

  describe('GET /api/integrations/connections/[id]/discover/objects', () => {
    it('returns list of available objects from CRM', async () => {
      // This test will fail until we implement the route
      const { GET } = await import(
        '@/app/api/integrations/connections/[id]/discover/objects/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/discover/objects`
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await GET(request, { params: { id: mockConnectionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('objects');
      expect(Array.isArray(data.objects)).toBe(true);
      expect(data.objects.length).toBeGreaterThan(0);
      expect(data.objects[0]).toHaveProperty('name');
      expect(data.objects[0]).toHaveProperty('label');
      expect(data.objects[0]).toHaveProperty('syncable');
    });

    it('requires integrations:view permission', async () => {
      // Mock permission denied
      const { hasPermission } = await import('@wf/auth');
      vi.mocked(hasPermission).mockResolvedValue(false);

      const { GET } = await import(
        '@/app/api/integrations/connections/[id]/discover/objects/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/discover/objects`
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await GET(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/integrations/connections/[id]/discover/fields', () => {
    it('returns field list for specified object', async () => {
      const { GET } = await import(
        '@/app/api/integrations/connections/[id]/discover/fields/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/discover/fields?object=Deal`
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await GET(request, { params: { id: mockConnectionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('fields');
      expect(Array.isArray(data.fields)).toBe(true);
      expect(data.fields.length).toBeGreaterThan(0);
      expect(data.fields[0]).toHaveProperty('name');
      expect(data.fields[0]).toHaveProperty('type');
    });

    it('requires object query parameter', async () => {
      const { GET } = await import(
        '@/app/api/integrations/connections/[id]/discover/fields/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/discover/fields`
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await GET(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('object');
    });

    it('requires integrations:view permission', async () => {
      // Mock permission denied
      const { hasPermission } = await import('@wf/auth');
      vi.mocked(hasPermission).mockResolvedValue(false);

      const { GET } = await import(
        '@/app/api/integrations/connections/[id]/discover/fields/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/discover/fields?object=Deal`
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await GET(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/integrations/connections/[id]/discover/propose-mappings', () => {
    it('generates suggested field mappings', async () => {
      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/discover/propose-mappings/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/discover/propose-mappings`,
        {
          method: 'POST',
          body: JSON.stringify({ objectType: 'Deal' }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await POST(request, { params: { id: mockConnectionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('proposedMappings');
      expect(Array.isArray(data.proposedMappings)).toBe(true);

      // Check that mappings have the expected structure
      if (data.proposedMappings.length > 0) {
        const mapping = data.proposedMappings[0];
        expect(mapping).toHaveProperty('sourceField');
        expect(mapping).toHaveProperty('targetField');
        expect(mapping).toHaveProperty('confidence');
      }
    });

    it('requires objectType in request body', async () => {
      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/discover/propose-mappings/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/discover/propose-mappings`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await POST(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('objectType');
    });

    it('requires integrations:view permission', async () => {
      // Mock permission denied
      const { hasPermission } = await import('@wf/auth');
      vi.mocked(hasPermission).mockResolvedValue(false);

      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/discover/propose-mappings/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/discover/propose-mappings`,
        {
          method: 'POST',
          body: JSON.stringify({ objectType: 'Deal' }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await POST(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(403);
    });
  });
});
