import { db, jobs } from '@wf/db';
import { eq, and, lt, sql } from 'drizzle-orm';
import { JobStatus, JOB_STALL_TIMEOUT_MS } from '@wf/shared';

/**
 * Detect and reset jobs that have been running for longer than JOB_STALL_TIMEOUT_MS
 * @returns Number of stalled jobs detected and reset
 */
export async function detectStalledJobs(): Promise<number> {
  try {
    // Calculate the stall threshold time
    const stallThreshold = new Date(Date.now() - JOB_STALL_TIMEOUT_MS);

    // Find all jobs that are running and locked before the stall threshold
    const stalledJobs = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, JobStatus.RUNNING),
          lt(jobs.lockedAt, stallThreshold)
        )
      );

    if (stalledJobs.length === 0) {
      return 0;
    }

    console.log(`Found ${stalledJobs.length} stalled job(s)`);

    // Reset each stalled job
    for (const job of stalledJobs) {
      console.warn(
        `Job ${job.id} stalled (running for >${JOB_STALL_TIMEOUT_MS / 60000} minutes), resetting for retry (attempt ${job.attempts + 1})`
      );

      await db
        .update(jobs)
        .set({
          status: JobStatus.QUEUED,
          attempts: job.attempts + 1,
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));
    }

    return stalledJobs.length;
  } catch (error) {
    console.error('Error detecting stalled jobs:', error);
    throw error;
  }
}

/**
 * Start the stall detection loop
 * @param checkInterval - How often to check for stalled jobs in milliseconds (default: 60000 = 1 minute)
 */
let detectionInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export function startStallDetection(checkInterval: number = 60000): void {
  if (isRunning) {
    console.warn('Stall detection is already running');
    return;
  }

  isRunning = true;
  console.log(`Starting stall detection (checking every ${checkInterval}ms)`);

  // Run immediately on start
  detectStalledJobs().catch((error) => {
    console.error('Error in initial stall detection:', error);
  });

  // Then run on interval
  detectionInterval = setInterval(async () => {
    try {
      const count = await detectStalledJobs();
      if (count > 0) {
        console.log(`Stall detection reset ${count} job(s)`);
      }
    } catch (error) {
      console.error('Error in stall detection:', error);
    }
  }, checkInterval);
}

/**
 * Stop the stall detection loop
 */
export function stopStallDetection(): void {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
    isRunning = false;
    console.log('Stall detection stopped');
  }
}

/**
 * Check if stall detection is running
 */
export function isStallDetectionRunning(): boolean {
  return isRunning;
}
