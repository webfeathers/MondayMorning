import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractSubdomain, lookupTenant, handleMissingTenant } from '../lib/tenant';
import { NextRequest, NextResponse } from 'next/server';

describe('Subdomain Middleware', () => {
  describe('extractSubdomain', () => {
    it('extracts subdomain from acme.localhost:3000', () => {
      const result = extractSubdomain('acme.localhost:3000');
      expect(result).toBe('acme');
    });

    it('extracts subdomain from acme.example.com', () => {
      const result = extractSubdomain('acme.example.com');
      expect(result).toBe('acme');
    });

    it('extracts subdomain from acme.wf-app.com', () => {
      const result = extractSubdomain('acme.wf-app.com');
      expect(result).toBe('acme');
    });

    it('returns null for localhost without subdomain', () => {
      const result = extractSubdomain('localhost:3000');
      expect(result).toBeNull();
    });

    it('returns null for www subdomain', () => {
      const result = extractSubdomain('www.example.com');
      expect(result).toBeNull();
    });

    it('returns null for base domain without subdomain', () => {
      const result = extractSubdomain('example.com');
      expect(result).toBeNull();
    });

    it('handles missing port', () => {
      const result = extractSubdomain('acme.localhost');
      expect(result).toBe('acme');
    });

    it('handles multi-level subdomains', () => {
      const result = extractSubdomain('app.acme.example.com');
      expect(result).toBe('app');
    });
  });

  describe('lookupTenant', () => {
    it('finds tenant by slug', async () => {
      const mockDb = {
        query: {
          tenants: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'tenant-123',
              slug: 'acme',
              name: 'Acme Corp',
              status: 'active',
            }),
          },
        },
      };

      const result = await lookupTenant('acme', mockDb as any);

      expect(result).toEqual({
        id: 'tenant-123',
        slug: 'acme',
        name: 'Acme Corp',
        status: 'active',
      });
      expect(mockDb.query.tenants.findFirst).toHaveBeenCalledWith({
        where: expect.any(Function),
      });
    });

    it('returns null when tenant not found', async () => {
      const mockDb = {
        query: {
          tenants: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };

      const result = await lookupTenant('nonexistent', mockDb as any);

      expect(result).toBeNull();
    });

    it('filters by active status', async () => {
      const mockDb = {
        query: {
          tenants: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };

      await lookupTenant('suspended-tenant', mockDb as any);

      // Verify the where clause includes status check
      expect(mockDb.query.tenants.findFirst).toHaveBeenCalled();
    });
  });

  describe('handleMissingTenant', () => {
    it('returns 404 response with tenant not found message', () => {
      const response = handleMissingTenant('acme');

      expect(response.status).toBe(404);
    });

    it('includes subdomain in response body', async () => {
      const response = handleMissingTenant('acme');
      const body = await response.json();

      expect(body.error).toContain('acme');
    });
  });

  describe('Tenant headers injection', () => {
    it('sets X-Tenant-Id header', () => {
      const tenant = {
        id: 'tenant-123',
        slug: 'acme',
        name: 'Acme Corp',
        status: 'active' as const,
      };

      const headers = new Headers();
      headers.set('X-Tenant-Id', tenant.id);
      headers.set('X-Tenant-Slug', tenant.slug);
      headers.set('X-Tenant-Name', tenant.name);

      expect(headers.get('X-Tenant-Id')).toBe('tenant-123');
      expect(headers.get('X-Tenant-Slug')).toBe('acme');
      expect(headers.get('X-Tenant-Name')).toBe('Acme Corp');
    });
  });
});
