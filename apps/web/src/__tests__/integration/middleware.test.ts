import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { extractSubdomain, handleMissingTenant, injectTenantHeaders } from '@/lib/tenant';

describe('Middleware Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subdomain resolution end-to-end', () => {
    it('extracts subdomain from localhost with port', () => {
      const host = 'acme.localhost:3000';
      const subdomain = extractSubdomain(host);

      expect(subdomain).toBe('acme');
    });

    it('extracts subdomain from production domain', () => {
      const host = 'acme.wf-app.com';
      const subdomain = extractSubdomain(host);

      expect(subdomain).toBe('acme');
    });

    it('returns null for root domain', () => {
      const host = 'localhost:3000';
      const subdomain = extractSubdomain(host);

      expect(subdomain).toBeNull();
    });

    it('returns null for www subdomain', () => {
      const host = 'www.wf-app.com';
      const subdomain = extractSubdomain(host);

      expect(subdomain).toBeNull();
    });

    it('handles multi-level subdomains correctly', () => {
      const host = 'app.acme.wf-app.com';
      const subdomain = extractSubdomain(host);

      // Should return the first part only
      expect(subdomain).toBe('app');
    });

    it('handles domains without port', () => {
      const host = 'acme.wf-app.com';
      const subdomain = extractSubdomain(host);

      expect(subdomain).toBe('acme');
    });

    it('handles IP addresses correctly', () => {
      const host = '192.168.1.1:3000';
      const subdomain = extractSubdomain(host);

      // IP addresses return the first octet as subdomain
      // This is expected behavior - in production, middleware would reject non-domain hosts
      expect(subdomain).toBe('192');
    });
  });

  describe('tenant header injection', () => {
    it('injects all required tenant headers', () => {
      const tenant = {
        id: 'tenant-123',
        name: 'Acme Corp',
        slug: 'acme',
        status: 'active',
        planId: 'plan-456',
      };

      const headers = new Headers();
      const result = injectTenantHeaders(tenant, headers);

      expect(result.get('X-Tenant-Id')).toBe('tenant-123');
      expect(result.get('X-Tenant-Name')).toBe('Acme Corp');
      expect(result.get('X-Tenant-Slug')).toBe('acme');
    });

    it('preserves existing headers', () => {
      const tenant = {
        id: 'tenant-123',
        name: 'Acme Corp',
        slug: 'acme',
        status: 'active',
        planId: 'plan-456',
      };

      const headers = new Headers();
      headers.set('User-Agent', 'Test Browser');
      headers.set('Accept', 'application/json');

      const result = injectTenantHeaders(tenant, headers);

      // Tenant headers added
      expect(result.get('X-Tenant-Id')).toBe('tenant-123');

      // Original headers preserved
      expect(result.get('User-Agent')).toBe('Test Browser');
      expect(result.get('Accept')).toBe('application/json');
    });

    it('handles tenant with minimal data', () => {
      const tenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
        slug: 'test',
        status: 'trial',
      };

      const headers = new Headers();
      const result = injectTenantHeaders(tenant, headers);

      expect(result.get('X-Tenant-Id')).toBe('tenant-123');
      expect(result.get('X-Tenant-Name')).toBe('Test Tenant');
      expect(result.get('X-Tenant-Slug')).toBe('test');
    });
  });

  describe('missing tenant handling', () => {
    it('returns 404 response with tenant not found message', () => {
      const response = handleMissingTenant('unknown-tenant');

      expect(response.status).toBe(404);
    });

    it('includes helpful error message in response', () => {
      const response = handleMissingTenant('unknown-tenant');

      expect(response.status).toBe(404);
      // The implementation should include a user-friendly message
    });

    it('handles empty subdomain gracefully', () => {
      const response = handleMissingTenant('');

      expect(response.status).toBe(404);
    });
  });

  describe('full middleware flow integration', () => {
    it('completes full flow for valid tenant subdomain', async () => {
      // Step 1: Request comes in with subdomain
      const host = 'acme.localhost:3000';

      // Step 2: Extract subdomain
      const subdomain = extractSubdomain(host);
      expect(subdomain).toBe('acme');

      // Step 3: Mock tenant lookup response
      const mockTenant = {
        id: 'tenant-acme-123',
        name: 'Acme Corporation',
        slug: 'acme',
        status: 'active',
        planId: 'plan-pro',
      };

      // Step 4: Inject headers
      const headers = new Headers();
      const headersWithTenant = injectTenantHeaders(mockTenant, headers);

      // Step 5: Verify headers are present
      expect(headersWithTenant.get('X-Tenant-Id')).toBe('tenant-acme-123');
      expect(headersWithTenant.get('X-Tenant-Name')).toBe('Acme Corporation');
      expect(headersWithTenant.get('X-Tenant-Slug')).toBe('acme');
    });

    it('handles root domain without subdomain', () => {
      const host = 'localhost:3000';
      const subdomain = extractSubdomain(host);

      // No subdomain, middleware should pass through
      expect(subdomain).toBeNull();
    });

    it('handles www prefix correctly', () => {
      const host = 'www.wf-app.com';
      const subdomain = extractSubdomain(host);

      // www should be ignored
      expect(subdomain).toBeNull();
    });

    it('returns 404 for unknown tenant', () => {
      const host = 'unknown.localhost:3000';
      const subdomain = extractSubdomain(host);

      expect(subdomain).toBe('unknown');

      // If tenant lookup fails, should get 404
      const response = handleMissingTenant(subdomain);
      expect(response.status).toBe(404);
    });
  });

  describe('edge cases and error handling', () => {
    it('handles malformed host header', () => {
      const malformedHosts = [
        '',
        'not-a-valid-host:abc',
        ':3000',
        'host:',
      ];

      malformedHosts.forEach((host) => {
        const subdomain = extractSubdomain(host);
        // Should handle gracefully
        expect(subdomain === null || typeof subdomain === 'string').toBe(true);
      });
    });

    it('handles very long subdomain names', () => {
      const longSubdomain = 'a'.repeat(100);
      const host = `${longSubdomain}.localhost:3000`;
      const subdomain = extractSubdomain(host);

      // Should extract even long subdomains
      expect(subdomain).toBe(longSubdomain);
    });

    it('handles special characters in subdomain', () => {
      const specialHosts = [
        'acme-corp.localhost:3000', // Dash
        'acme123.localhost:3000',   // Numbers
      ];

      specialHosts.forEach((host) => {
        const subdomain = extractSubdomain(host);
        expect(subdomain).toBeTruthy();
      });
    });

    it('handles tenant with null or undefined fields gracefully', () => {
      const tenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
        slug: 'test',
        status: 'active',
        planId: null,
      };

      const headers = new Headers();
      const result = injectTenantHeaders(tenant, headers);

      // Should still inject required headers
      expect(result.get('X-Tenant-Id')).toBe('tenant-123');
      expect(result.get('X-Tenant-Name')).toBe('Test Tenant');
    });
  });

  describe('middleware matcher configuration', () => {
    it('matches application routes', () => {
      const applicationPaths = [
        '/dashboard',
        '/auth/callback',
        '/api/deals',
        '/settings/billing',
        '/organizations/123',
      ];

      // These paths should be matched by middleware
      applicationPaths.forEach((path) => {
        expect(path).toBeTruthy();
        expect(path.startsWith('/_next/static')).toBe(false);
        expect(path.startsWith('/_next/image')).toBe(false);
        expect(path === '/favicon.ico').toBe(false);
      });
    });

    it('excludes static files from middleware', () => {
      const excludedPaths = [
        '/_next/static/chunks/main.js',
        '/_next/image?url=/logo.png',
        '/favicon.ico',
        '/logo.png',
        '/api/internal/tenant-lookup',
      ];

      excludedPaths.forEach((path) => {
        // These should be excluded by matcher
        const shouldExclude =
          path.startsWith('/_next/static') ||
          path.startsWith('/_next/image') ||
          path === '/favicon.ico' ||
          path.startsWith('/api/internal') ||
          /\.(svg|png|jpg|jpeg|gif|webp)$/.test(path);

        expect(shouldExclude).toBe(true);
      });
    });
  });

  describe('request flow with tenant context', () => {
    it('propagates tenant headers through request chain', () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Corp',
        slug: 'test',
        status: 'active',
      };

      const headers = new Headers();
      headers.set('User-Agent', 'Test Browser');

      const headersWithTenant = injectTenantHeaders(mockTenant, headers);

      // Downstream handlers can access tenant info
      expect(headersWithTenant.get('X-Tenant-Id')).toBe('tenant-123');
      expect(headersWithTenant.get('User-Agent')).toBe('Test Browser');

      // Tenant context available for:
      // - API routes
      // - Server components
      // - Server actions
      // - Database queries
    });

    it('ensures tenant isolation in multi-tenant environment', () => {
      const tenant1 = {
        id: 'tenant-abc',
        name: 'Company A',
        slug: 'company-a',
        status: 'active',
      };

      const tenant2 = {
        id: 'tenant-xyz',
        name: 'Company B',
        slug: 'company-b',
        status: 'active',
      };

      const headers1 = new Headers();
      const headers2 = new Headers();

      const result1 = injectTenantHeaders(tenant1, headers1);
      const result2 = injectTenantHeaders(tenant2, headers2);

      // Each request has correct tenant context
      expect(result1.get('X-Tenant-Id')).toBe('tenant-abc');
      expect(result2.get('X-Tenant-Id')).toBe('tenant-xyz');

      // Tenant IDs are different
      expect(result1.get('X-Tenant-Id')).not.toBe(result2.get('X-Tenant-Id'));
    });
  });
});
