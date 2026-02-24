# AI Execution Worker

This directory contains the worker that processes AI crew execution jobs asynchronously.

## Overview

The async execution flow works as follows:

1. **Web API** (`/api/crews/execute`) creates an execution record and enqueues a job
2. **Worker** polls the job queue and picks up pending jobs
3. **Worker** calls the **AI Service** to execute the crew
4. **Worker** updates the execution record with results
5. **Worker** sends notifications to the user

## Running the Worker

### Development (with auto-reload)
```bash
pnpm --filter @wf/web worker:dev
```

### Production
```bash
pnpm --filter @wf/web worker
```

## Testing the Flow

### Prerequisites

1. **Database**: Ensure migrations are applied
   ```bash
   cd packages/db
   pnpm db:migrate
   pnpm db:seed  # Creates test tenant and user
   ```

2. **AI Service**: Start the Python AI service
   ```bash
   cd apps/ai-service
   python -m uvicorn src.main:app --reload
   ```

   Service should be running at `http://localhost:8000`

3. **Worker**: Start the worker in a separate terminal
   ```bash
   pnpm --filter @wf/web worker:dev
   ```

### Run the Test

```bash
pnpm --filter @wf/web test:execution
```

This test script will:
- Create a test execution and job
- Monitor the job status
- Display results when complete

### Manual API Test

You can also test via API:

```bash
curl -X POST http://localhost:3000/api/crews/execute \
  -H "Content-Type: application/json" \
  -d '{
    "crewTemplateId": "account_health",
    "entityType": "account",
    "entityId": "test-123",
    "tenantId": "YOUR_TENANT_ID",
    "userId": "YOUR_USER_ID"
  }'
```

Then check the execution status:

```bash
curl "http://localhost:3000/api/crews/execute?executionId=EXECUTION_ID"
```

## Architecture

### Worker (`ai-execution-worker.ts`)

- Polls `ai_execution_jobs` table every 5 seconds
- Processes up to 10 pending jobs per poll
- Updates job and execution status throughout processing
- Implements retry logic (max 3 attempts)
- Calls AI service `/api/v1/crews/execute` endpoint
- Sends notifications on completion/failure

### Notifier (`ai-execution-notifier.ts`)

- Creates in-app notifications for users
- Sends on execution completion (success or failure)
- Notifications stored in `notifications` table

### API Route (`/api/crews/execute`)

- **POST**: Creates execution and enqueues job
- **GET**: Retrieves execution status and results

## Environment Variables

```bash
# AI Service URL
AI_SERVICE_URL=http://localhost:8000

# Database (inherited from root .env)
DATABASE_URL=postgresql://...
```

## Troubleshooting

### Worker not picking up jobs

- Check worker is running: `pnpm --filter @wf/web worker:dev`
- Check database connection
- Verify jobs exist: `SELECT * FROM ai_execution_jobs WHERE status = 'pending';`

### AI Service errors

- Verify AI service is running: `curl http://localhost:8000/health`
- Check AI service logs for errors
- Ensure crew template exists

### Jobs stuck in 'processing'

- Restart the worker
- Jobs will timeout and retry automatically after 15 minutes (future feature)

## Next Steps

- Implement stall detection (reset jobs stuck in 'processing')
- Add per-tenant concurrency limits
- Implement priority queue with better scheduling
- Add WebSocket updates for real-time status
