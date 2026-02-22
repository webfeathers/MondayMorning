import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasPermission, getUserPermissions, checkPermission } from '../permissions';
import type { DB } from '@wf/db';

// Helper to create mock query chain
function createMockQueryChain(result: any) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve(result)),
  };
  return chain;
}

describe('Permission System', () => {
  let mockDb: DB;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {} as DB;
  });

  describe('hasPermission', () => {
    it('returns true when user has permission via role', async () => {
      // Mock tenant_members query returns role
      const mockTenantMember = {
        role: 'admin',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      // Mock permissions query returns permission with required role
      const mockPermission = {
        resource: 'settings',
        action: 'update',
        requiredRole: 'admin',
      };

      // Create query chains
      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain([mockPermission]);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain) // First call: tenant_members
        .mockReturnValueOnce(permissionChain); // Second call: permissions

      const result = await hasPermission(mockDb, 'user-1', 'tenant-1', 'settings:update');
      expect(result).toBe(true);
    });

    it('returns false when user does not have permission', async () => {
      // User is member, permission requires admin
      const mockTenantMember = {
        role: 'member',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const mockPermission = {
        resource: 'settings',
        action: 'update',
        requiredRole: 'admin',
      };

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain([mockPermission]);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      const result = await hasPermission(mockDb, 'user-1', 'tenant-1', 'settings:update');
      expect(result).toBe(false);
    });

    it('returns true when owner has any permission', async () => {
      // Owner should have all permissions
      const mockTenantMember = {
        role: 'owner',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const mockPermission = {
        resource: 'billing',
        action: 'manage',
        requiredRole: 'owner',
      };

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain([mockPermission]);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      const result = await hasPermission(mockDb, 'user-1', 'tenant-1', 'billing:manage');
      expect(result).toBe(true);
    });

    it('returns false when user is not a tenant member', async () => {
      const memberChain = createMockQueryChain([]);

      mockDb.select = vi.fn().mockReturnValueOnce(memberChain);

      const result = await hasPermission(mockDb, 'user-1', 'tenant-1', 'settings:update');
      expect(result).toBe(false);
    });

    it('returns false when permission does not exist', async () => {
      const mockTenantMember = {
        role: 'admin',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain([]);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      const result = await hasPermission(mockDb, 'user-1', 'tenant-1', 'nonexistent:action');
      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('returns all permissions for user role', async () => {
      const mockTenantMember = {
        role: 'member',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const mockPermissions = [
        { resource: 'dashboard', action: 'view', requiredRole: 'member' },
        { resource: 'deals', action: 'view', requiredRole: 'member' },
        { resource: 'deals', action: 'create', requiredRole: 'member' },
      ];

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain(mockPermissions);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      const result = await getUserPermissions(mockDb, 'user-1', 'tenant-1');
      expect(result).toEqual([
        'dashboard:view',
        'deals:view',
        'deals:create',
      ]);
    });

    it('returns all permissions when user is owner', async () => {
      const mockTenantMember = {
        role: 'owner',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const mockPermissions = [
        { resource: 'dashboard', action: 'view', requiredRole: 'member' },
        { resource: 'settings', action: 'update', requiredRole: 'admin' },
        { resource: 'billing', action: 'manage', requiredRole: 'owner' },
      ];

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain(mockPermissions);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      const result = await getUserPermissions(mockDb, 'user-1', 'tenant-1');
      // Owner gets all permissions
      expect(result).toEqual([
        'dashboard:view',
        'settings:update',
        'billing:manage',
      ]);
    });

    it('returns empty array when user is not a tenant member', async () => {
      const memberChain = createMockQueryChain([]);

      mockDb.select = vi.fn().mockReturnValueOnce(memberChain);

      const result = await getUserPermissions(mockDb, 'user-1', 'tenant-1');
      expect(result).toEqual([]);
    });
  });

  describe('checkPermission', () => {
    it('does not throw when user has permission', async () => {
      const mockTenantMember = {
        role: 'admin',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const mockPermission = {
        resource: 'settings',
        action: 'update',
        requiredRole: 'admin',
      };

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain([mockPermission]);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      await expect(
        checkPermission(mockDb, 'user-1', 'tenant-1', 'settings:update')
      ).resolves.not.toThrow();
    });

    it('throws error when user does not have permission', async () => {
      const mockTenantMember = {
        role: 'member',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const mockPermission = {
        resource: 'settings',
        action: 'update',
        requiredRole: 'admin',
      };

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain([mockPermission]);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      await expect(
        checkPermission(mockDb, 'user-1', 'tenant-1', 'settings:update')
      ).rejects.toThrow('Permission denied: settings:update');
    });
  });

  describe('Role Hierarchy', () => {
    it('admin has member permissions', async () => {
      const mockTenantMember = {
        role: 'admin',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const mockPermission = {
        resource: 'dashboard',
        action: 'view',
        requiredRole: 'member', // Admin should have this
      };

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain([mockPermission]);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      const result = await hasPermission(mockDb, 'user-1', 'tenant-1', 'dashboard:view');
      expect(result).toBe(true);
    });

    it('owner has admin permissions', async () => {
      const mockTenantMember = {
        role: 'owner',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const mockPermission = {
        resource: 'settings',
        action: 'update',
        requiredRole: 'admin', // Owner should have this
      };

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain([mockPermission]);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      const result = await hasPermission(mockDb, 'user-1', 'tenant-1', 'settings:update');
      expect(result).toBe(true);
    });

    it('member does not have admin permissions', async () => {
      const mockTenantMember = {
        role: 'member',
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const mockPermission = {
        resource: 'settings',
        action: 'update',
        requiredRole: 'admin',
      };

      const memberChain = createMockQueryChain([mockTenantMember]);
      const permissionChain = createMockQueryChain([mockPermission]);

      mockDb.select = vi.fn()
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(permissionChain);

      const result = await hasPermission(mockDb, 'user-1', 'tenant-1', 'settings:update');
      expect(result).toBe(false);
    });
  });
});
