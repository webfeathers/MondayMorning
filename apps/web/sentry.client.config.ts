/**
 * Sentry configuration for Next.js client (browser)
 */

import { initSentryBrowser } from '@wf/observability';

initSentryBrowser({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  profilesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true',
});
