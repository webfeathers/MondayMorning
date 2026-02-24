/**
 * Single Analysis/Execution Detail API
 *
 * GET /api/analyses/[id] - Get detailed execution results
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@wf/db';
import { aiExecutions } from '@wf/db';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;

    if (!executionId) {
      return NextResponse.json({ error: 'Execution ID is required' }, { status: 400 });
    }

    const execution = await db.query.aiExecutions.findFirst({
      where: eq(aiExecutions.id, executionId),
    });

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    // Return full execution details including results
    return NextResponse.json({
      id: execution.id,
      tenantId: execution.tenantId,
      userId: execution.userId,
      crewTemplateId: execution.crewTemplateId,
      entityType: execution.entityType,
      entityId: execution.entityId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      contextData: execution.contextData,
      crewConfig: execution.crewConfig,
      result: execution.result,
      rawOutput: execution.rawOutput,
      tokenUsage: execution.tokenUsage,
      creditsConsumed: execution.creditsConsumed,
      executionTimeSeconds: execution.executionTimeSeconds,
      modelName: execution.modelName,
      errorMessage: execution.errorMessage,
      errorDetails: execution.errorDetails,
      metadata: execution.metadata,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    });
  } catch (error: any) {
    console.error('Error fetching execution:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch execution' },
      { status: 500 }
    );
  }
}
