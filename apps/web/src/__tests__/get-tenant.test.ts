import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTenant, requireTenant } from '../lib/get-tenant';

// Mock the next/headers module
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

describe('getTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns tenant when all headers are present', async () => {
    const mockHeaders = new Map([
      ['X-Tenant-Id', 'tenant-123'],
      ['X-Tenant-Slug', 'acme'],
      ['X-Tenant-Name', 'Acme Corp'],
    ]);

    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => mockHeaders.get(key) || null,
    } as any);

    const tenant = await getTenant();

    expect(tenant).toEqual({
      id: 'tenant-123',
      slug: 'acme',
      name: 'Acme Corp',
    });
  });

  it('returns null when tenant headers are missing', async () => {
    const mockHeaders = new Map();

    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => mockHeaders.get(key) || null,
    } as any);

    const tenant = await getTenant();

    expect(tenant).toBeNull();
  });

  it('returns null when only some headers are present', async () => {
    const mockHeaders = new Map([
      ['X-Tenant-Id', 'tenant-123'],
      // Missing slug and name
    ]);

    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => mockHeaders.get(key) || null,
    } as any);

    const tenant = await getTenant();

    expect(tenant).toBeNull();
  });
});

describe('requireTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns tenant when headers are present', async () => {
    const mockHeaders = new Map([
      ['X-Tenant-Id', 'tenant-456'],
      ['X-Tenant-Slug', 'wondercorp'],
      ['X-Tenant-Name', 'Wonder Corp'],
    ]);

    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => mockHeaders.get(key) || null,
    } as any);

    const tenant = await requireTenant();

    expect(tenant).toEqual({
      id: 'tenant-456',
      slug: 'wondercorp',
      name: 'Wonder Corp',
    });
  });

  it('throws error when tenant headers are missing', async () => {
    const mockHeaders = new Map();

    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => mockHeaders.get(key) || null,
    } as any);

    await expect(requireTenant()).rejects.toThrow(
      'Tenant context is required but not found'
    );
  });
});
