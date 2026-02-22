import { headers } from 'next/headers';

/**
 * Tenant data shape
 * This matches the headers set by middleware
 */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
}

/**
 * Get tenant from request headers in Server Components and API routes
 *
 * The middleware injects tenant information into headers:
 * - X-Tenant-Id
 * - X-Tenant-Slug
 * - X-Tenant-Name
 *
 * This function reads those headers and returns the tenant object.
 *
 * @returns Tenant object if headers are present, null otherwise
 *
 * Usage in Server Components:
 * ```tsx
 * import { getTenant } from '@/lib/get-tenant';
 *
 * export default async function ServerPage() {
 *   const tenant = await getTenant();
 *
 *   if (!tenant) {
 *     return <div>No tenant context</div>;
 *   }
 *
 *   return <div>Welcome to {tenant.name}!</div>;
 * }
 * ```
 *
 * Usage in API routes:
 * ```tsx
 * import { getTenant } from '@/lib/get-tenant';
 *
 * export async function GET(request: Request) {
 *   const tenant = await getTenant();
 *
 *   if (!tenant) {
 *     return Response.json({ error: 'No tenant' }, { status: 400 });
 *   }
 *
 *   // Use tenant.id for tenant-scoped queries
 *   return Response.json({ tenant });
 * }
 * ```
 */
export async function getTenant(): Promise<Tenant | null> {
  const headersList = await headers();

  const id = headersList.get('X-Tenant-Id');
  const slug = headersList.get('X-Tenant-Slug');
  const name = headersList.get('X-Tenant-Name');

  // All three headers must be present
  if (!id || !slug || !name) {
    return null;
  }

  return { id, slug, name };
}

/**
 * Get tenant from request headers, throwing if not present
 * Use this when tenant is required and you want to fail fast
 *
 * @throws Error if tenant headers are not present
 *
 * Usage:
 * ```tsx
 * import { requireTenant } from '@/lib/get-tenant';
 *
 * export async function GET() {
 *   const tenant = await requireTenant();
 *   // tenant is guaranteed to exist here
 *   return Response.json({ tenant });
 * }
 * ```
 */
export async function requireTenant(): Promise<Tenant> {
  const tenant = await getTenant();

  if (!tenant) {
    throw new Error('Tenant context is required but not found');
  }

  return tenant;
}
