/**
 * Analyses/Executions API
 *
 * GET /api/analyses - List past AI executions for a tenant
 * Query params:
 *  - tenantId: string (required)
 *  - status: 'all' | 'completed' | 'failed' | 'pending' | 'running' (optional)
 *  - crewTemplateId: string (optional) - filter by crew template
 *  - limit: number (optional, default 50)
 *  - offset: number (optional, default 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@wf/db';
import { aiExecutions } from '@wf/db';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status') || 'all';
    const crewTemplateId = searchParams.get('crewTemplateId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Build where conditions
    const conditions = [eq(aiExecutions.tenantId, tenantId)];

    if (status !== 'all') {
      conditions.push(eq(aiExecutions.status, status));
    }

    if (crewTemplateId) {
      conditions.push(eq(aiExecutions.crewTemplateId, crewTemplateId));
    }

    // Get executions with user info
    const executions = await db
      .select({
        id: aiExecutions.id,
        crewTemplateId: aiExecutions.crewTemplateId,
        entityType: aiExecutions.entityType,
        entityId: aiExecutions.entityId,
        status: aiExecutions.status,
        startedAt: aiExecutions.startedAt,
        completedAt: aiExecutions.completedAt,
        creditsConsumed: aiExecutions.creditsConsumed,
        executionTimeSeconds: aiExecutions.executionTimeSeconds,
        modelName: aiExecutions.modelName,
        errorMessage: aiExecutions.errorMessage,
        createdAt: aiExecutions.createdAt,
        userId: aiExecutions.userId,
      })
      .from(aiExecutions)
      .where(and(...conditions))
      .orderBy(desc(aiExecutions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(aiExecutions)
      .where(and(...conditions));

    return NextResponse.json({
      executions,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      },
    });
  } catch (error: any) {
    console.error('Error fetching analyses:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analyses' },
      { status: 500 }
    );
  }
}
