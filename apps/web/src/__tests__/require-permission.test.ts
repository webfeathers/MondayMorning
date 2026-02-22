import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  requirePermission,
  withPermission,
  PermissionDeniedError,
  requireAllPermissions,
  requireAnyPermission,
} from '@/lib/require-permission';
import * as auth from '@wf/auth';

// Mock the auth module
vi.mock('@wf/auth', () => ({
  hasPermission: vi.fn(),
}));

// Mock the db module
vi.mock('@wf/db', () => ({
  db: {},
}));

describe('Permission Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requirePermission', () => {
    it('throws PermissionDeniedError when user lacks permission', async () => {
      vi.mocked(auth.hasPermission).mockResolvedValue(false);

      await expect(
        requirePermission('user-1', 'tenant-1', 'settings:update')
      ).rejects.toThrow(PermissionDeniedError);

      await expect(
        requirePermission('user-1', 'tenant-1', 'settings:update')
      ).rejects.toThrow('Permission denied: settings:update');
    });

    it('does not throw when user has permission', async () => {
      vi.mocked(auth.hasPermission).mockResolvedValue(true);

      await expect(
        requirePermission('user-1', 'tenant-1', 'settings:update')
      ).resolves.not.toThrow();
    });

    it('calls hasPermission with correct arguments', async () => {
      vi.mocked(auth.hasPermission).mockResolvedValue(true);

      await requirePermission('user-1', 'tenant-1', 'settings:update');

      expect(auth.hasPermission).toHaveBeenCalledWith(
        expect.anything(), // db object
        'user-1',
        'tenant-1',
        'settings:update'
      );
    });
  });

  describe('withPermission', () => {
    it('returns 401 when userId header is missing', async () => {
      const request = new NextRequest('http://localhost/api/settings');
      request.headers.set('x-tenant-id', 'tenant-1');

      const handler = vi.fn();
      const wrappedHandler = withPermission('settings:view', handler);

      const response = await wrappedHandler(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns 401 when tenantId header is missing', async () => {
      const request = new NextRequest('http://localhost/api/settings');
      request.headers.set('x-user-id', 'user-1');

      const handler = vi.fn();
      const wrappedHandler = withPermission('settings:view', handler);

      const response = await wrappedHandler(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns 403 when user lacks permission', async () => {
      vi.mocked(auth.hasPermission).mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/settings');
      request.headers.set('x-user-id', 'user-1');
      request.headers.set('x-tenant-id', 'tenant-1');

      const handler = vi.fn();
      const wrappedHandler = withPermission('settings:update', handler);

      const response = await wrappedHandler(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Permission denied: settings:update');
      expect(handler).not.toHaveBeenCalled();
    });

    it('calls handler when user has permission', async () => {
      vi.mocked(auth.hasPermission).mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/settings');
      request.headers.set('x-user-id', 'user-1');
      request.headers.set('x-tenant-id', 'tenant-1');

      const mockResponse = { success: true };
      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const wrappedHandler = withPermission('settings:view', handler);

      const response = await wrappedHandler(request, { params: {} });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResponse);
      expect(handler).toHaveBeenCalledWith(request, {
        params: {},
        userId: 'user-1',
        tenantId: 'tenant-1',
      });
    });

    it('passes route params to handler', async () => {
      vi.mocked(auth.hasPermission).mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/deals/123');
      request.headers.set('x-user-id', 'user-1');
      request.headers.set('x-tenant-id', 'tenant-1');

      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const wrappedHandler = withPermission('deals:view', handler);

      await wrappedHandler(request, { params: { id: '123' } });

      expect(handler).toHaveBeenCalledWith(request, {
        params: { id: '123' },
        userId: 'user-1',
        tenantId: 'tenant-1',
      });
    });
  });

  describe('requireAllPermissions', () => {
    it('succeeds when user has all permissions', async () => {
      vi.mocked(auth.hasPermission).mockResolvedValue(true);

      await expect(
        requireAllPermissions('user-1', 'tenant-1', [
          'settings:view',
          'settings:update',
        ])
      ).resolves.not.toThrow();
    });

    it('throws when user lacks any permission', async () => {
      vi.mocked(auth.hasPermission)
        .mockResolvedValueOnce(true) // Has first permission
        .mockResolvedValueOnce(false); // Lacks second permission

      await expect(
        requireAllPermissions('user-1', 'tenant-1', [
          'settings:view',
          'settings:update',
        ])
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('requireAnyPermission', () => {
    it('succeeds when user has at least one permission', async () => {
      vi.mocked(auth.hasPermission)
        .mockResolvedValueOnce(false) // Lacks first permission
        .mockResolvedValueOnce(true); // Has second permission

      await expect(
        requireAnyPermission('user-1', 'tenant-1', [
          'settings:view',
          'billing:view',
        ])
      ).resolves.not.toThrow();
    });

    it('throws when user has none of the permissions', async () => {
      vi.mocked(auth.hasPermission).mockResolvedValue(false);

      await expect(
        requireAnyPermission('user-1', 'tenant-1', [
          'settings:view',
          'billing:view',
        ])
      ).rejects.toThrow(PermissionDeniedError);
    });
  });
});
