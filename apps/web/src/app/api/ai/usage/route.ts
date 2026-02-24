/**
 * AI Usage Analytics API
 *
 * GET /api/ai/usage - Get usage summary for tenant
 * Query params:
 *  - tenantId: string (required)
 *  - startDate: ISO date string (optional, defaults to 30 days ago)
 *  - endDate: ISO date string (optional, defaults to now)
 *  - period: 'day' | 'week' | 'month' | 'all' (shortcut for date ranges)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUsageSummary } from '@/lib/ai/usage-tracker';
import { db } from '@wf/db';
import { aiUsage } from '@wf/db';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const period = searchParams.get('period') || 'month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Calculate date range
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    let startDate: Date;

    if (startDateParam) {
      startDate = new Date(startDateParam);
    } else {
      switch (period) {
        case 'day':
          startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(endDate);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
        default:
          startDate = new Date(endDate);
          startDate.setMonth(startDate.getMonth() - 1);
      }
    }

    // Get usage summary
    const summary = await getUsageSummary(tenantId, startDate, endDate);

    // Get recent executions
    const recentUsage = await db
      .select({
        id: aiUsage.id,
        createdAt: aiUsage.createdAt,
        crewTemplateId: aiUsage.crewTemplateId,
        modelName: aiUsage.modelName,
        totalTokens: aiUsage.totalTokens,
        creditsConsumed: aiUsage.creditsConsumed,
        estimatedCostUsd: aiUsage.estimatedCostUsd,
        status: aiUsage.status,
        executionTimeSeconds: aiUsage.executionTimeSeconds,
      })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.tenantId, tenantId),
          gte(aiUsage.createdAt, startDate),
          lte(aiUsage.createdAt, endDate)
        )
      )
      .orderBy(desc(aiUsage.createdAt))
      .limit(50);

    return NextResponse.json({
      summary: {
        ...summary,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
      recentUsage,
    });
  } catch (error: any) {
    console.error('Error fetching AI usage:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch AI usage' },
      { status: 500 }
    );
  }
}
