/**
 * Sentry configuration for worker service
 */

import { initSentryNode } from '@wf/observability';

// Initialize Sentry for worker
initSentryNode({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
  enabled: process.env.SENTRY_ENABLED === 'true',
});

export {}; // Make this a module
