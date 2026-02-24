/**
 * Sentry configuration for error tracking and performance monitoring
 */

import * as Sentry from '@sentry/nextjs';
import type { BrowserOptions, NodeOptions } from '@sentry/nextjs';

/**
 * Common Sentry configuration
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  enabled?: boolean;
}

/**
 * Initialize Sentry for Next.js (browser)
 */
export function initSentryBrowser(config: SentryConfig) {
  if (!config.enabled || !config.dsn) {
    console.log('Sentry disabled or no DSN provided');
    return;
  }

  const options: BrowserOptions = {
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,

    // Performance monitoring
    tracesSampleRate: config.tracesSampleRate ?? 0.1,

    // Set sample rate for profiling
    profilesSampleRate: config.profilesSampleRate ?? 0.1,

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Session replay sample rate
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Filter out known errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random network errors
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
    ],

    // Before send hook for additional filtering
    beforeSend(event, hint) {
      // Filter out errors from browser extensions
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        (frame) => frame.filename?.includes('chrome-extension://') ||
                   frame.filename?.includes('moz-extension://')
      )) {
        return null;
      }

      return event;
    },
  };

  Sentry.init(options);
}

/**
 * Initialize Sentry for Node.js (server/worker)
 */
export function initSentryNode(config: SentryConfig) {
  if (!config.enabled || !config.dsn) {
    console.log('Sentry disabled or no DSN provided');
    return;
  }

  const options: NodeOptions = {
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,

    // Performance monitoring
    tracesSampleRate: config.tracesSampleRate ?? 0.1,

    // Set sample rate for profiling
    profilesSampleRate: config.profilesSampleRate ?? 0.1,

    // Integrations
    integrations: [
      Sentry.httpIntegration(),
      Sentry.nativeNodeFetchIntegration(),
    ],
  };

  Sentry.init(options);
}

/**
 * Set user context in Sentry
 */
export function setSentryUser(userId: string, email?: string, username?: string) {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Set tenant context in Sentry
 */
export function setSentryTenant(tenantId: string, tenantName?: string) {
  Sentry.setTag('tenant_id', tenantId);
  if (tenantName) {
    Sentry.setTag('tenant_name', tenantName);
  }

  Sentry.setContext('tenant', {
    id: tenantId,
    name: tenantName,
  });
}

/**
 * Clear user context from Sentry
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Capture exception with context
 */
export function captureException(
  error: Error,
  context?: {
    tenantId?: string;
    userId?: string;
    traceId?: string;
    extra?: Record<string, unknown>;
  }
) {
  if (context?.tenantId) {
    Sentry.setTag('tenant_id', context.tenantId);
  }
  if (context?.userId) {
    Sentry.setTag('user_id', context.userId);
  }
  if (context?.traceId) {
    Sentry.setTag('trace_id', context.traceId);
  }
  if (context?.extra) {
    Sentry.setContext('extra', context.extra);
  }

  Sentry.captureException(error);
}

/**
 * Capture message with context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tenantId?: string;
    userId?: string;
    traceId?: string;
    extra?: Record<string, unknown>;
  }
) {
  if (context?.tenantId) {
    Sentry.setTag('tenant_id', context.tenantId);
  }
  if (context?.userId) {
    Sentry.setTag('user_id', context.userId);
  }
  if (context?.traceId) {
    Sentry.setTag('trace_id', context.traceId);
  }
  if (context?.extra) {
    Sentry.setContext('extra', context.extra);
  }

  Sentry.captureMessage(message, level);
}

/**
 * Start a new Sentry transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  level?: Sentry.SeverityLevel,
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}
