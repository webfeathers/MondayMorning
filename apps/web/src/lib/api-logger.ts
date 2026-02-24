/**
 * API logging utilities
 *
 * Provides convenience functions for adding structured logging to API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestLogger, logApiRequest, logApiResponse } from '@wf/observability';
import type { Logger } from 'pino';

/**
 * Extract context from request headers
 */
export function getContextFromRequest(request: NextRequest) {
  return {
    traceId: request.headers.get('x-trace-id') || undefined,
    tenantId: request.headers.get('x-tenant-id') || undefined,
    userId: request.headers.get('x-user-id') || undefined,
  };
}

/**
 * Create a logger for an API route handler
 */
export function createApiLogger(request: NextRequest): Logger {
  return getRequestLogger(request);
}

/**
 * Wrap an API route handler with automatic logging
 *
 * Logs request/response, measures duration, and handles errors
 *
 * @example
 * export const GET = withApiLogging(async (request) => {
 *   const logger = createApiLogger(request);
 *   logger.info('Fetching data');
 *   const data = await fetchData();
 *   return NextResponse.json(data);
 * });
 */
export function withApiLogging<T extends (request: NextRequest, ...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options?: {
    logRequest?: boolean;
    logResponse?: boolean;
    logErrors?: boolean;
  }
): T {
  const {
    logRequest = true,
    logResponse = true,
    logErrors = true,
  } = options || {};

  return (async (request: NextRequest, ...args: any[]) => {
    const startTime = Date.now();
    const logger = createApiLogger(request);
    const context = getContextFromRequest(request);

    // Log incoming request
    if (logRequest) {
      logApiRequest(request, context);
    }

    try {
      const response = await handler(request, ...args);
      const durationMs = Date.now() - startTime;

      // Log successful response
      if (logResponse) {
        logApiResponse(request, response.status, durationMs, { ...context });
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (logErrors) {
        logger.error('API request failed', {
          ...context,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          durationMs,
        });
      }

      throw error;
    }
  }) as T;
}

/**
 * Log a successful API operation
 */
export function logSuccess(
  logger: Logger,
  message: string,
  data?: Record<string, unknown>
) {
  logger.info(message, data);
}

/**
 * Log an API error
 */
export function logError(
  logger: Logger,
  message: string,
  error: Error | unknown,
  additionalContext?: Record<string, unknown>
) {
  logger.error(message, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...additionalContext,
  });
}

/**
 * Log a warning
 */
export function logWarning(
  logger: Logger,
  message: string,
  data?: Record<string, unknown>
) {
  logger.warn(message, data);
}

/**
 * Log debug information
 */
export function logDebug(
  logger: Logger,
  message: string,
  data?: Record<string, unknown>
) {
  logger.debug(message, data);
}
