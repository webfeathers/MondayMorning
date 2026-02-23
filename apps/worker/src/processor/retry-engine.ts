/**
 * Retry Engine - Exponential Backoff
 *
 * Calculates retry delays using exponential backoff with jitter to avoid thundering herd.
 *
 * Formula: delay = min(maxDelay, baseDelay * (2 ^ attempt)) + random_jitter
 *
 * Configuration:
 * - BASE_DELAY_MS: Initial delay (default: 1000ms = 1 second)
 * - MAX_DELAY_MS: Maximum delay cap (default: 300000ms = 5 minutes)
 * - JITTER_MS: Random jitter range (default: 1000ms)
 *
 * Example delays (with baseDelay=1000ms):
 * - Attempt 1: 2s + jitter
 * - Attempt 2: 4s + jitter
 * - Attempt 3: 8s + jitter
 * - Attempt 4: 16s + jitter
 * - Attempt 5: 32s + jitter
 * - Attempt 6: 64s + jitter
 * - Attempt 7: 128s + jitter (2.1 minutes)
 * - Attempt 8+: 300s + jitter (5 minutes, capped)
 */

/**
 * Default configuration
 */
export const BASE_DELAY_MS = parseInt(process.env.RETRY_BASE_DELAY_MS || '1000');
export const MAX_DELAY_MS = parseInt(process.env.RETRY_MAX_DELAY_MS || '300000');
export const JITTER_MS = parseInt(process.env.RETRY_JITTER_MS || '1000');

/**
 * Calculate exponential backoff delay for a given attempt number
 *
 * @param attempt - The current attempt number (1-indexed)
 * @param baseDelayMs - Base delay in milliseconds (default: BASE_DELAY_MS)
 * @param maxDelayMs - Maximum delay in milliseconds (default: MAX_DELAY_MS)
 * @param jitterMs - Jitter range in milliseconds (default: JITTER_MS)
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelayMs: number = BASE_DELAY_MS,
  maxDelayMs: number = MAX_DELAY_MS,
  jitterMs: number = JITTER_MS
): number {
  // Exponential backoff: baseDelay * (2 ^ attempt)
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add random jitter to avoid thundering herd
  const jitter = Math.random() * jitterMs;

  return Math.floor(cappedDelay + jitter);
}

/**
 * Calculate the next scheduled time for a job retry
 *
 * @param attempt - The current attempt number (1-indexed)
 * @param baseDelayMs - Base delay in milliseconds (default: BASE_DELAY_MS)
 * @param maxDelayMs - Maximum delay in milliseconds (default: MAX_DELAY_MS)
 * @param jitterMs - Jitter range in milliseconds (default: JITTER_MS)
 * @returns Date object representing when the job should be retried
 */
export function calculateNextRetryTime(
  attempt: number,
  baseDelayMs: number = BASE_DELAY_MS,
  maxDelayMs: number = MAX_DELAY_MS,
  jitterMs: number = JITTER_MS
): Date {
  const delayMs = calculateRetryDelay(attempt, baseDelayMs, maxDelayMs, jitterMs);
  return new Date(Date.now() + delayMs);
}

/**
 * Check if a job should be retried based on its attempt count and max attempts
 *
 * @param attempts - Current number of attempts
 * @param maxAttempts - Maximum number of attempts allowed
 * @returns true if the job should be retried, false otherwise
 */
export function shouldRetryJob(attempts: number, maxAttempts: number): boolean {
  return attempts < maxAttempts;
}

/**
 * Get a human-readable description of the retry schedule
 *
 * @param maxAttempts - Maximum number of attempts
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @returns Array of strings describing each retry attempt
 */
export function getRetryScheduleDescription(
  maxAttempts: number,
  baseDelayMs: number = BASE_DELAY_MS,
  maxDelayMs: number = MAX_DELAY_MS
): string[] {
  const schedule: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const delayMs = calculateRetryDelay(attempt, baseDelayMs, maxDelayMs, 0); // No jitter for description
    const delaySeconds = delayMs / 1000;

    let formattedDelay: string;
    if (delaySeconds < 60) {
      formattedDelay = `${delaySeconds}s`;
    } else if (delaySeconds < 3600) {
      formattedDelay = `${(delaySeconds / 60).toFixed(1)}m`;
    } else {
      formattedDelay = `${(delaySeconds / 3600).toFixed(1)}h`;
    }

    schedule.push(`Attempt ${attempt}: retry after ~${formattedDelay}`);
  }

  return schedule;
}
