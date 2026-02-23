# Worker Environment Variables

This document describes all environment variables used by the worker service.

## Required Variables

### Database

- **`DATABASE_URL`** (required)
  - PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://postgres:postgres@localhost:5432/workflow_dev`

## Optional Variables

### Worker Configuration

- **`WORKER_ID`** (optional)
  - Unique identifier for this worker instance
  - Default: hostname or generated UUID
  - Example: `worker-1`, `worker-prod-abc123`

- **`PORT`** (optional)
  - HTTP server port for health checks and metrics
  - Default: `3001`
  - Example: `3001`

- **`NODE_ENV`** (optional)
  - Node environment
  - Values: `development`, `production`, `test`
  - Default: `production`
  - Example: `production`

### Job Scheduler

- **`SCHEDULER_CHECK_INTERVAL`** (optional)
  - How often to check for scheduled jobs (milliseconds)
  - Default: `60000` (1 minute)
  - Example: `60000`

### Stall Detection

- **`STALL_CHECK_INTERVAL`** (optional)
  - How often to check for stalled jobs (milliseconds)
  - Default: `60000` (1 minute)
  - Example: `60000`

- **`JOB_STALL_TIMEOUT_MS`** (optional)
  - How long a job can run before being considered stalled (milliseconds)
  - Default: `900000` (15 minutes)
  - Example: `900000`

### Retry Engine

- **`RETRY_BASE_DELAY_MS`** (optional)
  - Base delay for exponential backoff (milliseconds)
  - Default: `5000` (5 seconds)
  - Example: `5000`

- **`RETRY_MAX_DELAY_MS`** (optional)
  - Maximum retry delay (milliseconds)
  - Default: `3600000` (1 hour)
  - Example: `3600000`

- **`RETRY_JITTER_MS`** (optional)
  - Random jitter to add to retry delays (milliseconds)
  - Default: `1000` (1 second)
  - Example: `1000`

### Circuit Breaker

- **`CB_FAILURE_THRESHOLD`** (optional)
  - Number of failures before opening circuit
  - Default: `5`
  - Example: `5`

- **`CB_SUCCESS_THRESHOLD`** (optional)
  - Number of successes in HALF_OPEN state to close circuit
  - Default: `2`
  - Example: `2`

- **`CB_TIMEOUT_MS`** (optional)
  - Time to wait before transitioning from OPEN to HALF_OPEN (milliseconds)
  - Default: `60000` (1 minute)
  - Example: `60000`

### Quota Manager

- **`QUOTA_WARNING_THRESHOLD`** (optional)
  - Remaining quota threshold for WARNING level (decimal)
  - Default: `0.25` (25%)
  - Example: `0.25`

- **`QUOTA_CRITICAL_THRESHOLD`** (optional)
  - Remaining quota threshold for CRITICAL level (decimal)
  - Default: `0.10` (10%)
  - Example: `0.10`

## Example .env File

```env
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workflow_dev

# Optional - Worker
WORKER_ID=worker-dev-1
PORT=3001
NODE_ENV=development

# Optional - Job Scheduler
SCHEDULER_CHECK_INTERVAL=60000

# Optional - Stall Detection
STALL_CHECK_INTERVAL=60000
JOB_STALL_TIMEOUT_MS=900000

# Optional - Retry Engine
RETRY_BASE_DELAY_MS=5000
RETRY_MAX_DELAY_MS=3600000
RETRY_JITTER_MS=1000

# Optional - Circuit Breaker
CB_FAILURE_THRESHOLD=5
CB_SUCCESS_THRESHOLD=2
CB_TIMEOUT_MS=60000

# Optional - Quota Manager
QUOTA_WARNING_THRESHOLD=0.25
QUOTA_CRITICAL_THRESHOLD=0.10
```

## Production Considerations

### Secrets Management

Never commit actual secrets to version control. Use a secrets management solution:

- **Kubernetes**: Use Secrets with external secret operators (e.g., AWS Secrets Manager, HashiCorp Vault)
- **Docker**: Use Docker Secrets or environment variable injection
- **Cloud Platforms**: Use platform-specific secret management (AWS Parameter Store, GCP Secret Manager, Azure Key Vault)

### High Availability

For production deployments:

1. **Multiple Workers**: Run at least 3 worker instances for high availability
2. **Load Distribution**: Workers will automatically distribute jobs using `FOR UPDATE SKIP LOCKED`
3. **Graceful Shutdown**: Workers handle SIGTERM gracefully, completing in-flight jobs
4. **Health Checks**: Monitor `/health` endpoint for liveness and readiness
5. **Metrics**: Monitor `/metrics` endpoint for job queue health, circuit breaker status, and quota levels

### Monitoring

Key metrics to monitor:

- **Job Queue Depth**: Number of queued jobs
- **Job Processing Rate**: Jobs processed per minute
- **Job Failure Rate**: Failed jobs per minute
- **Circuit Breaker State**: OPEN/HALF_OPEN/CLOSED status per provider
- **API Quota Usage**: Remaining quota percentage per provider
- **Worker Health**: Uptime, memory, CPU usage

### Scaling

The worker service can be scaled horizontally:

- **Kubernetes**: Use HorizontalPodAutoscaler (HPA) based on CPU/memory or custom metrics
- **Docker Compose**: Use `docker-compose scale worker=N`
- **Manual**: Run multiple instances with different `WORKER_ID` values

Workers coordinate through the database using row-level locking, so no additional coordination mechanism is needed.
