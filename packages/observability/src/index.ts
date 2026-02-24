/**
 * Observability Package
 *
 * Provides structured logging, error tracking, and distributed tracing
 * for all services in the WF Platform.
 *
 * @packageDocumentation
 */

// Logger
export {
  createLogger,
  createChildLogger,
  createRequestLogger,
  logger,
  log,
  logWithContext,
  type LogContext,
} from './logger';

// Sentry
export {
  initSentryBrowser,
  initSentryNode,
  setSentryUser,
  setSentryTenant,
  clearSentryUser,
  captureException,
  captureMessage,
  startTransaction,
  addBreadcrumb,
  type SentryConfig,
} from './sentry';

// Trace ID
export {
  generateTraceId,
  getOrCreateTraceId,
  getTenantIdFromHeaders,
  getUserIdFromHeaders,
} from './trace-id';

// Middleware
export {
  addObservabilityHeaders,
  getRequestLogger,
  logApiRequest,
  logApiResponse,
  withLogging,
  startTimer,
  PerformanceTimer,
} from './middleware';
