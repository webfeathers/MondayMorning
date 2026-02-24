/**
 * Sentry configuration for Next.js edge runtime (middleware)
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  enabled: process.env.SENTRY_ENABLED === 'true',

  // Edge runtime has limitations - keep config minimal
});
