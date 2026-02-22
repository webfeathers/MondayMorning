import { NextRequest, NextResponse } from 'next/server';
import { createBaseClient } from '@wf/db';
import { lookupTenant } from '@/lib/tenant';

/**
 * Internal API route for tenant lookup
 * This runs in Node.js runtime (not Edge) so it can use the postgres client
 *
 * Called by middleware to resolve tenant from subdomain
 */
export async function GET(request: NextRequest) {
  // Verify this is an internal request from middleware
  const isInternal = request.headers.get('x-internal-request') === 'true';

  if (!isInternal) {
    return NextResponse.json(
      { error: 'This endpoint is for internal use only' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json(
      { error: 'Slug parameter is required' },
      { status: 400 }
    );
  }

  try {
    const { db } = createBaseClient();
    const tenant = await lookupTenant(slug, db);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error('Error in tenant lookup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
