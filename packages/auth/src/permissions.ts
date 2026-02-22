import { eq, and } from 'drizzle-orm';
import { tenantMembers, permissions } from '@wf/db';
import type { DB } from '@wf/db';

/**
 * Role hierarchy levels (higher number = more permissions)
 */
const ROLE_HIERARCHY = {
  member: 1,
  admin: 2,
  owner: 3,
} as const;

type TenantRole = keyof typeof ROLE_HIERARCHY;

/**
 * Check if a role satisfies the required role based on hierarchy
 */
function roleHasPermission(userRole: TenantRole, requiredRole: TenantRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Parse permission string (e.g., "settings:update") into resource and action
 */
function parsePermission(permission: string): { resource: string; action: string } {
  const [resource, action] = permission.split(':');
  if (!resource || !action) {
    throw new Error(`Invalid permission format: ${permission}. Expected "resource:action"`);
  }
  return { resource, action };
}

/**
 * Check if a user has a specific permission in a tenant
 *
 * @param db - Database instance
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @param permission - Permission string in format "resource:action" (e.g., "settings:update")
 * @returns True if user has permission, false otherwise
 */
export async function hasPermission(
  db: DB,
  userId: string,
  tenantId: string,
  permission: string
): Promise<boolean> {
  try {
    // 1. Get user's role in the tenant
    const memberResult = await db
      .select({
        role: tenantMembers.role,
      })
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.userId, userId),
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.status, 'active')
        )
      );

    if (memberResult.length === 0) {
      return false; // User is not a member of this tenant
    }

    const userRole = memberResult[0].role as TenantRole;

    // 2. Parse permission string
    const { resource, action } = parsePermission(permission);

    // 3. Look up the permission requirement
    const permissionResult = await db
      .select({
        requiredRole: permissions.requiredRole,
      })
      .from(permissions)
      .where(
        and(
          eq(permissions.resource, resource),
          eq(permissions.action, action)
        )
      );

    if (permissionResult.length === 0) {
      return false; // Permission doesn't exist
    }

    const requiredRole = permissionResult[0].requiredRole as TenantRole;

    // 4. Check role hierarchy
    return roleHasPermission(userRole, requiredRole);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Get all permissions for a user in a tenant
 *
 * @param db - Database instance
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @returns Array of permission strings in format "resource:action"
 */
export async function getUserPermissions(
  db: DB,
  userId: string,
  tenantId: string
): Promise<string[]> {
  try {
    // 1. Get user's role in the tenant
    const memberResult = await db
      .select({
        role: tenantMembers.role,
      })
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.userId, userId),
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.status, 'active')
        )
      );

    if (memberResult.length === 0) {
      return []; // User is not a member of this tenant
    }

    const userRole = memberResult[0].role as TenantRole;

    // 2. Get all permissions
    const allPermissions = await db
      .select({
        resource: permissions.resource,
        action: permissions.action,
        requiredRole: permissions.requiredRole,
      })
      .from(permissions);

    // 3. Filter permissions based on role hierarchy
    const userPermissions = allPermissions
      .filter((perm) => roleHasPermission(userRole, perm.requiredRole as TenantRole))
      .map((perm) => `${perm.resource}:${perm.action}`);

    return userPermissions;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if user has permission and throw error if not
 *
 * @param db - Database instance
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @param permission - Permission string in format "resource:action"
 * @throws Error if user doesn't have permission
 */
export async function checkPermission(
  db: DB,
  userId: string,
  tenantId: string,
  permission: string
): Promise<void> {
  const hasAccess = await hasPermission(db, userId, tenantId, permission);

  if (!hasAccess) {
    throw new Error(`Permission denied: ${permission}`);
  }
}
