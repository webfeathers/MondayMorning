/**
 * Notification helper for AI execution completion.
 * Called by the worker when an execution completes or fails.
 */

import { db } from '@wf/db';
import { notifications } from '@wf/db';
import type { AiExecution } from '@wf/db';

interface NotificationPayload {
  executionId: string;
  tenantId: string;
  userId: string;
  status: string;
  crewTemplateId: string;
  entityType?: string | null;
  entityId?: string | null;
  errorMessage?: string | null;
}

/**
 * Send notification when an AI execution completes or fails.
 */
export async function notifyExecutionComplete(
  execution: NotificationPayload
): Promise<void> {
  try {
    const isSuccess = execution.status === 'completed';
    const title = isSuccess
      ? `Analysis Complete: ${execution.crewTemplateId}`
      : `Analysis Failed: ${execution.crewTemplateId}`;

    const message = isSuccess
      ? `Your ${execution.crewTemplateId} analysis has completed successfully.`
      : `Your ${execution.crewTemplateId} analysis failed: ${execution.errorMessage || 'Unknown error'}`;

    // Create in-app notification
    await db.insert(notifications).values({
      tenantId: execution.tenantId,
      userId: execution.userId,
      type: 'ai_execution_complete',
      title,
      message,
      data: {
        executionId: execution.executionId,
        crewTemplateId: execution.crewTemplateId,
        entityType: execution.entityType,
        entityId: execution.entityId,
        status: execution.status,
      },
      priority: isSuccess ? 'normal' : 'high',
      status: 'unread',
    });

    console.log(
      `Notification sent for execution ${execution.executionId}: ${title}`
    );
  } catch (error) {
    console.error('Failed to send execution notification:', error);
    // Don't throw - notification failure shouldn't fail the execution
  }
}

/**
 * Send notification when an execution is about to start (optional).
 */
export async function notifyExecutionStarted(
  execution: NotificationPayload
): Promise<void> {
  try {
    await db.insert(notifications).values({
      tenantId: execution.tenantId,
      userId: execution.userId,
      type: 'ai_execution_started',
      title: `Analysis Started: ${execution.crewTemplateId}`,
      message: `Your ${execution.crewTemplateId} analysis is now running.`,
      data: {
        executionId: execution.executionId,
        crewTemplateId: execution.crewTemplateId,
        entityType: execution.entityType,
        entityId: execution.entityId,
      },
      priority: 'low',
      status: 'unread',
    });

    console.log(`Start notification sent for execution ${execution.executionId}`);
  } catch (error) {
    console.error('Failed to send execution start notification:', error);
  }
}
