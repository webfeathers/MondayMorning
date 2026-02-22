import { NextRequest, NextResponse } from 'next/server';
import { extractSubdomain, handleMissingTenant, injectTenantHeaders } from './lib/tenant';

/**
 * Next.js Middleware for tenant resolution via subdomain
 *
 * Note: Edge Runtime Limitation
 * Next.js middleware runs in the Edge Runtime which doesn't support the postgres library.
 * We use a workaround: call an API route that runs in Node.js runtime to look up the tenant.
 * This adds a small latency cost but ensures compatibility.
 *
 * Flow:
 * 1. Extract subdomain from Host header
 * 2. If no subdomain: allow request (marketing site or root domain)
 * 3. Look up tenant by calling internal API route
 * 4. If tenant found: inject X-Tenant-* headers for downstream use
 * 5. If tenant not found: return 404 response
 *
 * Examples:
 * - acme.localhost:3000 -> Look up "acme" tenant -> Inject headers
 * - localhost:3000 -> No subdomain -> Pass through
 * - www.example.com -> Ignore www -> Pass through
 * - unknown.localhost:3000 -> Tenant not found -> 404
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get('host');

  if (!host) {
    return NextResponse.next();
  }

  // Extract subdomain from host
  const subdomain = extractSubdomain(host);

  // If no subdomain, allow request (marketing site)
  if (!subdomain) {
    return NextResponse.next();
  }

  // Look up tenant by calling internal API route
  // This runs in Node.js runtime which supports postgres
  const protocol = request.nextUrl.protocol;
  const lookupUrl = `${protocol}//${host}/api/internal/tenant-lookup?slug=${subdomain}`;

  try {
    const response = await fetch(lookupUrl, {
      method: 'GET',
      headers: {
        'x-internal-request': 'true', // Prevent infinite loops
      },
    });

    if (!response.ok) {
      return handleMissingTenant(subdomain);
    }

    const tenant = await response.json();

    // Clone request headers and inject tenant info
    const requestHeaders = new Headers(request.headers);
    const headersWithTenant = injectTenantHeaders(tenant, requestHeaders);

    // Continue to the app with tenant headers
    return NextResponse.next({
      request: {
        headers: headersWithTenant,
      },
    });
  } catch (error) {
    console.error('Error looking up tenant:', error);
    return handleMissingTenant(subdomain);
  }
}

/**
 * Middleware configuration
 * Match all routes except:
 * - _next/static (static files)
 * - _next/image (image optimization)
 * - favicon.ico (favicon)
 * - public files (images, etc.)
 * - api/internal (internal API routes)
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api/internal/* (internal API routes used by middleware)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/internal|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
