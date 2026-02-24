/**
 * Audit logging for sensitive operations
 *
 * Append-only logging for compliance and security
 */

import { db } from '@wf/db';
import { auditLogs } from '@wf/db';

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'member.invited'
  | 'member.removed'
  | 'member.role_changed'
  | 'integration.connected'
  | 'integration.disconnected'
  | 'billing.plan_changed'
  | 'billing.payment_processed'
  | 'settings.updated'
  | 'data.exported';

export interface AuditLogEntry {
  tenantId: string;
  userId: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(entry: AuditLogEntry) {
  try {
    await db.insert(auditLogs).values({
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Never throw - audit logging should not break the application
  }
}
