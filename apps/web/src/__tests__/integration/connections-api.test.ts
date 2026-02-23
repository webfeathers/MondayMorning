import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Create mock functions
const mockGetSession = vi.fn();
const mockGetTenant = vi.fn();
const mockHasPermission = vi.fn();
const mockCreateTenantClient = vi.fn();
const mockCreateConnection = vi.fn();
const mockListConnections = vi.fn();
const mockGetConnection = vi.fn();
const mockTestConnection = vi.fn();
const mockDeleteConnection = vi.fn();

// Mock dependencies
vi.mock('@/lib/session', () => ({
  getSession: mockGetSession,
}));

vi.mock('@/lib/get-tenant', () => ({
  getTenant: mockGetTenant,
}));

vi.mock('@wf/auth', () => ({
  hasPermission: mockHasPermission,
}));

vi.mock('@wf/db', () => ({
  createTenantClient: mockCreateTenantClient,
}));

vi.mock('@wf/integrations', () => ({
  createConnection: mockCreateConnection,
  listConnections: mockListConnections,
  getConnection: mockGetConnection,
  testConnection: mockTestConnection,
  deleteConnection: mockDeleteConnection,
}));

// Import after mocks are set up
const { POST: createConnection, GET: listConnections } = await import('@/app/api/integrations/connections/route');
const { GET: getConnection, DELETE: deleteConnection } = await import('@/app/api/integrations/connections/[id]/route');
const { POST: testConnection } = await import('@/app/api/integrations/connections/[id]/test/route');

describe('Integration Connections API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockCreateTenantClient.mockReturnValue({
      db: {},
      tenantId: 'test-tenant-id',
    });

    mockGetSession.mockResolvedValue({
      sessionId: 'test-session-id',
      userId: 'test-user-id',
      tenantId: 'test-tenant-id',
      expiresAt: new Date(),
      lastActiveAt: new Date(),
    });

    mockGetTenant.mockResolvedValue({
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
    });

    mockHasPermission.mockResolvedValue(true);
  });

  describe('POST /api/integrations/connections', () => {
    it('should require authentication', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections', {
        method: 'POST',
        body: JSON.stringify({
          providerName: 'salesforce',
          credentials: { access_token: 'test-token' },
        }),
      });

      const response = await createConnection(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should require tenant context', async () => {
      mockGetTenant.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections', {
        method: 'POST',
        body: JSON.stringify({
          providerName: 'salesforce',
          credentials: { access_token: 'test-token' },
        }),
      });

      const response = await createConnection(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Tenant not found');
    });

    it('should check integrations:connect permission', async () => {
      mockHasPermission.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections', {
        method: 'POST',
        body: JSON.stringify({
          providerName: 'salesforce',
          credentials: { access_token: 'test-token' },
        }),
      });

      const response = await createConnection(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('integrations:connect');
      expect(mockHasPermission).toHaveBeenCalledWith(
        expect.anything(),
        'test-user-id',
        'test-tenant-id',
        'integrations:connect'
      );
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/integrations/connections', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await createConnection(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('providerName');
    });

    it('should create a connection successfully', async () => {
      mockCreateConnection.mockResolvedValue({
        id: 'connection-id',
        tenantId: 'test-tenant-id',
        providerName: 'salesforce',
        providerType: 'crm',
        credentials: { access_token: 'test-token' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/integrations/connections', {
        method: 'POST',
        body: JSON.stringify({
          providerName: 'salesforce',
          credentials: { access_token: 'test-token' },
        }),
      });

      const response = await createConnection(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('connection-id');
      expect(data.providerName).toBe('salesforce');
      expect(mockCreateConnection).toHaveBeenCalledWith(
        'test-tenant-id',
        'salesforce',
        { access_token: 'test-token' }
      );
    });
  });

  describe('GET /api/integrations/connections', () => {
    it('should require authentication', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections', {
        method: 'GET',
      });

      const response = await listConnections(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should list connections for the tenant', async () => {
      mockListConnections.mockResolvedValue([
        {
          id: 'connection-1',
          providerName: 'salesforce',
          providerType: 'crm',
          isActive: true,
          lastSyncedAt: new Date(),
        },
        {
          id: 'connection-2',
          providerName: 'hubspot',
          providerType: 'crm',
          isActive: true,
          lastSyncedAt: null,
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections', {
        method: 'GET',
      });

      const response = await listConnections(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connections).toHaveLength(2);
      expect(data.connections[0].id).toBe('connection-1');
      expect(mockListConnections).toHaveBeenCalledWith('test-tenant-id');
    });
  });

  describe('GET /api/integrations/connections/[id]', () => {
    it('should require authentication', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123', {
        method: 'GET',
      });

      const response = await getConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should return 404 if connection not found', async () => {
      mockGetConnection.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123', {
        method: 'GET',
      });

      const response = await getConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return connection details', async () => {
      mockGetConnection.mockResolvedValue({
        id: 'conn-123',
        tenantId: 'test-tenant-id',
        providerName: 'salesforce',
        providerType: 'crm',
        credentials: { access_token: 'test-token' },
        isActive: true,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123', {
        method: 'GET',
      });

      const response = await getConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('conn-123');
      expect(data.providerName).toBe('salesforce');
    });
  });

  describe('POST /api/integrations/connections/[id]/test', () => {
    it('should require authentication', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123/test', {
        method: 'POST',
      });

      const response = await testConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should test connection health successfully', async () => {
      mockGetConnection.mockResolvedValue({
        id: 'conn-123',
        tenantId: 'test-tenant-id',
        providerName: 'salesforce',
      });
      mockTestConnection.mockResolvedValue({
        success: true,
      });

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123/test', {
        method: 'POST',
      });

      const response = await testConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockTestConnection).toHaveBeenCalledWith('conn-123');
    });

    it('should handle failed connection test', async () => {
      mockGetConnection.mockResolvedValue({
        id: 'conn-123',
        tenantId: 'test-tenant-id',
        providerName: 'salesforce',
      });
      mockTestConnection.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123/test', {
        method: 'POST',
      });

      const response = await testConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid credentials');
    });
  });

  describe('DELETE /api/integrations/connections/[id]', () => {
    it('should require authentication', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123', {
        method: 'DELETE',
      });

      const response = await deleteConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should check integrations:disconnect permission', async () => {
      mockHasPermission.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123', {
        method: 'DELETE',
      });

      const response = await deleteConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('integrations:disconnect');
    });

    it('should delete connection successfully', async () => {
      mockGetConnection.mockResolvedValue({
        id: 'conn-123',
        tenantId: 'test-tenant-id',
        providerName: 'salesforce',
      });
      mockDeleteConnection.mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123', {
        method: 'DELETE',
      });

      const response = await deleteConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDeleteConnection).toHaveBeenCalledWith('conn-123');
    });

    it('should handle delete failure', async () => {
      mockGetConnection.mockResolvedValue({
        id: 'conn-123',
        tenantId: 'test-tenant-id',
        providerName: 'salesforce',
      });
      mockDeleteConnection.mockResolvedValue({ success: false });

      const request = new NextRequest('http://localhost:3000/api/integrations/connections/conn-123', {
        method: 'DELETE',
      });

      const response = await deleteConnection(request, { params: { id: 'conn-123' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });
});
