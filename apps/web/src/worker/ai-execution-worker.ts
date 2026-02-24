/**
 * Worker for processing AI crew execution jobs.
 *
 * This worker:
 * 1. Polls the ai_execution_jobs table for pending jobs
 * 2. Calls the AI service to execute the crew
 * 3. Updates the execution record with results
 */

import { db } from '@wf/db';
import { aiExecutions, aiExecutionJobs } from '@wf/db';
import { eq, and } from 'drizzle-orm';
import { notifyExecutionComplete } from '@/lib/notifications/ai-execution-notifier';
import { trackUsage, trackFailure } from '@/lib/ai/usage-tracker';
import { deductCredits } from '@/lib/billing/credits';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const MAX_ATTEMPTS = 3;

interface ExecutionResult {
  execution_id: string;
  status: string;
  result?: any;
  raw_output?: string;
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  credits_consumed: number;
  execution_time_seconds: number;
  model_name?: string;
  error_message?: string;
  error_details?: any;
}

async function processJob(jobId: string) {
  console.log(`Processing job ${jobId}...`);

  // Get job and execution details
  const job = await db.query.aiExecutionJobs.findFirst({
    where: eq(aiExecutionJobs.id, jobId),
  });

  if (!job) {
    console.error(`Job ${jobId} not found`);
    return;
  }

  const execution = await db.query.aiExecutions.findFirst({
    where: eq(aiExecutions.id, job.executionId),
  });

  if (!execution) {
    console.error(`Execution ${job.executionId} not found`);
    return;
  }

  try {
    // Update job status to processing
    await db
      .update(aiExecutionJobs)
      .set({
        status: 'processing',
        startedAt: new Date(),
      })
      .where(eq(aiExecutionJobs.id, jobId));

    // Update execution status to running
    await db
      .update(aiExecutions)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(aiExecutions.id, execution.id));

    // Call AI service to execute the crew
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/crews/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        execution_id: execution.id,
        tenant_id: execution.tenantId,
        crew_template_id: execution.crewTemplateId,
        context_data: execution.contextData,
        crew_config: execution.crewConfig || {},
        max_tokens: 50000,
        max_execution_time_seconds: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}: ${await response.text()}`);
    }

    const result: ExecutionResult = await response.json();

    // Update execution with results
    await db
      .update(aiExecutions)
      .set({
        status: result.status === 'completed' ? 'completed' : 'failed',
        completedAt: new Date(),
        result: result.result,
        rawOutput: result.raw_output,
        tokenUsage: result.token_usage,
        creditsConsumed: result.credits_consumed,
        executionTimeSeconds: result.execution_time_seconds,
        modelName: result.model_name,
        errorMessage: result.error_message,
        errorDetails: result.error_details,
      })
      .where(eq(aiExecutions.id, execution.id));

    // Update job status to completed
    await db
      .update(aiExecutionJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(aiExecutionJobs.id, jobId));

    // Track usage for analytics and billing
    if (result.token_usage) {
      await trackUsage({
        tenantId: execution.tenantId,
        userId: execution.userId,
        executionId: execution.id,
        crewTemplateId: execution.crewTemplateId,
        entityType: execution.entityType || undefined,
        entityId: execution.entityId || undefined,
        modelName: result.model_name || 'unknown',
        tokenUsage: result.token_usage,
        executionTimeSeconds: result.execution_time_seconds,
        status: result.status === 'completed' ? 'completed' : 'failed',
        errorMessage: result.error_message || undefined,
        metadata: {
          jobId: jobId,
          attempts: (job.attempts || 0) + 1,
        },
      });

      // Deduct credits from tenant's balance
      if (result.credits_consumed && result.credits_consumed > 0) {
        await deductCredits(execution.tenantId, result.credits_consumed);
      }
    }

    // Send completion notification
    await notifyExecutionComplete({
      executionId: execution.id,
      tenantId: execution.tenantId,
      userId: execution.userId,
      status: result.status,
      crewTemplateId: execution.crewTemplateId,
      entityType: execution.entityType,
      entityId: execution.entityId,
      errorMessage: result.error_message,
    });

    console.log(`Job ${jobId} completed successfully`);
  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error);

    // Increment attempts
    const newAttempts = (job.attempts || 0) + 1;
    const shouldRetry = newAttempts < (job.maxAttempts || MAX_ATTEMPTS);

    // Update job with error
    await db
      .update(aiExecutionJobs)
      .set({
        status: shouldRetry ? 'pending' : 'failed',
        attempts: newAttempts,
        lastError: error.message,
        errorDetails: {
          message: error.message,
          stack: error.stack,
        },
        completedAt: shouldRetry ? null : new Date(),
      })
      .where(eq(aiExecutionJobs.id, jobId));

    // Update execution if this was the last attempt
    if (!shouldRetry) {
      await db
        .update(aiExecutions)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message,
          errorDetails: {
            message: error.message,
            stack: error.stack,
          },
        })
        .where(eq(aiExecutions.id, execution.id));

      // Track failed execution (no tokens consumed)
      await trackFailure({
        tenantId: execution.tenantId,
        userId: execution.userId,
        executionId: execution.id,
        crewTemplateId: execution.crewTemplateId,
        entityType: execution.entityType || undefined,
        entityId: execution.entityId || undefined,
        modelName: 'unknown',
        executionTimeSeconds: undefined,
        errorMessage: error.message,
        metadata: {
          jobId: jobId,
          attempts: newAttempts,
          failedAfterRetries: true,
        },
      });

      // Send failure notification
      await notifyExecutionComplete({
        executionId: execution.id,
        tenantId: execution.tenantId,
        userId: execution.userId,
        status: 'failed',
        crewTemplateId: execution.crewTemplateId,
        entityType: execution.entityType,
        entityId: execution.entityId,
        errorMessage: error.message,
      });
    }
  }
}

async function pollForJobs() {
  try {
    // Find pending jobs
    const pendingJobs = await db.query.aiExecutionJobs.findMany({
      where: eq(aiExecutionJobs.status, 'pending'),
      limit: 10,
      orderBy: (jobs, { desc }) => [desc(jobs.priority), jobs.createdAt],
    });

    if (pendingJobs.length > 0) {
      console.log(`Found ${pendingJobs.length} pending jobs`);

      // Process jobs sequentially (can be parallelized later)
      for (const job of pendingJobs) {
        await processJob(job.id);
      }
    }
  } catch (error) {
    console.error('Error polling for jobs:', error);
  }
}

async function main() {
  console.log('AI Execution Worker starting...');
  console.log(`AI Service URL: ${AI_SERVICE_URL}`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Poll for jobs continuously
  while (true) {
    await pollForJobs();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down worker...');
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error in worker:', error);
  process.exit(1);
});
