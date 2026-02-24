/**
 * AI Usage Tracking Service
 *
 * Logs AI usage for analytics, billing, and monitoring.
 * Tracks tokens, costs, execution time, and credits consumed.
 */

import { db } from '@wf/db';
import { aiUsage, type NewAiUsage } from '@wf/db';

// Model pricing in USD per 1M tokens (as of 2025)
const MODEL_PRICING = {
  // Claude models
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-3-5-20250219': { input: 0.8, output: 4.0 },

  // Gemini models
  'gemini-2.0-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },

  // Default fallback
  default: { input: 1.0, output: 3.0 },
} as const;

// Credits consumed per 1K tokens (simplified formula)
const CREDITS_PER_1K_TOKENS = 1;

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface TrackUsageParams {
  tenantId: string;
  userId?: string;
  executionId?: string;
  crewTemplateId: string;
  entityType?: string;
  entityId?: string;
  modelName: string;
  tokenUsage: TokenUsage;
  executionTimeSeconds?: number;
  status?: 'completed' | 'failed' | 'partial';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Calculate estimated cost in USD based on model and token usage.
 */
export function calculateCost(modelName: string, tokenUsage: TokenUsage): number {
  const pricing =
    MODEL_PRICING[modelName as keyof typeof MODEL_PRICING] || MODEL_PRICING.default;

  const inputCost = (tokenUsage.prompt_tokens / 1_000_000) * pricing.input;
  const outputCost = (tokenUsage.completion_tokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Calculate credits consumed based on total tokens.
 */
export function calculateCredits(totalTokens: number): number {
  return Math.ceil(totalTokens / 1000) * CREDITS_PER_1K_TOKENS;
}

/**
 * Track AI usage for an execution.
 *
 * This should be called after every AI execution completes or fails.
 */
export async function trackUsage(params: TrackUsageParams): Promise<void> {
  try {
    const estimatedCostUsd = calculateCost(params.modelName, params.tokenUsage);
    const creditsConsumed = calculateCredits(params.tokenUsage.total_tokens);

    const usageRecord: NewAiUsage = {
      tenantId: params.tenantId,
      userId: params.userId || null,
      executionId: params.executionId || null,
      crewTemplateId: params.crewTemplateId,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      modelName: params.modelName,
      promptTokens: params.tokenUsage.prompt_tokens,
      completionTokens: params.tokenUsage.completion_tokens,
      totalTokens: params.tokenUsage.total_tokens,
      estimatedCostUsd: estimatedCostUsd.toFixed(6),
      creditsConsumed,
      executionTimeSeconds: params.executionTimeSeconds || null,
      status: params.status || 'completed',
      errorMessage: params.errorMessage || null,
      metadata: params.metadata || null,
    };

    await db.insert(aiUsage).values(usageRecord);

    console.log(
      `📊 Usage tracked: ${params.crewTemplateId} | ${params.tokenUsage.total_tokens} tokens | ${creditsConsumed} credits | $${estimatedCostUsd.toFixed(4)}`
    );
  } catch (error) {
    console.error('Failed to track AI usage:', error);
    // Don't throw - usage tracking failure shouldn't fail the execution
  }
}

/**
 * Track failed execution with zero tokens (for analytics).
 */
export async function trackFailure(params: Omit<TrackUsageParams, 'tokenUsage'>): Promise<void> {
  await trackUsage({
    ...params,
    tokenUsage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
    status: 'failed',
  });
}

/**
 * Get usage summary for a tenant within a date range.
 */
export async function getUsageSummary(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalTokens: number;
  totalCredits: number;
  totalCostUsd: number;
  executionCount: number;
  byModel: Record<string, { tokens: number; cost: number; count: number }>;
}> {
  const { sql } = await import('drizzle-orm');

  const result = await db
    .select({
      totalTokens: sql<number>`SUM(${aiUsage.totalTokens})::integer`,
      totalCredits: sql<number>`SUM(${aiUsage.creditsConsumed})::integer`,
      totalCostUsd: sql<number>`SUM(${aiUsage.estimatedCostUsd})::numeric`,
      executionCount: sql<number>`COUNT(*)::integer`,
    })
    .from(aiUsage)
    .where(
      sql`${aiUsage.tenantId} = ${tenantId}
          AND ${aiUsage.createdAt} >= ${startDate}
          AND ${aiUsage.createdAt} <= ${endDate}`
    );

  // Get breakdown by model
  const byModelResult = await db
    .select({
      modelName: aiUsage.modelName,
      tokens: sql<number>`SUM(${aiUsage.totalTokens})::integer`,
      cost: sql<number>`SUM(${aiUsage.estimatedCostUsd})::numeric`,
      count: sql<number>`COUNT(*)::integer`,
    })
    .from(aiUsage)
    .where(
      sql`${aiUsage.tenantId} = ${tenantId}
          AND ${aiUsage.createdAt} >= ${startDate}
          AND ${aiUsage.createdAt} <= ${endDate}`
    )
    .groupBy(aiUsage.modelName);

  const byModel: Record<string, { tokens: number; cost: number; count: number }> = {};
  for (const row of byModelResult) {
    byModel[row.modelName] = {
      tokens: row.tokens || 0,
      cost: parseFloat(row.cost?.toString() || '0'),
      count: row.count || 0,
    };
  }

  return {
    totalTokens: result[0]?.totalTokens || 0,
    totalCredits: result[0]?.totalCredits || 0,
    totalCostUsd: parseFloat(result[0]?.totalCostUsd?.toString() || '0'),
    executionCount: result[0]?.executionCount || 0,
    byModel,
  };
}
