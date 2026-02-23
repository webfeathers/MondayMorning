/**
 * Job payload types - discriminated union for different job types
 */
export type JobPayload =
  | {
      type: 'sync_crm';
      tenantId: string;
      connectionId: string;
      syncType: 'full' | 'incremental';
    }
  | {
      type: 'ai_analysis';
      tenantId: string;
      crewId: string;
      contextData: Record<string, unknown>;
    }
  | {
      type: 'send_notification';
      tenantId: string;
      userId: string;
      notificationId: string;
    }
  | {
      type: 'tenant_lifecycle';
      tenantId: string;
      action: 'provision' | 'suspend' | 'reactivate' | 'purge';
    };

/**
 * Job execution context
 */
export interface JobContext {
  jobId: string;
  tenantId: string;
  attempt: number;
  startedAt?: Date;
  maxAttempts?: number;
}
