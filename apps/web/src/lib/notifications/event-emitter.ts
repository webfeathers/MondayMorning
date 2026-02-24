/**
 * Event emitter for notification system
 *
 * Emits events that trigger notifications
 */

import { db } from '@wf/db';
import { notifications } from '@wf/db';
import { createApiLogger } from '@/lib/api-logger';

export type NotificationEvent =
  | 'ai_execution_complete'
  | 'ai_execution_failed'
  | 'credit_limit_reached'
  | 'member_invited'
  | 'member_removed'
  | 'integration_connected'
  | 'integration_failed';

export interface NotificationPayload {
  tenantId: string;
  userId?: string;
  type: NotificationEvent;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Emit a notification event
 */
export async function emitNotification(payload: NotificationPayload) {
  try {
    await db.insert(notifications).values({
      tenantId: payload.tenantId,
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata,
      read: false,
    });
  } catch (error) {
    console.error('Failed to emit notification:', error);
  }
}
