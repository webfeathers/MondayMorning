import { NextResponse } from 'next/server';

/**
 * Extract subdomain from Host header
 * Examples:
 * - "acme.localhost:3000" -> "acme"
 * - "acme.example.com" -> "acme"
 * - "localhost:3000" -> null
 * - "www.example.com" -> null
 */
export function extractSubdomain(host: string): string | null {
  if (!host) return null;

  // Remove port if present
  const hostname = host.split(':')[0];

  // Split by dots
  const parts = hostname.split('.');

  // Need at least 2 parts for a subdomain (subdomain.domain)
  if (parts.length < 2) return null;

  // Get the first part (potential subdomain)
  const subdomain = parts[0];

  // Filter out common non-tenant subdomains
  if (subdomain === 'www') return null;

  // For localhost environments (acme.localhost or acme.localhost:3000)
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    // If it's just "localhost" without subdomain
    if (parts.length === 1 || subdomain === 'localhost') return null;
    // Otherwise return the subdomain
    return subdomain;
  }

  // For regular domains (example.com, acme.example.com)
  // Base domain (2 parts): return null
  // Subdomain (3+ parts): return first part
  if (parts.length === 2) {
    return null;
  }

  return subdomain;
}

/**
 * Look up tenant by slug from database
 * Only returns active or trial tenants
 */
export async function lookupTenant(
  slug: string,
  db: any
): Promise<{ id: string; slug: string; name: string; status: string } | null> {
  try {
    const tenant = await db.query.tenants.findFirst({
      where: (t: any, { eq, and, or }: any) =>
        and(
          eq(t.slug, slug),
          or(eq(t.status, 'active'), eq(t.status, 'trial'))
        ),
    });

    return tenant || null;
  } catch (error) {
    console.error('Error looking up tenant:', error);
    return null;
  }
}

/**
 * Handle missing tenant scenario
 * Returns 404 response with helpful error message
 */
export function handleMissingTenant(subdomain: string): NextResponse {
  return NextResponse.json(
    {
      error: `Tenant not found: ${subdomain}`,
      message: 'The subdomain you are trying to access does not exist or is not active.',
      subdomain,
    },
    { status: 404 }
  );
}

/**
 * Inject tenant information into request headers
 * These headers will be available to the Next.js app and API routes
 */
export function injectTenantHeaders(
  tenant: { id: string; slug: string; name: string },
  requestHeaders: Headers
): Headers {
  const headers = new Headers(requestHeaders);

  headers.set('X-Tenant-Id', tenant.id);
  headers.set('X-Tenant-Slug', tenant.slug);
  headers.set('X-Tenant-Name', tenant.name);

  return headers;
}
