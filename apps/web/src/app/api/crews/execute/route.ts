/**
 * API routes for AI crew executions.
 * POST: Creates execution record and enqueues job for async processing.
 * GET: Retrieves execution status and results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@wf/db';
import { aiExecutions, aiExecutionJobs } from '@wf/db';
import { eq } from 'drizzle-orm';
import { assembleContext } from '@/lib/ai/context-assembler';
import { estimateCost } from '@/lib/ai/estimator';
import type { CrewTemplateId } from '@/lib/ai/types';
import { createApiLogger, logSuccess, logError } from '@/lib/api-logger';
import { startTimer } from '@wf/observability';

export async function GET(request: NextRequest) {
  const logger = createApiLogger(request);
  const timer = startTimer('get-execution');

  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');

    logger.info('Fetching AI execution', { executionId });

    if (!executionId) {
      logger.warn('Missing executionId parameter');
      return NextResponse.json(
        { error: 'Missing executionId parameter' },
        { status: 400 }
      );
    }

    const execution = await db.query.aiExecutions.findFirst({
      where: eq(aiExecutions.id, executionId),
    });

    if (!execution) {
      logger.warn('Execution not found', { executionId });
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    timer.end(logger, { executionId, status: execution.status });
    logSuccess(logger, 'AI execution fetched successfully', {
      executionId,
      status: execution.status,
    });

    return NextResponse.json({
      id: execution.id,
      status: execution.status,
      crewTemplateId: execution.crewTemplateId,
      entityType: execution.entityType,
      entityId: execution.entityId,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      result: execution.result,
      errorMessage: execution.errorMessage,
      tokenUsage: execution.tokenUsage,
      creditsConsumed: execution.creditsConsumed,
      executionTimeSeconds: execution.executionTimeSeconds,
      createdAt: execution.createdAt,
    });
  } catch (error: any) {
    timer.end(logger);
    logError(logger, 'Error fetching execution', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch execution' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const logger = createApiLogger(request);
  const timer = startTimer('create-execution');

  try {
    const body = await request.json();
    const { crewTemplateId, entityType, entityId, tenantId, userId } = body;

    logger.info('Creating AI crew execution', {
      crewTemplateId,
      entityType,
      entityId,
      tenantId,
      userId,
    });

    // Validate required fields
    if (!crewTemplateId || !tenantId || !userId) {
      logger.warn('Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: crewTemplateId, tenantId, userId' },
        { status: 400 }
      );
    }

    // Assemble context for the crew
    logger.debug('Assembling context', { crewTemplateId, entityId });
    const assembledContext = await assembleContext(
      crewTemplateId as CrewTemplateId,
      entityId,
      tenantId
    );

    // Estimate cost before creating execution
    logger.debug('Estimating cost', { estimatedTokens: assembledContext.metadata.estimatedTokens });
    const estimate = estimateCost(crewTemplateId as CrewTemplateId, assembledContext);

    // Create execution record
    logger.debug('Creating execution record');
    const [execution] = await db
      .insert(aiExecutions)
      .values({
        tenantId,
        userId,
        crewTemplateId,
        entityType,
        entityId,
        status: 'pending',
        contextData: assembledContext.contextData,
        metadata: {
          ...assembledContext.metadata,
          estimate,
        },
      })
      .returning();

    // Create job for async processing
    logger.debug('Enqueueing job', { executionId: execution.id });
    await db.insert(aiExecutionJobs).values({
      tenantId,
      executionId: execution.id,
      status: 'pending',
      priority: 0,
    });

    timer.end(logger, {
      executionId: execution.id,
      estimatedCredits: estimate.estimatedCredits,
    });
    logSuccess(logger, 'AI crew execution created', {
      executionId: execution.id,
      crewTemplateId,
      estimatedCredits: estimate.estimatedCredits,
    });

    return NextResponse.json({
      executionId: execution.id,
      status: execution.status,
      estimate,
    });
  } catch (error: any) {
    timer.end(logger);
    logError(logger, 'Error creating crew execution', error, {
      crewTemplateId,
      entityType,
      entityId,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to create crew execution' },
      { status: 500 }
    );
  }
}
