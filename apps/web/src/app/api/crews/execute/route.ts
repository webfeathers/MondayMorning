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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing executionId parameter' },
        { status: 400 }
      );
    }

    const execution = await db.query.aiExecutions.findFirst({
      where: eq(aiExecutions.id, executionId),
    });

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

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
    console.error('Error fetching execution:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch execution' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crewTemplateId, entityType, entityId, tenantId, userId } = body;

    // Validate required fields
    if (!crewTemplateId || !tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: crewTemplateId, tenantId, userId' },
        { status: 400 }
      );
    }

    // Assemble context for the crew
    const assembledContext = await assembleContext(
      crewTemplateId as CrewTemplateId,
      entityId,
      tenantId
    );

    // Estimate cost before creating execution
    const estimate = estimateCost(crewTemplateId as CrewTemplateId, assembledContext);

    // Create execution record
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
    await db.insert(aiExecutionJobs).values({
      tenantId,
      executionId: execution.id,
      status: 'pending',
      priority: 0,
    });

    return NextResponse.json({
      executionId: execution.id,
      status: execution.status,
      estimate,
    });
  } catch (error: any) {
    console.error('Error creating crew execution:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create crew execution' },
      { status: 500 }
    );
  }
}
