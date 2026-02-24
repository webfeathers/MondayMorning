/**
 * Crew Templates API
 *
 * GET /api/crews/templates - List all available crew templates
 * GET /api/crews/templates?slug=<slug> - Get specific template by slug
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@wf/db';
import { crewTemplates } from '@wf/db';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (slug) {
      // Get specific template by slug
      const template = await db.query.crewTemplates.findFirst({
        where: eq(crewTemplates.slug, slug),
      });

      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      return NextResponse.json(template);
    }

    // List all active templates
    const templates = await db
      .select({
        id: crewTemplates.id,
        name: crewTemplates.name,
        slug: crewTemplates.slug,
        description: crewTemplates.description,
        estimatedCreditCost: crewTemplates.estimatedCreditCost,
        maxContext: crewTemplates.maxContext,
        isActive: crewTemplates.isActive,
      })
      .from(crewTemplates)
      .where(eq(crewTemplates.isActive, true))
      .orderBy(crewTemplates.name);

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Error fetching crew templates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch crew templates' },
      { status: 500 }
    );
  }
}
