# @wf/observability

Observability package providing structured logging, error tracking, and distributed tracing for the WF Platform.

## Features

- **Structured Logging** with Pino
- **Error Tracking** with Sentry
- **Distributed Tracing** with trace IDs
- **Request Logging** middleware for Next.js
- **Performance Monitoring** utilities

## Installation

This package is part of the monorepo and is automatically available to all workspace packages.

```typescript
import { logger, log, captureException, startTimer } from '@wf/observability';
```

## Usage

### Structured Logging

```typescript
import { logger, log, createChildLogger } from '@wf/observability';

// Simple logging
logger.info('User logged in');
logger.error('Failed to process payment', { userId: '123', amount: 100 });

// Convenience methods with context
log.info('Processing order', { tenantId, userId }, { orderId: '456' });

// Child logger with persistent context
const requestLogger = createChildLogger(logger, {
  traceId: 'abc-123',
  tenantId: 'tenant-1',
});

requestLogger.info('Request received');
requestLogger.error('Request failed');
```

### Sentry Error Tracking

```typescript
import {
  initSentryNode,
  setSentryUser,
  setSentryTenant,
  captureException
} from '@wf/observability';

// Initialize Sentry (in app startup)
initSentryNode({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.NODE_ENV!,
  tracesSampleRate: 0.1,
});

// Set user context
setSentryUser('user-123', 'user@example.com');

// Set tenant context
setSentryTenant('tenant-1', 'Acme Corp');

// Capture errors with context
try {
  await processPayment();
} catch (error) {
  captureException(error as Error, {
    tenantId: 'tenant-1',
    userId: 'user-123',
    traceId: 'abc-123',
    extra: { amount: 100, currency: 'USD' },
  });
  throw error;
}
```

### Trace IDs

```typescript
import { generateTraceId, getOrCreateTraceId } from '@wf/observability';

// Generate new trace ID
const traceId = generateTraceId();

// Get existing or create new from headers
const headers = request.headers;
const traceId = getOrCreateTraceId({
  'x-trace-id': headers.get('x-trace-id'),
  'x-request-id': headers.get('x-request-id'),
});
```

### Next.js Middleware

```typescript
import { getRequestLogger, logApiRequest, withLogging } from '@wf/observability';

// In API route
export async function GET(request: NextRequest) {
  const logger = getRequestLogger(request);

  logger.info('Fetching user data');

  try {
    const data = await fetchUserData();
    logger.info('User data fetched successfully');
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Failed to fetch user data', { error });
    throw error;
  }
}

// Or use withLogging wrapper
export const GET = withLogging(async (request: NextRequest) => {
  const data = await fetchUserData();
  return NextResponse.json(data);
});
```

### Performance Monitoring

```typescript
import { startTimer, getRequestLogger } from '@wf/observability';

export async function GET(request: NextRequest) {
  const logger = getRequestLogger(request);
  const timer = startTimer('fetch-user-data');

  const data = await fetchUserData();

  const durationMs = timer.end(logger, { recordCount: data.length });
  // Logs: "fetch-user-data completed" with durationMs

  return NextResponse.json(data);
}
```

## Environment Variables

### Logging
- `LOG_LEVEL` - Log level (default: `debug` in dev, `info` in prod)
- `SERVICE_NAME` - Service identifier (default: `web`)

### Sentry
- `SENTRY_DSN` - Sentry DSN for error tracking
- `SENTRY_ENVIRONMENT` - Environment name (production, staging, etc.)
- `SENTRY_RELEASE` - Release version

## Best Practices

### Always Include Tenant Context

```typescript
log.info('Processing request', {
  tenantId: 'tenant-1',
  userId: 'user-123',
  traceId: 'abc-123'
});
```

### Use Child Loggers for Scoped Context

```typescript
// At request start
const requestLogger = createChildLogger(logger, {
  traceId,
  tenantId,
  userId,
});

// Throughout request handling
requestLogger.info('Step 1');
requestLogger.info('Step 2');
requestLogger.info('Step 3');
// All logs automatically include traceId, tenantId, userId
```

### Log Structured Data

```typescript
// Good
logger.info('Payment processed', {
  paymentId: 'pay-123',
  amount: 100,
  currency: 'USD',
  method: 'card',
});

// Avoid
logger.info(`Payment pay-123 for $100 USD processed via card`);
```

### Use Performance Timers

```typescript
const timer = startTimer('database-query');
const results = await db.query(...);
timer.end(logger, { resultCount: results.length });
```

### Capture Errors with Context

```typescript
try {
  await riskyOperation();
} catch (error) {
  captureException(error as Error, {
    tenantId,
    userId,
    traceId,
    extra: { operationDetails },
  });
  throw error;
}
```

## Development

The logger uses pretty-printing in development for better readability:

```
[08:30:15.123] INFO: User logged in
    userId: "user-123"
    tenantId: "tenant-1"
```

In production, logs are output as JSON for structured log aggregation:

```json
{"level":30,"time":"2024-02-24T08:30:15.123Z","msg":"User logged in","userId":"user-123","tenantId":"tenant-1"}
```
