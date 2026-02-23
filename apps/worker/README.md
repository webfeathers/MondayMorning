# Worker Service

Background job processing service for the multi-tenant SaaS platform. Handles CRM synchronization, tenant lifecycle management, and scheduled tasks.

## Features

- **Job Queue Processing**: PostgreSQL-based job queue with `FOR UPDATE SKIP LOCKED`
- **Job Scheduling**: Cron-based scheduled job execution
- **Retry Engine**: Exponential backoff with jitter for failed jobs
- **Circuit Breaker**: Protects external APIs from cascading failures
- **Quota Management**: Tracks and enforces CRM API rate limits
- **Stall Detection**: Automatically recovers stuck jobs
- **Tenant Lifecycle**: Provision, suspend, reactivate, and purge tenants

## Job Types

### CRM Synchronization

- `sync_crm`: Syncs deals, accounts, contacts, and tickets from external CRMs
- Supports Salesforce, HubSpot, and other CRM providers
- Incremental and full sync modes
- Stage and field mapping support

### Tenant Lifecycle

- `provision_tenant`: Creates new tenant with initial configuration
- `suspend_tenant`: Suspends tenant access and disables integrations
- `reactivate_tenant`: Reactivates suspended tenant
- `purge_tenant`: Permanently deletes tenant data after grace period

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+

### Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Run database migrations:
   ```bash
   pnpm --filter @wf/db migrate
   ```

4. Start the worker:
   ```bash
   pnpm --filter @wf/worker dev
   ```

The worker will be available at `http://localhost:3001`

### Using Docker Compose

Run the worker with PostgreSQL:

```bash
docker-compose up
```

This starts:
- PostgreSQL database on port 5432
- Worker service on port 3001

## Production Deployment

### Docker

Build and run with Docker:

```bash
# Build
docker build -t worker:latest .

# Run
docker run -d \
  --name worker \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  worker:latest
```

### Kubernetes

Deploy to Kubernetes:

```bash
# Apply configurations
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -l app=worker
kubectl logs -f deployment/worker
```

The Kubernetes deployment includes:
- Deployment with 3 replicas
- ConfigMap for configuration
- Secret for sensitive data
- Service for internal communication
- HorizontalPodAutoscaler for auto-scaling

### Environment Variables

See [ENV.md](./ENV.md) for complete environment variable documentation.

Required:
- `DATABASE_URL`: PostgreSQL connection string

Optional (with defaults):
- `WORKER_ID`: Unique worker identifier (default: hostname)
- `PORT`: HTTP port (default: 3001)
- `SCHEDULER_CHECK_INTERVAL`: Job check interval (default: 60000ms)
- Circuit breaker, retry, and quota thresholds

## API Endpoints

### Health Check

```bash
GET /health
```

Returns worker health status:

```json
{
  "status": "ok",
  "uptime": 3600,
  "version": "0.0.1"
}
```

### Metrics

```bash
GET /metrics
```

Returns job queue metrics, circuit breaker status, and quota levels:

```json
{
  "jobs": {
    "queued": 10,
    "running": 2,
    "completed": 150,
    "failed": 3
  },
  "circuitBreakers": {
    "crm:salesforce": {
      "state": "CLOSED",
      "failureCount": 0,
      "successCount": 50,
      "lastFailureAt": null
    }
  },
  "quotaStatus": {
    "salesforce": {
      "status": {
        "limit": 1000,
        "remaining": 750,
        "percentUsed": 0.25,
        "resetAt": "2024-01-01T12:00:00Z"
      },
      "checkedAt": "2024-01-01T11:00:00Z"
    }
  }
}
```

## Testing

Run tests:

```bash
# All tests
pnpm --filter @wf/worker test

# Watch mode
pnpm --filter @wf/worker test:watch

# Coverage
pnpm --filter @wf/worker test:coverage
```

## Architecture

### Job Processing Flow

1. **Scheduler** checks for scheduled jobs every minute
2. **Processor** claims and executes jobs from the queue
3. **Retry Engine** handles failed jobs with exponential backoff
4. **Circuit Breaker** protects external API calls
5. **Quota Manager** enforces API rate limits
6. **Stall Detection** recovers stuck jobs

### Job States

- `queued`: Waiting to be processed
- `running`: Currently being processed
- `completed`: Successfully completed
- `failed`: Failed after max retries

### Concurrency

Multiple workers can run concurrently:
- Jobs are claimed using `FOR UPDATE SKIP LOCKED`
- No coordination mechanism needed
- Horizontally scalable

## Monitoring

### Key Metrics

Monitor these metrics for operational health:

- **Job Queue Depth**: `jobs.queued`
- **Job Failure Rate**: `jobs.failed` / time
- **Circuit Breaker State**: `circuitBreakers.*.state`
- **API Quota Usage**: `quotaStatus.*.status.percentUsed`

### Alerts

Set up alerts for:
- High job queue depth (> 1000)
- High failure rate (> 5% of jobs)
- Circuit breaker OPEN state
- API quota CRITICAL (< 10%)
- Worker unhealthy (health check failing)

## Troubleshooting

### Worker not processing jobs

Check:
1. Database connectivity: `psql $DATABASE_URL`
2. Job queue: `SELECT * FROM jobs WHERE status = 'queued';`
3. Worker logs: `kubectl logs deployment/worker`

### Circuit breaker stuck OPEN

The circuit breaker opens after 5 consecutive failures. To reset:
1. Fix the underlying issue (API down, credentials invalid)
2. Wait for automatic transition to HALF_OPEN (1 minute)
3. Or manually restart the worker

### API quota exhausted

When quota reaches CRITICAL level (< 10%):
1. Jobs will be paused automatically
2. Wait for quota reset (check `quotaStatus.*.status.resetAt`)
3. Or increase quota with your CRM provider

### Stalled jobs

Jobs running > 15 minutes are automatically reset:
1. Check `JOB_STALL_TIMEOUT_MS` setting
2. Increase timeout if jobs legitimately take longer
3. Check for deadlocks in database

## License

MIT
