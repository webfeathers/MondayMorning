/**
 * Health check endpoint for monitoring and load balancers
 */

import { NextResponse } from 'next/server';
import { db } from '@wf/db';

export async function GET() {
  try {
    // Check database connection
    await db.execute('SELECT 1');

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'web',
      version: process.env.npm_package_version || '0.0.1',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        service: 'web',
      },
      { status: 503 }
    );
  }
}
