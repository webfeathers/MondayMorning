import { db, jobs } from '@wf/db';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import { JobStatus, MAX_CONCURRENT_JOBS_PER_TENANT } from '@wf/shared';
import type { JobContext, JobPayload } from '../types/job';

/**
 * Job handler function type
 */
export type JobHandler<T = any> = (
  context: JobContext,
  payload: T
) => Promise<any>;

/**
 * Job processor class that handles job queue processing
 */
export class JobProcessor {
  private workerId: string;
  private handlers: Map<string, JobHandler>;
  private isRunning: boolean = false;
  private pollInterval: number = 1000; // 1 second default
  private intervalHandle?: NodeJS.Timeout;

  constructor(workerId: string) {
    this.workerId = workerId;
    this.handlers = new Map();
  }

  /**
   * Register a job handler for a specific job type
   */
  registerJobHandler<T = any>(jobType: string, handler: JobHandler<T>): void {
    this.handlers.set(jobType, handler);
    console.log(`Registered handler for job type: ${jobType}`);
  }

  /**
   * Process the next available job from the queue
   * Returns true if a job was processed, false if no job available or tenant at max concurrency
   */
  async processNextJob(): Promise<boolean> {
    try {
      // Use a transaction to claim a job atomically with FOR UPDATE SKIP LOCKED
      const result = await db.transaction(async (tx) => {
        // First, get the next queued job (ordered by priority DESC, createdAt ASC)
        const [nextJob] = await tx
          .select()
          .from(jobs)
          .where(eq(jobs.status, JobStatus.QUEUED))
          .orderBy(desc(jobs.priority), asc(jobs.createdAt))
          .limit(1)
          .for('update', { skipLocked: true });

        if (!nextJob) {
          return null; // No jobs available
        }

        // Check per-tenant concurrency limit
        const [runningCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(jobs)
          .where(
            and(
              eq(jobs.tenantId, nextJob.tenantId),
              eq(jobs.status, JobStatus.RUNNING)
            )
          );

        if (runningCount.count >= MAX_CONCURRENT_JOBS_PER_TENANT) {
          console.log(
            `Tenant ${nextJob.tenantId} at max concurrency (${runningCount.count}/${MAX_CONCURRENT_JOBS_PER_TENANT}), skipping job ${nextJob.id}`
          );
          return null; // Tenant at max concurrency
        }

        // Claim the job by updating status to 'running'
        const startedAt = new Date();
        await tx
          .update(jobs)
          .set({
            status: JobStatus.RUNNING,
            lockedBy: this.workerId,
            lockedAt: startedAt,
            attempts: nextJob.attempts + 1,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, nextJob.id));

        return { ...nextJob, startedAt };
      });

      if (!result) {
        return false; // No job processed
      }

      // Execute the job handler
      await this.executeJob(result);
      return true;
    } catch (error) {
      console.error('Error processing next job:', error);
      return false;
    }
  }

  /**
   * Execute a claimed job
   */
  private async executeJob(job: any): Promise<void> {
    const context: JobContext = {
      jobId: job.id,
      tenantId: job.tenantId,
      attempt: job.attempts,
      startedAt: job.startedAt,
      maxAttempts: job.maxAttempts,
    };

    try {
      // Get the handler for this job type
      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      // Execute the handler
      console.log(`Executing job ${job.id} (type: ${job.type}, attempt: ${job.attempts})`);
      const result = await handler(context, job.payload);

      // Mark job as completed
      await db
        .update(jobs)
        .set({
          status: JobStatus.COMPLETED,
          result: result || {},
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));

      console.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);

      // Mark job as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      const status = job.attempts >= job.maxAttempts ? JobStatus.FAILED : JobStatus.QUEUED;

      await db
        .update(jobs)
        .set({
          status,
          error: errorMessage,
          updatedAt: new Date(),
          ...(status === JobStatus.FAILED ? { completedAt: new Date() } : {}),
        })
        .where(eq(jobs.id, job.id));

      if (status === JobStatus.FAILED) {
        console.log(`Job ${job.id} marked as failed after ${job.attempts} attempts`);
      } else {
        console.log(`Job ${job.id} will be retried (attempt ${job.attempts}/${job.maxAttempts})`);
      }
    }
  }

  /**
   * Start the job processor with a polling loop
   */
  start(pollInterval: number = 1000): void {
    if (this.isRunning) {
      console.log('Job processor already running');
      return;
    }

    this.isRunning = true;
    this.pollInterval = pollInterval;

    console.log(`Starting job processor (worker: ${this.workerId}, interval: ${pollInterval}ms)`);

    // Start the polling loop
    this.intervalHandle = setInterval(async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        // Try to process jobs until none are available
        let processed = false;
        do {
          processed = await this.processNextJob();
        } while (processed && this.isRunning);
      } catch (error) {
        console.error('Error in polling loop:', error);
      }
    }, this.pollInterval);

    console.log('Job processor started');
  }

  /**
   * Stop the job processor gracefully
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping job processor...');
    this.isRunning = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }

    console.log('Job processor stopped');
  }

  /**
   * Check if the processor is running
   */
  isProcessorRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Singleton job processor instance
 */
let processorInstance: JobProcessor | null = null;

/**
 * Get the singleton job processor instance
 */
export function getJobProcessor(workerId?: string): JobProcessor {
  if (!processorInstance) {
    if (!workerId) {
      throw new Error('Worker ID required to initialize job processor');
    }
    processorInstance = new JobProcessor(workerId);
  }
  return processorInstance;
}

/**
 * Convenience function to process the next job
 */
export async function processNextJob(): Promise<boolean> {
  const processor = getJobProcessor();
  return processor.processNextJob();
}

/**
 * Convenience function to register a job handler
 */
export function registerJobHandler<T = any>(
  jobType: string,
  handler: JobHandler<T>
): void {
  const processor = getJobProcessor();
  processor.registerJobHandler(jobType, handler);
}

/**
 * Convenience function to start the processor
 */
export function startProcessor(workerId: string, pollInterval?: number): JobProcessor {
  const processor = getJobProcessor(workerId);
  processor.start(pollInterval);
  return processor;
}

/**
 * Convenience function to stop the processor
 */
export function stopProcessor(): void {
  if (processorInstance) {
    processorInstance.stop();
  }
}
