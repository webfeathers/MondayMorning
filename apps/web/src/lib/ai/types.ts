/**
 * Types for AI crew execution and context assembly.
 */

export type CrewTemplateId = 'account_health' | 'deal_analysis' | 'ticket_analysis';

export interface ContextData {
  accounts?: unknown[];
  contacts?: unknown[];
  deals?: unknown[];
  tickets?: unknown[];
  activities?: unknown[];
  [key: string]: unknown[] | undefined;
}

export interface CrewExecutionRequest {
  crewTemplateId: CrewTemplateId;
  accountId?: string;
  dealId?: string;
  ticketId?: string;
  maxTokens?: number;
  creditBudget?: number;
}

export interface ContextAssemblyOptions {
  maxTokens?: number;
  includeActivities?: boolean;
  activityDays?: number; // How many days of activity history to include
  maxRecordsPerType?: number; // Limit records per entity type
}

export interface AssembledContext {
  contextData: ContextData;
  metadata: {
    recordCounts: Record<string, number>;
    estimatedTokens: number;
    pruned: boolean;
    prunedFields?: string[];
  };
}
