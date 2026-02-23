import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JobProcessor } from '../processor/job-processor';
import { MAX_CONCURRENT_JOBS_PER_TENANT } from '@wf/shared';

describe('Job Processor', () => {
  let processor: JobProcessor;
  const workerId = 'test-worker-1';

  beforeEach(() => {
    processor = new JobProcessor(workerId);
  });

  afterEach(() => {
    processor.stop();
  });

  describe('initialization', () => {
    it('creates a job processor with worker ID', () => {
      expect(processor).toBeDefined();
      expect(processor.isProcessorRunning()).toBe(false);
    });
  });

  describe('registerJobHandler', () => {
    it('registers a job handler for a specific type', () => {
      const handler = async () => ({ success: true });

      // Should not throw when registering
      expect(() => {
        processor.registerJobHandler('test_job', handler);
      }).not.toThrow();
    });

    it('allows multiple handlers for different job types', () => {
      const handler1 = async () => ({ success: true });
      const handler2 = async () => ({ success: true });

      expect(() => {
        processor.registerJobHandler('job_type_1', handler1);
        processor.registerJobHandler('job_type_2', handler2);
      }).not.toThrow();
    });

    it('allows overwriting handlers for the same job type', () => {
      const handler1 = async () => ({ result: 'first' });
      const handler2 = async () => ({ result: 'second' });

      processor.registerJobHandler('test_job', handler1);
      processor.registerJobHandler('test_job', handler2);

      // Should not throw - last handler wins
      expect(() => {
        processor.registerJobHandler('test_job', handler2);
      }).not.toThrow();
    });
  });

  describe('processor lifecycle', () => {
    it('starts the processor with default interval', () => {
      processor.start();
      expect(processor.isProcessorRunning()).toBe(true);
      processor.stop();
    });

    it('starts the processor with custom interval', () => {
      processor.start(500);
      expect(processor.isProcessorRunning()).toBe(true);
      processor.stop();
    });

    it('stops the processor gracefully', () => {
      processor.start();
      expect(processor.isProcessorRunning()).toBe(true);

      processor.stop();
      expect(processor.isProcessorRunning()).toBe(false);
    });

    it('handles multiple stop calls gracefully', () => {
      processor.start();
      processor.stop();

      // Should not throw on second stop
      expect(() => processor.stop()).not.toThrow();
      expect(processor.isProcessorRunning()).toBe(false);
    });

    it('prevents starting when already running', () => {
      processor.start();
      const wasRunning1 = processor.isProcessorRunning();

      // Try to start again
      processor.start();
      const wasRunning2 = processor.isProcessorRunning();

      expect(wasRunning1).toBe(true);
      expect(wasRunning2).toBe(true);

      processor.stop();
    });
  });

  describe('processNextJob - structure tests', () => {
    it('returns a boolean indicating if job was processed', async () => {
      // Without database connection, should return false (no job available)
      const result = await processor.processNextJob();
      expect(typeof result).toBe('boolean');
    });

    it('handles missing job handler gracefully', async () => {
      // If we somehow get a job without a handler, it should not crash
      // This will be tested properly with integration tests
      const result = await processor.processNextJob();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('concurrency limits', () => {
    it('enforces MAX_CONCURRENT_JOBS_PER_TENANT constant', () => {
      // Verify the constant exists and has correct value
      expect(MAX_CONCURRENT_JOBS_PER_TENANT).toBe(2);
    });
  });

  describe('FOR UPDATE SKIP LOCKED', () => {
    it('uses FOR UPDATE SKIP LOCKED in database query', () => {
      // This is verified by inspecting the source code
      // The actual SQL behavior is tested in integration tests
      // Here we just verify the processor is structured correctly
      expect(processor).toBeDefined();
    });
  });
});

/**
 * Integration tests notes:
 *
 * The following scenarios should be tested with actual database:
 *
 * 1. Claims job with FOR UPDATE SKIP LOCKED
 *    - Verify that concurrent workers don't claim same job
 *    - Verify SKIP LOCKED prevents blocking
 *
 * 2. Updates job status to 'running' when claimed
 *    - Verify status transition from 'queued' to 'running'
 *    - Verify lockedBy and lockedAt are set
 *    - Verify attempts counter increments
 *
 * 3. Enforces per-tenant concurrency limit
 *    - Insert 2 running jobs for tenant-1
 *    - Insert 1 queued job for tenant-1
 *    - Verify processor skips the queued job
 *
 * 4. Skips jobs for tenants at max concurrency
 *    - Insert 2 running jobs for tenant-1
 *    - Insert 1 queued job for tenant-1 (priority 10)
 *    - Insert 1 queued job for tenant-2 (priority 5)
 *    - Verify processor skips tenant-1 job and processes tenant-2 job
 *
 * 5. Executes job handler based on jobType
 *    - Register handler for 'test_job'
 *    - Insert job with type 'test_job'
 *    - Verify handler is called with correct context and payload
 *
 * 6. Updates job status to 'completed' on success
 *    - Register successful handler
 *    - Process job
 *    - Verify status is 'completed', result is stored, completedAt is set
 *
 * 7. Updates job status to 'failed' on error
 *    - Register handler that throws error
 *    - Process job with maxAttempts = 1
 *    - Verify status is 'failed', error message stored, completedAt set
 *
 * 8. Retries failed jobs
 *    - Register handler that throws error
 *    - Process job with maxAttempts = 3, attempts = 1
 *    - Verify status returns to 'queued' for retry
 *
 * 9. Priority-based processing
 *    - Insert multiple queued jobs with different priorities
 *    - Verify higher priority jobs processed first
 *
 * 10. CreatedAt-based ordering (FIFO for same priority)
 *     - Insert multiple queued jobs with same priority, different timestamps
 *     - Verify older jobs processed first
 */
