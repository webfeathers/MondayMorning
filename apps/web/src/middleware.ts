import { NextRequest, NextResponse } from 'next/server';
import { extractSubdomain, handleMissingTenant, injectTenantHeaders } from './lib/tenant';
import { generateTraceId } from '@wf/observability';

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

  // Generate or extract trace ID for request tracking
  const traceId = request.headers.get('x-trace-id') || generateTraceId();

  if (!host) {
    const response = NextResponse.next();
    response.headers.set('x-trace-id', traceId);
    return response;
  }

  // Extract subdomain from host
  const subdomain = extractSubdomain(host);

  // If no subdomain, allow request (marketing site) but still inject trace ID
  if (!subdomain) {
    const response = NextResponse.next();
    response.headers.set('x-trace-id', traceId);
    return response;
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

    // Clone request headers and inject tenant info + trace ID
    const requestHeaders = new Headers(request.headers);
    const headersWithTenant = injectTenantHeaders(tenant, requestHeaders);
    headersWithTenant.set('x-trace-id', traceId);

    // Create response with updated headers
    const response = NextResponse.next({
      request: {
        headers: headersWithTenant,
      },
    });

    // Also set trace ID in response headers for client
    response.headers.set('x-trace-id', traceId);

    return response;
  } catch (error) {
    console.error('Error looking up tenant:', error);
    const response = handleMissingTenant(subdomain);
    response.headers.set('x-trace-id', traceId);
    return response;
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
