/**
 * Pre-execution cost estimation for AI crews.
 *
 * Estimates token usage, credit consumption, and execution time
 * before actually running a crew.
 */

import type { AssembledContext, CrewTemplateId } from './types';

export interface CostEstimate {
  estimatedTokens: number;
  estimatedCredits: number;
  estimatedTimeSeconds: number;
  confidence: number; // 0.0 to 1.0
  breakdown: {
    contextTokens: number;
    systemPromptTokens: number;
    expectedOutputTokens: number;
    overhead: number;
  };
}

/**
 * Token estimates for different crew templates.
 * Based on empirical data from crew configurations.
 */
const CREW_TOKEN_OVERHEAD: Record<CrewTemplateId, {
  systemPrompt: number;
  expectedOutput: number;
  overhead: number;
}> = {
  account_health: {
    systemPrompt: 2000, // Prompts for 3 agents + 3 tasks
    expectedOutput: 1500, // Expected JSON output size
    overhead: 500, // Buffer for conversation overhead
  },
  deal_analysis: {
    systemPrompt: 1500,
    expectedOutput: 1000,
    overhead: 500,
  },
  ticket_analysis: {
    systemPrompt: 1200,
    expectedOutput: 800,
    overhead: 400,
  },
};

/**
 * Credit cost per 1000 tokens.
 * Adjust based on actual pricing model.
 */
const CREDITS_PER_1K_TOKENS = 1;

/**
 * Estimated tokens per second for generation.
 * Conservative estimate for gpt-4o-mini.
 */
const TOKENS_PER_SECOND = 500;

/**
 * Estimate cost for a crew execution.
 */
export function estimateCost(
  crewTemplateId: CrewTemplateId,
  assembledContext: AssembledContext
): CostEstimate {
  const overhead = CREW_TOKEN_OVERHEAD[crewTemplateId];

  if (!overhead) {
    throw new Error(`Unknown crew template: ${crewTemplateId}`);
  }

  // Get context tokens from assembled context metadata
  const contextTokens = assembledContext.metadata.estimatedTokens;

  // Calculate total tokens
  const totalTokens =
    contextTokens +
    overhead.systemPrompt +
    overhead.expectedOutput +
    overhead.overhead;

  // Calculate credits (1 credit per 1000 tokens)
  const estimatedCredits = Math.ceil(totalTokens / 1000) * CREDITS_PER_1K_TOKENS;

  // Estimate time (conservative - assume lower throughput for complex tasks)
  // Minimum 5 seconds for any crew
  const estimatedTimeSeconds = Math.max(
    5,
    Math.ceil(totalTokens / TOKENS_PER_SECOND)
  );

  // Confidence based on whether context was pruned
  // If pruned, less confident about token estimate
  const confidence = assembledContext.metadata.pruned ? 0.7 : 0.85;

  return {
    estimatedTokens: totalTokens,
    estimatedCredits,
    estimatedTimeSeconds,
    confidence,
    breakdown: {
      contextTokens,
      systemPromptTokens: overhead.systemPrompt,
      expectedOutputTokens: overhead.expectedOutput,
      overhead: overhead.overhead,
    },
  };
}

/**
 * Check if execution would exceed budget limits.
 */
export function checkBudget(
  estimate: CostEstimate,
  maxTokens?: number,
  maxCredits?: number,
  maxTimeSeconds?: number
): {
  withinBudget: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (maxTokens && estimate.estimatedTokens > maxTokens) {
    violations.push(
      `Estimated tokens (${estimate.estimatedTokens}) exceeds limit (${maxTokens})`
    );
  }

  if (maxCredits && estimate.estimatedCredits > maxCredits) {
    violations.push(
      `Estimated credits (${estimate.estimatedCredits}) exceeds limit (${maxCredits})`
    );
  }

  if (maxTimeSeconds && estimate.estimatedTimeSeconds > maxTimeSeconds) {
    violations.push(
      `Estimated time (${estimate.estimatedTimeSeconds}s) exceeds limit (${maxTimeSeconds}s)`
    );
  }

  return {
    withinBudget: violations.length === 0,
    violations,
  };
}

/**
 * Format cost estimate for display.
 */
export function formatCostEstimate(estimate: CostEstimate): string {
  const lines = [
    `Estimated Tokens: ${estimate.estimatedTokens.toLocaleString()}`,
    `Estimated Credits: ${estimate.estimatedCredits}`,
    `Estimated Time: ${estimate.estimatedTimeSeconds}s`,
    `Confidence: ${(estimate.confidence * 100).toFixed(0)}%`,
    '',
    'Breakdown:',
    `  Context: ${estimate.breakdown.contextTokens.toLocaleString()} tokens`,
    `  System Prompts: ${estimate.breakdown.systemPromptTokens.toLocaleString()} tokens`,
    `  Expected Output: ${estimate.breakdown.expectedOutputTokens.toLocaleString()} tokens`,
    `  Overhead: ${estimate.breakdown.overhead.toLocaleString()} tokens`,
  ];

  return lines.join('\n');
}
