import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@wf/auth';
import { db } from '@wf/db';

/**
 * Permission check error - thrown when user lacks required permission
 */
export class PermissionDeniedError extends Error {
  constructor(permission: string) {
    super(`Permission denied: ${permission}`);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Server-side permission check for API routes and Server Components
 *
 * Checks if the current user has the required permission in their tenant.
 * Throws PermissionDeniedError if permission is denied.
 *
 * @param userId - The user's ID
 * @param tenantId - The tenant's ID
 * @param permission - Permission string in format "resource:action" (e.g., "settings:update")
 * @throws PermissionDeniedError if user doesn't have permission
 *
 * @example
 * // In an API route
 * export async function POST(request: Request) {
 *   const session = await getSession(request);
 *   await requirePermission(session.userId, session.tenantId, 'settings:update');
 *   // ... rest of route logic
 * }
 *
 * @example
 * // In a Server Component
 * export default async function SettingsPage() {
 *   const session = await getSession();
 *   await requirePermission(session.userId, session.tenantId, 'settings:view');
 *   // ... rest of component
 * }
 */
export async function requirePermission(
  userId: string,
  tenantId: string,
  permission: string
): Promise<void> {
  const hasAccess = await hasPermission(db, userId, tenantId, permission);

  if (!hasAccess) {
    throw new PermissionDeniedError(permission);
  }
}

/**
 * API route wrapper that checks permissions before executing handler
 *
 * This is a higher-order function that wraps API route handlers with permission checks.
 * If permission is denied, returns a 403 Forbidden response.
 *
 * @param permission - Permission string in format "resource:action"
 * @param handler - The API route handler function
 * @returns Wrapped handler function
 *
 * @example
 * export const POST = withPermission('settings:update', async (request, context) => {
 *   // User is guaranteed to have 'settings:update' permission here
 *   // ... rest of route logic
 *   return NextResponse.json({ success: true });
 * });
 */
export function withPermission(
  permission: string,
  handler: (
    request: NextRequest,
    context: { params: any; userId: string; tenantId: string }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext: { params: any }) => {
    try {
      // Extract user and tenant from request headers (set by middleware)
      const userId = request.headers.get('x-user-id');
      const tenantId = request.headers.get('x-tenant-id');

      if (!userId || !tenantId) {
        return NextResponse.json(
          { error: 'Unauthorized - Missing session' },
          { status: 401 }
        );
      }

      // Check permission
      await requirePermission(userId, tenantId, permission);

      // Call the handler with context
      return handler(request, { params: routeContext.params, userId, tenantId });
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return NextResponse.json(
          { error: `Permission denied: ${permission}` },
          { status: 403 }
        );
      }

      // Re-throw other errors
      throw error;
    }
  };
}

/**
 * Check multiple permissions (user must have ALL permissions)
 *
 * @param userId - The user's ID
 * @param tenantId - The tenant's ID
 * @param permissions - Array of permission strings
 * @throws PermissionDeniedError if user doesn't have any required permission
 *
 * @example
 * await requireAllPermissions(userId, tenantId, [
 *   'settings:view',
 *   'settings:update'
 * ]);
 */
export async function requireAllPermissions(
  userId: string,
  tenantId: string,
  permissions: string[]
): Promise<void> {
  for (const permission of permissions) {
    await requirePermission(userId, tenantId, permission);
  }
}

/**
 * Check multiple permissions (user must have ANY permission)
 *
 * @param userId - The user's ID
 * @param tenantId - The tenant's ID
 * @param permissions - Array of permission strings
 * @throws PermissionDeniedError if user has none of the required permissions
 *
 * @example
 * await requireAnyPermission(userId, tenantId, [
 *   'settings:view',
 *   'billing:view'
 * ]);
 */
export async function requireAnyPermission(
  userId: string,
  tenantId: string,
  permissions: string[]
): Promise<void> {
  const results = await Promise.all(
    permissions.map((perm) => hasPermission(db, userId, tenantId, perm))
  );

  if (!results.some((result) => result === true)) {
    throw new PermissionDeniedError(permissions.join(' OR '));
  }
}
