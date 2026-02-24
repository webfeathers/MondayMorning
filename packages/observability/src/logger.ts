/**
 * Structured logger using Pino
 *
 * Provides consistent logging across all services with tenant context
 */

import pino from 'pino';
import type { Logger, LoggerOptions } from 'pino';

/**
 * Logger context that should be included in every log
 */
export interface LogContext {
  traceId?: string;
  tenantId?: string;
  userId?: string;
  service?: string;
  environment?: string;
  [key: string]: unknown;
}

/**
 * Create a logger instance with default configuration
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const baseOptions: LoggerOptions = {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

    // Use pretty printing in development
    ...(isDevelopment && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    }),

    // Base context
    base: {
      service: process.env.SERVICE_NAME || 'web',
      environment: process.env.NODE_ENV || 'development',
    },

    // Timestamp
    timestamp: pino.stdTimeFunctions.isoTime,

    // Error serialization
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  };

  return pino({ ...baseOptions, ...options });
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(parent: Logger, context: LogContext): Logger {
  return parent.child(context);
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Log with tenant context
 */
export function logWithContext(
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  message: string,
  context: LogContext = {},
  data?: Record<string, unknown>
) {
  const logData = {
    ...context,
    ...data,
  };

  logger[level](logData, message);
}

/**
 * Convenience methods
 */
export const log = {
  trace: (message: string, context?: LogContext, data?: Record<string, unknown>) =>
    logWithContext('trace', message, context, data),

  debug: (message: string, context?: LogContext, data?: Record<string, unknown>) =>
    logWithContext('debug', message, context, data),

  info: (message: string, context?: LogContext, data?: Record<string, unknown>) =>
    logWithContext('info', message, context, data),

  warn: (message: string, context?: LogContext, data?: Record<string, unknown>) =>
    logWithContext('warn', message, context, data),

  error: (message: string, context?: LogContext, data?: Record<string, unknown>) =>
    logWithContext('error', message, context, data),

  fatal: (message: string, context?: LogContext, data?: Record<string, unknown>) =>
    logWithContext('fatal', message, context, data),
};

/**
 * Create request logger with automatic context extraction
 */
export function createRequestLogger(headers: Record<string, string | undefined>): Logger {
  const traceId = headers['x-trace-id'];
  const tenantId = headers['x-tenant-id'];
  const userId = headers['x-user-id'];

  return createChildLogger(logger, {
    traceId,
    tenantId,
    userId,
  });
}
