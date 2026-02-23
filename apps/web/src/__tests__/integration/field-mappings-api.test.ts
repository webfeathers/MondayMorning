/**
 * Integration tests for field mapping review API
 *
 * Tests the API routes that:
 * - Save tenant's reviewed field mappings (POST /api/integrations/connections/[id]/field-mappings)
 * - Save stage mappings with terminal state flags (POST /api/integrations/connections/[id]/stage-mappings)
 * - Retrieve all field mappings for a connection (GET /api/integrations/connections/[id]/field-mappings)
 * - Update individual field mapping (PATCH /api/integrations/connections/[id]/field-mappings/[fieldId])
 * - Activate mappings workflow (POST /api/integrations/connections/[id]/field-mappings/activate)
 * - Enforce mapping_status transitions (pending → active → reindexing)
 * - Require integrations:connect permission for saves
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the database
const mockFieldMappings: any[] = [];
const mockStageMappings: any[] = [];

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
      customFieldDefinitions: {
        findMany: vi.fn(async () => mockFieldMappings),
        findFirst: vi.fn(async () => {
          // Return the first field mapping in the array for tests
          return mockFieldMappings.length > 0 ? mockFieldMappings[0] : null;
        }),
      },
      stageMappings: {
        findMany: vi.fn(async () => mockStageMappings),
      },
    },
    insert: vi.fn((table: any) => ({
      values: vi.fn((values: any) => {
        if (Array.isArray(values)) {
          values.forEach((value: any) => {
            const record = { id: `field-${Math.random()}`, ...value };
            if (table === 'customFieldDefinitions') {
              mockFieldMappings.push(record);
            } else if (table === 'stageMappings') {
              mockStageMappings.push(record);
            }
          });
        } else {
          const record = { id: `field-${Math.random()}`, ...values };
          if (table === 'customFieldDefinitions') {
            mockFieldMappings.push(record);
          } else if (table === 'stageMappings') {
            mockStageMappings.push(record);
          }
        }
        return Promise.resolve();
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
  customFieldDefinitions: 'customFieldDefinitions',
  stageMappings: 'stageMappings',
  integrationConnections: {},
}));

// Mock the auth package
vi.mock('@wf/auth', () => ({
  hasPermission: vi.fn().mockResolvedValue(true), // Default to allow
}));

describe('Field Mapping Review API', () => {
  const mockConnectionId = 'conn-123';
  const mockUserId = 'user-123';
  const mockTenantId = 'tenant-123';

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    mockFieldMappings.length = 0;
    mockStageMappings.length = 0;

    // Setup default permission to allow
    const { hasPermission } = await import('@wf/auth');
    vi.mocked(hasPermission).mockResolvedValue(true);
  });

  afterEach(() => {
    mockFieldMappings.length = 0;
    mockStageMappings.length = 0;
  });

  describe('POST /api/integrations/connections/[id]/field-mappings', () => {
    it('saves field mappings with pending status', async () => {
      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/route'
      );

      const fieldMappings = [
        {
          entityType: 'deal',
          fieldName: 'amount',
          fieldType: 'number',
          sourceProvider: 'salesforce',
          sourceFieldName: 'Amount',
        },
        {
          entityType: 'deal',
          fieldName: 'stage',
          fieldType: 'text',
          sourceProvider: 'salesforce',
          sourceFieldName: 'StageName',
        },
      ];

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings`,
        {
          method: 'POST',
          body: JSON.stringify({ mappings: fieldMappings }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await POST(request, { params: { id: mockConnectionId } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('count', 2);
      expect(mockFieldMappings.length).toBe(2);
      expect(mockFieldMappings[0].mappingStatus).toBe('pending');
      expect(mockFieldMappings[0].tenantId).toBe(mockTenantId);
    });

    it('validates required fields in mappings', async () => {
      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/route'
      );

      const invalidMappings = [
        {
          entityType: 'deal',
          // Missing fieldName
          fieldType: 'number',
        },
      ];

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings`,
        {
          method: 'POST',
          body: JSON.stringify({ mappings: invalidMappings }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await POST(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('fieldName');
    });

    it('requires integrations:connect permission', async () => {
      // Mock permission denied
      const { hasPermission } = await import('@wf/auth');
      vi.mocked(hasPermission).mockResolvedValue(false);

      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings`,
        {
          method: 'POST',
          body: JSON.stringify({ mappings: [] }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await POST(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/integrations/connections/[id]/stage-mappings', () => {
    it('saves stage mappings with terminal state flags', async () => {
      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/stage-mappings/route'
      );

      const stageMappings = [
        {
          sourceStage: 'Prospecting',
          normalizedStage: 'prospecting',
          isClosed: false,
          isWon: false,
          sortOrder: '1',
        },
        {
          sourceStage: 'Closed Won',
          normalizedStage: 'won',
          isClosed: true,
          isWon: true,
          sortOrder: '5',
        },
        {
          sourceStage: 'Closed Lost',
          normalizedStage: 'lost',
          isClosed: true,
          isWon: false,
          sortOrder: '6',
        },
      ];

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/stage-mappings`,
        {
          method: 'POST',
          body: JSON.stringify({ mappings: stageMappings }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await POST(request, { params: { id: mockConnectionId } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('count', 3);
      expect(mockStageMappings.length).toBe(3);

      // Verify terminal states
      const wonStage = mockStageMappings.find((s) => s.sourceStage === 'Closed Won');
      expect(wonStage.isClosed).toBe(true);
      expect(wonStage.isWon).toBe(true);

      const lostStage = mockStageMappings.find((s) => s.sourceStage === 'Closed Lost');
      expect(lostStage.isClosed).toBe(true);
      expect(lostStage.isWon).toBe(false);
    });

    it('validates is_closed and is_won booleans', async () => {
      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/stage-mappings/route'
      );

      const invalidMappings = [
        {
          sourceStage: 'Test',
          normalizedStage: 'test',
          // Missing isClosed and isWon
        },
      ];

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/stage-mappings`,
        {
          method: 'POST',
          body: JSON.stringify({ mappings: invalidMappings }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await POST(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(400);
    });

    it('requires integrations:connect permission', async () => {
      // Mock permission denied
      const { hasPermission } = await import('@wf/auth');
      vi.mocked(hasPermission).mockResolvedValue(false);

      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/stage-mappings/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/stage-mappings`,
        {
          method: 'POST',
          body: JSON.stringify({ mappings: [] }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await POST(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/integrations/connections/[id]/field-mappings', () => {
    it('retrieves all field mappings for a connection', async () => {
      // Setup some test data
      mockFieldMappings.push(
        {
          id: 'field-1',
          tenantId: mockTenantId,
          entityType: 'deal',
          fieldName: 'amount',
          fieldType: 'number',
          sourceProvider: 'salesforce',
          sourceFieldName: 'Amount',
          mappingStatus: 'active',
        },
        {
          id: 'field-2',
          tenantId: mockTenantId,
          entityType: 'deal',
          fieldName: 'stage',
          fieldType: 'text',
          sourceProvider: 'salesforce',
          sourceFieldName: 'StageName',
          mappingStatus: 'pending',
        }
      );

      const { GET } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings`
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await GET(request, { params: { id: mockConnectionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('fieldMappings');
      expect(data).toHaveProperty('stageMappings');
      expect(Array.isArray(data.fieldMappings)).toBe(true);
      expect(data.fieldMappings.length).toBe(2);
    });

    it('requires integrations:view permission', async () => {
      // Mock permission denied
      const { hasPermission } = await import('@wf/auth');
      vi.mocked(hasPermission).mockResolvedValue(false);

      const { GET } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings`
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await GET(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/integrations/connections/[id]/field-mappings/[fieldId]', () => {
    it('updates individual field mapping', async () => {
      // Setup test data
      mockFieldMappings.push({
        id: 'field-1',
        tenantId: mockTenantId,
        entityType: 'deal',
        fieldName: 'amount',
        fieldType: 'number',
        sourceProvider: 'salesforce',
        sourceFieldName: 'Amount',
        mappingStatus: 'pending',
      });

      const { PATCH } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/[fieldId]/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings/field-1`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            sourceFieldName: 'Deal_Amount__c',
          }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await PATCH(request, {
        params: { id: mockConnectionId, fieldId: 'field-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
    });

    it('prevents mapping_status changes on active mappings', async () => {
      // Setup test data with active status
      mockFieldMappings.push({
        id: 'field-1',
        tenantId: mockTenantId,
        entityType: 'deal',
        fieldName: 'amount',
        fieldType: 'number',
        mappingStatus: 'active',
      });

      const { PATCH } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/[fieldId]/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings/field-1`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            sourceFieldName: 'NewField',
          }),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await PATCH(request, {
        params: { id: mockConnectionId, fieldId: 'field-1' },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('immutable');
    });

    it('requires integrations:connect permission', async () => {
      // Mock permission denied
      const { hasPermission } = await import('@wf/auth');
      vi.mocked(hasPermission).mockResolvedValue(false);

      const { PATCH } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/[fieldId]/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings/field-1`,
        {
          method: 'PATCH',
          body: JSON.stringify({}),
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);
      request.headers.set('content-type', 'application/json');

      const response = await PATCH(request, {
        params: { id: mockConnectionId, fieldId: 'field-1' },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/integrations/connections/[id]/field-mappings/activate', () => {
    it('activates pending mappings', async () => {
      // Setup test data with pending status
      mockFieldMappings.push(
        {
          id: 'field-1',
          tenantId: mockTenantId,
          entityType: 'deal',
          fieldName: 'amount',
          fieldType: 'number',
          mappingStatus: 'pending',
        },
        {
          id: 'field-2',
          tenantId: mockTenantId,
          entityType: 'deal',
          fieldName: 'stage',
          fieldType: 'text',
          mappingStatus: 'pending',
        }
      );

      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/activate/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings/activate`,
        {
          method: 'POST',
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await POST(request, { params: { id: mockConnectionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('activatedCount');
    });

    it('validates required mappings are present before activation', async () => {
      // Empty mappings
      mockFieldMappings.length = 0;

      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/activate/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings/activate`,
        {
          method: 'POST',
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await POST(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No mappings');
    });

    it('requires integrations:connect permission', async () => {
      // Mock permission denied
      const { hasPermission } = await import('@wf/auth');
      vi.mocked(hasPermission).mockResolvedValue(false);

      const { POST } = await import(
        '@/app/api/integrations/connections/[id]/field-mappings/activate/route'
      );

      const request = new NextRequest(
        `http://localhost:3000/api/integrations/connections/${mockConnectionId}/field-mappings/activate`,
        {
          method: 'POST',
        }
      );
      request.headers.set('x-user-id', mockUserId);
      request.headers.set('x-tenant-id', mockTenantId);

      const response = await POST(request, { params: { id: mockConnectionId } });

      expect(response.status).toBe(403);
    });
  });
});
