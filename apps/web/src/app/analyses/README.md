# Analyses Feature

This feature provides UI for viewing AI crew execution history and results.

## Routes

### List Page (`/analyses`)
- Lists all past AI executions for the tenant
- Filters by status: all, completed, failed, pending, running
- Shows execution metadata: crew template, status, credits, duration
- Links to detail pages

### Detail Page (`/analyses/[id]`)
- Shows full execution results
- Three tabs:
  - **Result**: Structured JSON output from the crew
  - **Raw**: Raw text output from the AI model
  - **Details**: Technical details (tokens, model, metadata)

## API Endpoints

### `GET /api/analyses`
Query params:
- `tenantId` (required): Tenant to filter by
- `status`: Filter by execution status (all, completed, failed, pending, running)
- `crewTemplateId`: Filter by specific crew template
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset (default: 0)

Response:
```json
{
  "executions": [...],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### `GET /api/analyses/[id]`
Returns full execution details including results, raw output, and metadata.

## Components

- `apps/web/src/app/analyses/page.tsx` - List page
- `apps/web/src/app/analyses/[id]/page.tsx` - Detail page
- `apps/web/src/components/app-sidebar.tsx` - Navigation link

## Usage Flow

1. User runs an AI crew execution via `/api/crews/execute`
2. Worker processes the job asynchronously
3. Results are stored in `ai_executions` table
4. User navigates to `/analyses` to see all executions
5. User clicks on an execution to view detailed results at `/analyses/[id]`

## Future Enhancements

- Export results as PDF/CSV
- Share analysis results with team members
- Re-run analysis with same parameters
- Compare multiple executions side-by-side
- Real-time status updates via WebSockets
- Rich formatting for structured results (markdown, charts)
- Filtering by date range, user, entity
