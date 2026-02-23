/**
 * CRM API Quota Manager
 *
 * Tracks and enforces API quota limits for external CRM providers to prevent
 * exceeding rate limits and incurring API throttling or overage charges.
 *
 * Features:
 * - Pre-sync quota checks
 * - Quota threshold warnings (pause sync when quota too low)
 * - Per-provider quota tracking
 * - Exponential backoff when quota exhausted
 *
 * Thresholds:
 * - CRITICAL: < 10% remaining → pause all syncs
 * - WARNING: < 25% remaining → log warning, continue
 * - NORMAL: >= 25% remaining → proceed normally
 */

import type { RateLimitStatus } from '@wf/integrations';

/**
 * Quota threshold levels
 */
export enum QuotaLevel {
  NORMAL = 'NORMAL',       // >= 25% remaining
  WARNING = 'WARNING',     // < 25% remaining
  CRITICAL = 'CRITICAL',   // < 10% remaining
}

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  canProceed: boolean;
  level: QuotaLevel;
  status: RateLimitStatus;
  message: string;
  shouldWait?: boolean;
  waitUntil?: Date;
}

/**
 * Quota manager configuration
 */
export interface QuotaManagerConfig {
  warningThreshold: number;  // Default: 0.25 (25%)
  criticalThreshold: number; // Default: 0.10 (10%)
}

/**
 * Default configuration
 */
export const DEFAULT_QUOTA_CONFIG: QuotaManagerConfig = {
  warningThreshold: parseFloat(process.env.QUOTA_WARNING_THRESHOLD || '0.25'),
  criticalThreshold: parseFloat(process.env.QUOTA_CRITICAL_THRESHOLD || '0.10'),
};

/**
 * Quota exhausted error
 */
export class QuotaExhaustedError extends Error {
  constructor(
    public provider: string,
    public status: RateLimitStatus,
    public resetAt: Date
  ) {
    super(
      `API quota exhausted for ${provider}. ` +
      `${status.remaining}/${status.limit} requests remaining. ` +
      `Resets at ${resetAt.toISOString()}`
    );
    this.name = 'QuotaExhaustedError';
  }
}

/**
 * Quota Manager
 */
export class QuotaManager {
  private lastChecks: Map<string, { status: RateLimitStatus; checkedAt: Date }> = new Map();
  private config: QuotaManagerConfig;

  constructor(config: QuotaManagerConfig = DEFAULT_QUOTA_CONFIG) {
    this.config = config;
  }

  /**
   * Check if we can proceed with API calls based on current quota
   *
   * @param provider - Provider name (e.g., 'salesforce', 'hubspot')
   * @param status - Current rate limit status from provider
   * @returns Quota check result
   */
  checkQuota(provider: string, status: RateLimitStatus): QuotaCheckResult {
    // Calculate quota level
    const level = this.determineQuotaLevel(status.percentUsed);

    // Cache the status
    this.lastChecks.set(provider, {
      status,
      checkedAt: new Date(),
    });

    // Determine if we can proceed
    switch (level) {
      case QuotaLevel.CRITICAL:
        // Quota exhausted - must wait for reset
        const resetAt = new Date(status.resetAt);
        return {
          canProceed: false,
          level,
          status,
          message: `CRITICAL: Only ${status.remaining}/${status.limit} requests remaining (${Math.round(status.percentUsed * 100)}% used). Pausing until reset.`,
          shouldWait: true,
          waitUntil: resetAt,
        };

      case QuotaLevel.WARNING:
        // Low quota - log warning but continue
        return {
          canProceed: true,
          level,
          status,
          message: `WARNING: ${status.remaining}/${status.limit} requests remaining (${Math.round(status.percentUsed * 100)}% used). Approaching quota limit.`,
        };

      case QuotaLevel.NORMAL:
      default:
        // Normal operation
        return {
          canProceed: true,
          level,
          status,
          message: `NORMAL: ${status.remaining}/${status.limit} requests remaining (${Math.round(status.percentUsed * 100)}% used).`,
        };
    }
  }

  /**
   * Determine quota level based on percent used
   */
  private determineQuotaLevel(percentUsed: number): QuotaLevel {
    const percentRemaining = 1 - percentUsed;

    if (percentRemaining <= this.config.criticalThreshold) {
      return QuotaLevel.CRITICAL;
    } else if (percentRemaining <= this.config.warningThreshold) {
      return QuotaLevel.WARNING;
    } else {
      return QuotaLevel.NORMAL;
    }
  }

  /**
   * Get last known quota status for a provider
   *
   * @param provider - Provider name
   * @returns Cached status or null if never checked
   */
  getLastStatus(provider: string): RateLimitStatus | null {
    const cached = this.lastChecks.get(provider);
    return cached ? cached.status : null;
  }

  /**
   * Get all cached quota statuses
   */
  getAllStatuses(): Record<string, { status: RateLimitStatus; checkedAt: Date }> {
    const result: Record<string, any> = {};
    for (const [provider, data] of this.lastChecks.entries()) {
      result[provider] = data;
    }
    return result;
  }

  /**
   * Clear cached status for a provider
   */
  clearStatus(provider: string): void {
    this.lastChecks.delete(provider);
  }

  /**
   * Clear all cached statuses
   */
  clearAll(): void {
    this.lastChecks.clear();
  }

  /**
   * Calculate delay until quota reset
   *
   * @param resetAt - Reset timestamp (ISO 8601)
   * @returns Delay in milliseconds
   */
  static calculateDelayUntilReset(resetAt: string): number {
    const resetTime = new Date(resetAt).getTime();
    const now = Date.now();
    return Math.max(0, resetTime - now);
  }

  /**
   * Format quota status as human-readable string
   */
  static formatQuotaStatus(status: RateLimitStatus): string {
    const percentUsed = Math.round(status.percentUsed * 100);
    const resetAt = new Date(status.resetAt);
    const minutesUntilReset = Math.round((resetAt.getTime() - Date.now()) / 60000);

    return (
      `${status.remaining}/${status.limit} requests remaining (${percentUsed}% used). ` +
      `Resets in ${minutesUntilReset} minutes.`
    );
  }
}

/**
 * Singleton quota manager instance
 */
export const quotaManager = new QuotaManager();

/**
 * Helper function to check quota and throw error if exhausted
 *
 * @param provider - Provider name
 * @param status - Current rate limit status
 * @throws QuotaExhaustedError if quota is at critical level
 */
export function enforceQuota(provider: string, status: RateLimitStatus): QuotaCheckResult {
  const result = quotaManager.checkQuota(provider, status);

  if (!result.canProceed) {
    throw new QuotaExhaustedError(provider, status, result.waitUntil!);
  }

  return result;
}
