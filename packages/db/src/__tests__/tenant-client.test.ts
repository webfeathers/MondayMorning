import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTenantClient } from '../tenant-client';

describe('Tenant Client', () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    // Set a mock DATABASE_URL for tests
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it('requires a tenant ID', () => {
    expect(() => createTenantClient('')).toThrow('tenant ID is required');
  });

  it('exposes tenant ID on the client', () => {
    const client = createTenantClient('test-tenant-id');
    expect(client.tenantId).toBe('test-tenant-id');
  });

  it('has withTenantContext method', () => {
    const client = createTenantClient('test-tenant-id');
    expect(client.withTenantContext).toBeDefined();
    expect(typeof client.withTenantContext).toBe('function');
  });
});
