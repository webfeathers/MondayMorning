/**
 * Observability middleware for Next.js
 *
 * Adds trace IDs, logging context, and error tracking to requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateTraceId, getOrCreateTraceId } from './trace-id';
import { createRequestLogger } from './logger';
import { addBreadcrumb } from './sentry';

/**
 * Add observability headers to request
 */
export function addObservabilityHeaders(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  // Get or generate trace ID
  const traceId = getOrCreateTraceId({
    'x-trace-id': request.headers.get('x-trace-id') || undefined,
    'x-request-id': request.headers.get('x-request-id') || undefined,
  });

  // Add trace ID to response headers
  response.headers.set('x-trace-id', traceId);

  // Forward trace ID to the request (for API routes)
  request.headers.set('x-trace-id', traceId);

  return response;
}

/**
 * Create logging middleware for API routes
 *
 * Usage in API route:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const logger = getRequestLogger(request);
 *   logger.info('Processing request');
 *   // ...
 * }
 * ```
 */
export function getRequestLogger(request: NextRequest) {
  const headers: Record<string, string | undefined> = {
    'x-trace-id': request.headers.get('x-trace-id') || undefined,
    'x-tenant-id': request.headers.get('x-tenant-id') || undefined,
    'x-user-id': request.headers.get('x-user-id') || undefined,
  };

  return createRequestLogger(headers);
}

/**
 * Log API request details
 */
export function logApiRequest(
  request: NextRequest,
  additionalContext?: Record<string, unknown>
) {
  const logger = getRequestLogger(request);

  const method = request.method;
  const url = request.url;
  const userAgent = request.headers.get('user-agent');

  logger.info('API request', {
    method,
    url,
    userAgent,
    ...additionalContext,
  });

  // Add Sentry breadcrumb
  addBreadcrumb(`${method} ${url}`, 'http', 'info', {
    method,
    url,
    ...additionalContext,
  });
}

/**
 * Log API response details
 */
export function logApiResponse(
  request: NextRequest,
  status: number,
  durationMs: number,
  additionalContext?: Record<string, unknown>
) {
  const logger = getRequestLogger(request);

  const method = request.method;
  const url = request.url;

  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

  logger[level]('API response', {
    method,
    url,
    status,
    durationMs,
    ...additionalContext,
  });

  // Add Sentry breadcrumb
  addBreadcrumb(
    `${method} ${url} → ${status}`,
    'http',
    status >= 500 ? 'error' : status >= 400 ? 'warning' : 'info',
    {
      method,
      url,
      status,
      durationMs,
      ...additionalContext,
    }
  );
}

/**
 * Wrapper for API routes with automatic logging
 */
export function withLogging<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    const request = args[0] as NextRequest;
    const startTime = Date.now();

    // Log incoming request
    logApiRequest(request);

    try {
      const response = await handler(...args);
      const durationMs = Date.now() - startTime;

      // Log response
      logApiResponse(request, response.status, durationMs);

      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const logger = getRequestLogger(request);

      logger.error('API request failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs,
      });

      throw error;
    }
  }) as T;
}

/**
 * Performance timer for measuring operation duration
 */
export class PerformanceTimer {
  private startTime: number;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = Date.now();
  }

  /**
   * End the timer and log duration
   */
  end(logger?: ReturnType<typeof getRequestLogger>, additionalContext?: Record<string, unknown>) {
    const durationMs = Date.now() - this.startTime;

    if (logger) {
      logger.debug(`${this.name} completed`, {
        durationMs,
        ...additionalContext,
      });
    }

    addBreadcrumb(this.name, 'timer', 'info', {
      durationMs,
      ...additionalContext,
    });

    return durationMs;
  }

  /**
   * Get current duration without ending timer
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Create a performance timer
 */
export function startTimer(name: string): PerformanceTimer {
  return new PerformanceTimer(name);
}
