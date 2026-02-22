# Multi-Tenant SaaS Platform Design

**Date:** 2026-02-22
**Status:** Approved
**Working Name:** WF (WebFeathers)
**Origin:** Greenfield rebuild learning from the LUCI codebase

---

## Executive Summary

Transform the single-tenant, Salesforce-specific LUCI application into a multi-tenant SaaS platform that supports any CRM, serves many customers on shared infrastructure, and can be sold as a hosted product to B2B SaaS companies (with flexibility for other verticals).

### Key Architectural Decisions

| Decision | Choice |
|----------|--------|
| Migration strategy | Greenfield rebuild (new repo, new schema, port features) |
| Monorepo tooling | Turborepo |
| Data access | Drizzle ORM on Postgres (DB-host agnostic, Supabase for now) |
| AI orchestration | Behind a clean interface; CrewAI evaluated against alternatives |
| Testing | Vitest + Playwright + pytest from day one |
| Billing | Stripe, per-seat + tiered plans with credit-based AI limits |
| Observability | Structured logging + Sentry (errors + tracing) + audit trail |
| Deployment | Web on Vercel, Worker + AI Service on Railway, DB on Supabase (swappable) |

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Tenant Model & Data Isolation](#2-tenant-model--data-isolation)
3. [Integration Framework](#3-integration-framework)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [AI Service Architecture](#5-ai-service-architecture)
6. [Billing & Plans](#6-billing--plans)
7. [Worker & Background Jobs](#7-worker--background-jobs)
8. [Observability & Operations](#8-observability--operations)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Cross-Cutting Concerns](#10-cross-cutting-concerns)
11. [Known Unknowns](#11-known-unknowns)

---

## 1. System Architecture

### Monorepo Structure

```
wf/
├── apps/
│   ├── web/              # Next.js 15+ frontend + API routes
│   ├── worker/           # Background job processor (Node.js)
│   └── ai-service/       # AI orchestration (Python FastAPI)
│
├── packages/
│   ├── db/               # Drizzle schema, migrations, tenant-aware client
│   ├── auth/             # OAuth providers, session mgmt, tenant resolution
│   ├── integrations/     # CRM adapters, field mapping engine, sync logic
│   ├── billing/          # Stripe integration, plan entitlements, usage metering
│   ├── observability/    # Structured logging, tracing, Sentry config
│   └── shared/           # Types, utilities, constants
│
├── tests/
│   ├── e2e/              # Playwright E2E tests
│   └── fixtures/         # Shared test data, mock CRM responses
│
├── infra/                # Docker, Railway configs, Vercel config
├── turbo.json            # Turborepo pipeline config
├── package.json          # Root workspace config
└── .env.example          # Template for all env vars
```

### Service Responsibilities

| Service | Runtime | Deployment | Purpose |
|---------|---------|------------|---------|
| `apps/web` | Next.js 15+ (TypeScript) | Vercel | Frontend, API routes, context assembly |
| `apps/worker` | Node.js (TypeScript) | Railway | Job queue processing, scheduled syncs, notifications |
| `apps/ai-service` | Python FastAPI | Railway | Stateless AI crew execution |

All three services share `packages/*` (Node services) and communicate via REST APIs. They share a single Postgres database.

### Database Strategy

- **ORM:** Drizzle (type-safe, SQL-like, lightweight)
- **Hosting:** Supabase for now, but `packages/db` has zero Supabase-specific imports — any managed Postgres works
- **RLS:** Safety net using Postgres session variables (`SET LOCAL app.current_tenant_id` within transaction blocks), not the primary isolation mechanism. `SET LOCAL` (not `SET`) ensures the variable is scoped to the current transaction only, preventing leaks in PgBouncer/Supavisor transaction-mode connection pools.
- **Primary isolation:** Drizzle middleware automatically appends `WHERE tenant_id = ?` to every query

---

## 2. Tenant Model & Data Isolation

### Tenant Hierarchy

```
Platform (operator)
  └── Tenant (customer company)
       ├── Members (users within that tenant, each with a role)
       └── Integrations (connected apps for this tenant)
```

### Core Identity Tables

```sql
tenants
  id              uuid PK
  name            text                -- "Acme Corp"
  slug            text UNIQUE         -- "acme" (subdomain: acme.app.com)
  plan_id         uuid FK → plans
  status          text                -- active, trial, suspended, churned
  settings        jsonb               -- tenant-level feature config
  stripe_customer_id text
  created_at      timestamptz
  updated_at      timestamptz

users
  id              uuid PK
  email           text UNIQUE
  name            text
  avatar_url      text
  auth_provider   text                -- google, saml, etc.
  auth_provider_id text
  last_login_at   timestamptz
  created_at      timestamptz
  updated_at      timestamptz

tenant_members
  id              uuid PK
  tenant_id       uuid FK → tenants
  user_id         uuid FK → users
  role            text                -- owner, admin, member
  app_role        text                -- exec, ae, csm, sdr, sc, support
  invited_by      uuid FK → users (nullable)
  joined_at       timestamptz
  status          text                -- active, invited, deactivated
```

**Users exist independently of tenants.** One user can belong to multiple tenants via `tenant_members` (Slack/Notion model). Active tenant is determined by subdomain.

### Normalized Data Model (CRM-Agnostic)

Replaces LUCI's Salesforce-shaped tables:

| LUCI Table | New Table | Rationale |
|------------|-----------|-----------|
| `accounts` | `organizations` | Generic term for any CRM's company/account concept |
| `opportunities` | `deals` | Universal sales concept |
| `cases` | `tickets` | CRM-neutral support concept |
| `contacts` | `contacts` | Already generic |
| `salesforce_configs` | `integration_connections` | Generic credential store |

### Three-Tier Field Strategy

Every normalized business table has:

1. **Dedicated columns** for universal fields (amount, stage, close_date, etc.) — indexed, typed, queryable
2. **`custom_fields` (jsonb)** for tenant-defined fields with schema — structured, typed via definitions table, rendered dynamically in UI
3. **`source_metadata` (jsonb)** for raw CRM dump — read-only reference, never queried in business logic

Example `deals` table:

```sql
deals
  id                  uuid PK
  tenant_id           uuid FK → tenants
  source_provider     text            -- 'salesforce', 'hubspot', 'manual'
  source_id           text (nullable) -- ID in external system
  organization_id     uuid FK → organizations
  name                text
  amount              numeric
  currency            text DEFAULT 'USD'
  stage               text            -- normalized via stage_mappings
  probability         integer
  close_date          date
  owner_id            uuid FK → tenant_members (nullable)
  custom_fields       jsonb           -- tenant-defined fields
  source_metadata     jsonb           -- raw CRM record snapshot
  deleted_at          timestamptz     -- soft delete
  last_synced_at      timestamptz
  created_at          timestamptz
  updated_at          timestamptz
```

### Custom Field Definitions

```sql
tenant_custom_field_definitions
  id              uuid PK
  tenant_id       uuid FK → tenants
  entity_type     text            -- 'deal', 'ticket', 'organization', 'contact'
  field_key       text            -- 'lead_source', 'contract_type'
  field_label     text            -- 'Lead Source'
  field_type      text            -- 'text', 'number', 'date', 'select', 'boolean'
  options         jsonb (nullable)-- for select fields: ["Inbound", "Outbound"]
  source_mapping  text (nullable) -- 'LeadSource' in SF, 'hs_analytics_source' in HS
  mapping_status  text DEFAULT 'pending' -- 'pending', 'active', 'reindexing'
  sort_order      integer
```

**Immutable mappings:** Once a `source_mapping` is `active`, changing it requires setting `mapping_status` to `reindexing`, triggering a full re-sync to rebuild `custom_fields` data, then transitioning back to `active`. This prevents data corruption in JSONB columns from mid-stream mapping changes.

Populated during integration onboarding via schema discovery. The adapter proposes default mappings from CRM fields, tenant admin reviews on a "smart defaults + review" screen.

### Stage Mapping

```sql
stage_mappings
  id                uuid PK
  tenant_id         uuid FK → tenants
  integration_id    uuid FK → integration_connections
  entity_type       text            -- 'deal', 'ticket'
  source_value      text            -- 'Closed Won', 'closedwon'
  normalized_value  text            -- 'won', 'lost', 'negotiation'
  display_label     text            -- "Closed Won" (what tenant sees)
  is_closed         boolean DEFAULT false  -- true for terminal stages
  is_won            boolean DEFAULT false  -- true for won stages (subset of closed)
```

The `is_closed` and `is_won` booleans allow dashboard queries like `WHERE is_won = true` regardless of CRM terminology ("Closed Won", "Contract Signed", "Finished").

### Soft Deletes & Sync Policy

- **Every business table has `deleted_at`.** CRM deletions trigger soft delete, not hard delete.
- **CRM is source of truth** for CRM-sourced records. Sync overwrites platform fields each cycle.
- **Platform-native records** (no `source_id`) are never touched by sync.
- **One-way sync for v1.** CRM → Platform only. Bidirectional is a future feature.

### Sync Audit Log

```sql
sync_events
  id                uuid PK
  tenant_id         uuid FK → tenants
  integration_id    uuid FK → integration_connections
  entity_type       text
  entity_id         uuid (nullable)
  action            text            -- 'created', 'updated', 'soft_deleted', 'restored', 'skipped'
  changes           jsonb           -- { field: [old_value, new_value] }
  source_snapshot   jsonb           -- raw CRM record at time of sync
  created_at        timestamptz
```

---

## 3. Integration Framework

### Provider Interface Pattern

Every integration type gets an interface. Concrete adapters implement it per vendor.

```
packages/integrations/
  ├── types/
  │   ├── crm-provider.ts
  │   ├── meeting-provider.ts
  │   ├── ticketing-provider.ts
  │   ├── project-provider.ts
  │   └── enrichment-provider.ts
  │
  ├── adapters/
  │   ├── salesforce/
  │   │   ├── auth.ts
  │   │   ├── crm-adapter.ts        # Implements CRMProvider
  │   │   ├── field-defaults.ts
  │   │   └── schema-discovery.ts
  │   ├── hubspot/
  │   │   ├── auth.ts
  │   │   ├── crm-adapter.ts
  │   │   ├── field-defaults.ts
  │   │   └── schema-discovery.ts
  │   ├── avoma/
  │   │   └── meeting-adapter.ts
  │   ├── zendesk/
  │   │   └── ticketing-adapter.ts
  │   └── zoominfo/
  │       └── enrichment-adapter.ts
  │
  ├── engine/
  │   ├── sync-engine.ts
  │   ├── field-mapper.ts
  │   └── connection-manager.ts
  │
  └── registry.ts
```

### CRM Provider Interface

```typescript
interface CRMProvider {
  // Identity
  providerName: string
  providerLabel: string
  iconUrl: string
  supportedEntities: EntityType[]
  supportedSyncModes: SyncMode[]  // 'poll' | 'webhook'

  // Connection
  getAuthUrl(tenantId: string): string
  handleCallback(code: string): Promise<OAuthTokens>
  refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens>
  testConnection(): Promise<ConnectionHealth>

  // Schema discovery (onboarding)
  discoverObjects(): Promise<SourceObject[]>
  discoverFields(objectName: string): Promise<SourceField[]>
  getDefaultFieldMappings(): FieldMapping[]
  getDefaultStageMappings(): StageMapping[]

  // Data fetching
  fetchOrganizations(options: SyncOptions): Promise<SyncResult>
  fetchDeals(options: SyncOptions): Promise<SyncResult>
  fetchContacts(options: SyncOptions): Promise<SyncResult>

  // Rate limiting
  getRateLimitConfig(): RateLimitConfig
  checkQuotaRemaining?(): Promise<QuotaStatus>

  // Webhooks (optional, for future)
  registerWebhook?(config: WebhookConfig): Promise<WebhookRegistration>
  handleWebhookPayload?(payload: unknown): Promise<RawRecord[]>
  unregisterWebhook?(registrationId: string): Promise<void>
}

interface SyncOptions {
  since?: Date
  cursor?: string
  fullSync?: boolean
  batchSize?: number
}

interface SyncResult {
  records: RawRecord[]
  nextCursor?: string
  hasMore: boolean
  deletedIds?: string[]
}
```

### Sync Engine Flow

```
Cron trigger (per tenant, per integration)
  │
  ├── 1. connection-manager: refresh OAuth token if needed
  ├── 2. adapter.fetchDeals(options) → RawRecord[]
  ├── 3. field-mapper pipeline:
  │      type coercion → field mapping → stage normalization → validation → dedup
  ├── 4. db: upsert (match on tenant_id + source_provider + source_id)
  ├── 5. sync_events: log changes
  └── 6. Update integration_connections.last_synced_at + sync_state
```

### Field Mapper Pipeline

```
RawRecord from adapter
  ├── 1. Type coercion ("500000" → 500000, "" → null)
  ├── 2. Field mapping (tenant's configured mappings → dedicated + custom_fields)
  ├── 3. Stage normalization (via stage_mappings)
  ├── 4. Validation (required fields, type checks → invalid records logged as 'skipped')
  └── 5. Deduplication (upsert by tenant_id + source_provider + source_id)
```

### Integration Connections Table

```sql
integration_connections
  id                        uuid PK
  tenant_id                 uuid FK → tenants
  provider_type             text        -- 'crm', 'meeting', 'ticketing', 'project', 'enrichment'
  provider_name             text        -- 'salesforce', 'hubspot', etc.
  status                    text        -- 'connected', 'disconnected', 'error', 'pending_setup'
  credentials               jsonb       -- encrypted OAuth tokens, instance URLs
  config                    jsonb       -- provider-specific settings
  sync_state                jsonb       -- per-entity cursors, watermarks, pagination tokens
  sync_schedule             text DEFAULT '4h'
  field_mappings_configured boolean DEFAULT false
  last_synced_at            timestamptz
  last_sync_status          text        -- 'success', 'partial', 'failed'
  last_sync_error           text (nullable)
  connected_by              uuid FK → tenant_members
  created_at                timestamptz
  updated_at                timestamptz
```

### Key Constraints

- **One provider per type per tenant.** A tenant picks one CRM, one meeting tool, etc.
- **Adapters return raw data only.** Field mapping is a separate engine.
- **Adding a new provider:** Implement the interface, register it, write adapter tests. No schema changes.

### Testing Adapters

- **Mock provider** (`MockCRMAdapter`) for unit tests and demos — no CRM credentials needed
- **Adapter unit tests** mock external API responses (mock jsforce, mock HubSpot HTTP)
- **Integration tests** against real sandbox instances (Salesforce Developer Edition, HubSpot developer accounts) — manual CI only

### Integration Marketplace UI

Tenant admin sees integrations grouped by type. One active per category. Click "Connect" to start OAuth → schema discovery → field mapping review → first sync.

---

## 4. Authentication & Authorization

### Auth Flow (Subdomain-Aware)

```
User visits acme.wf-app.com
  ├── Middleware extracts "acme" from subdomain → looks up tenant
  ├── No session → login page → "Sign in with Google" (v1)
  ├── Google OAuth callback → find/create user → check tenant_members
  │   → Not a member? → "You don't have access to this workspace"
  │   → Is a member? → create session
  └── Session cookie: signed, httpOnly, scoped to *.wf-app.com
      Contains: user_id, tenant_id, role, expires_at
```

### Role Assignment

Roles are set by tenant admin on invite. **No CRM-derived roles** (unlike LUCI's Salesforce role mapper).

### Two-Layer Role System

**Tenant role** (structural):
- `owner` — created the tenant, full control, billing
- `admin` — manage members, integrations, settings
- `member` — use the product

**App role** (functional — drives dashboard and feature access):
- `exec`, `ae`, `csm`, `sdr`, `sc`, `support`

### Permissions Table

```sql
permissions
  id                uuid PK
  resource          text        -- 'dashboard:csm', 'settings:integrations', 'crew:run'
  action            text        -- 'view', 'edit', 'manage', 'run'
  min_tenant_role   text        -- 'member', 'admin', 'owner'
  allowed_app_roles text[]      -- null means all app roles
  plan_required     text        -- null means all plans, 'pro' means pro+ only
```

Checked via `hasPermission(user, resource, action)` helper.

### Auth Provider Extensibility

```sql
tenant_auth_settings
  tenant_id           uuid PK FK → tenants
  allowed_providers   text[]      -- ['google'] by default
  require_sso         boolean DEFAULT false
  allowed_email_domains text[]    -- ['acme.com'] restricts who can join
  auto_provision      boolean DEFAULT false
```

v1: Google only. Later: Microsoft, SAML, Magic Link — configured per tenant.

### Sessions

```sql
sessions
  id              uuid PK
  user_id         uuid FK → users
  tenant_id       uuid FK → tenants
  token_hash      text            -- HMAC of session token, never raw
  expires_at      timestamptz     -- 14 days
  last_active_at  timestamptz     -- sliding window
  ip_address      inet
  user_agent      text
  revoked_at      timestamptz (nullable)
  created_at      timestamptz
```

One session per user per tenant. Subdomain-scoped cookie.

### Invitation Flow

```
Admin invites jane@acme.com as AE
  → tenant_members row (status: 'invited')
  → Email with invite link → acme.wf-app.com/invite/{token}
  → Jane signs in with Google → token validated → status → 'active'
```

### Platform Admin

```sql
platform_admins
  id              uuid PK
  user_id         uuid FK → users
  role            text        -- 'super_admin', 'support', 'readonly'
  created_at      timestamptz
  last_active_at  timestamptz
```

Separate admin UI. Can view all tenants, impersonate for support (with audit trail), manage plans and feature flags.

### Dashboards

Role-based defaults, configurable per role by tenant admin (Pro+ plan).

```sql
dashboard_configs
  id          uuid PK
  tenant_id   uuid FK → tenants
  app_role    text
  layout      jsonb       -- widget positions and sizes
  created_at  timestamptz
  updated_at  timestamptz
```

---

## 5. AI Service Architecture

### Design Principle: Stateless Executor

The AI service is a pure function: **config + context in → analysis out.** It never queries the database, never knows which CRM the tenant uses, and has zero tenant isolation concerns.

### Execution Flow

```
apps/web (API route)           apps/worker              apps/ai-service
  │                              │                        │
  ├── 1. Receive request         │                        │
  ├── 2. Check entitlements      │                        │
  ├── 3. Estimate context size   │                        │
  │      (reject if too large    │                        │
  │       or over credit budget) │                        │
  ├── 4. Assemble + prune context│                        │
  ├── 5. Load crew config        │                        │
  ├── 6. Enqueue ai_job ────────→│                        │
  │      Return job_id to client │                        │
  │                              ├── 7. Pick up job       │
  │                              ├── 8. POST to ai-svc ──→│
  │                              │                        ├── 9. Execute crew
  │                              │◄───────────────────────├── 10. Return results
  │                              ├── 11. Store results    │
  │                              ├── 12. Update credits   │
  │                              └── 13. Notify user      │
  │                                                       │
  └── Client polls/subscribes for completion              │
```

**Async-always execution:** Every crew run goes through the job queue. The web app returns a `job_id` immediately. The client polls for completion (or subscribes via SSE). This avoids Vercel function timeouts and provides consistent UX regardless of crew complexity.

**Pre-execution guardrails:**
- **Context size estimation:** Before enqueuing, estimate token count from assembled context. Reject if context exceeds model window or would cost more credits than the tenant has remaining.
- **Context pruning:** Each `crew_template` defines `max_context` limits (e.g., max 20 deals, 10 most recent meetings). The context assembler enforces these budgets to control AI COGS.

### Orchestration Interface

```python
class CrewExecutor(Protocol):
    async def execute(
        self,
        crew_config: CrewConfig,
        context: dict,
        options: ExecutionOptions
    ) -> CrewResult: ...

    async def validate_config(self, crew_config: CrewConfig) -> ValidationResult: ...
    def supported_models(self) -> list[str]: ...
```

v1: `CrewAIExecutor`. Swappable to LangGraph, Claude native agents, or custom orchestrator without changing the web app or worker.

### Crew Configuration

```sql
crew_templates
  id                  uuid PK
  slug                text            -- 'account_health', 'deal_review'
  name                text
  description         text
  category            text            -- 'account', 'sales', 'support', 'coaching', 'prep'
  default_config      jsonb           -- agents, tasks, prompts, model
  required_context    text[]          -- ['organization', 'deals', 'tickets']
  required_integrations text[]        -- ['crm'] or ['crm', 'meeting']
  max_context         jsonb           -- { deals: 20, meetings: 10, tickets: 30 } pruning limits
  credit_cost         integer DEFAULT 1
  min_plan            text
  version             integer
  is_active           boolean

tenant_crew_overrides
  id                  uuid PK
  tenant_id           uuid FK → tenants
  crew_template_id    uuid FK → crew_templates
  config_overrides    jsonb           -- only the fields they changed
  enabled             boolean DEFAULT true
  allowed_app_roles   text[]          -- which roles can run this
  updated_at          timestamptz
```

Customization: tenants override prompts via `config_overrides`. Deep-merged with template at runtime. Platform updates to templates propagate automatically; tenant overrides are preserved.

### Model Selection

```sql
tenant_ai_settings
  tenant_id         uuid PK FK → tenants
  preferred_model   text            -- 'claude-sonnet-4-20250514', 'gemini-2.0-flash'
  fallback_model    text (nullable)
  max_monthly_spend numeric (nullable)
  updated_at        timestamptz
```

Plan-gated: Starter gets Gemini, Pro gets Claude Sonnet, Enterprise gets Opus.

### Usage Metering

```sql
ai_usage
  id                uuid PK
  tenant_id         uuid FK → tenants
  crew_template_id  uuid FK → crew_templates
  triggered_by      uuid FK → tenant_members
  model_used        text
  input_tokens      integer
  output_tokens     integer
  execution_time_ms integer
  status            text            -- 'completed', 'failed', 'timeout'
  cost_estimate     numeric
  created_at        timestamptz
```

### Tool Use / MCP

Context-only for v1. All data pre-fetched by web app. No MCP or tool calls during execution. Can be added as a v2 Enterprise feature.

---

## 6. Billing & Plans

### Stripe Architecture

- One Stripe Customer per tenant
- One Stripe Subscription per tenant
- Stripe is the billing source of truth; DB mirrors for entitlement checks

### Plan Tiers

```
Starter                  Pro                        Enterprise
────────                 ───                        ──────────
$X/user/mo               $Y/user/mo                 Custom

50 credits/mo            500 credits/mo             Unlimited
Gemini models only       Claude Sonnet + Gemini     Claude Opus + all
1 CRM connection         CRM + meeting + ticketing  All integration types
5 users max              50 users max               Unlimited
Standard crews           All crews + custom prompts All + custom prompts
Fixed dashboards         Configurable dashboards    Configurable + API
Email support            Priority support           Dedicated CSM + SLA
Light/dark mode          Logo + brand color         Full white-label
Export only              Export only                Export + REST API
```

### Credit System

Each crew run costs credits (weighted by complexity: 1/3/5 credits).

```sql
plans
  id                        uuid PK
  slug                      text
  name                      text
  stripe_product_id         text
  stripe_price_monthly_id   text
  stripe_price_annual_id    text (nullable)
  price_per_seat_monthly    numeric
  price_per_seat_annual     numeric (nullable)
  monthly_credits           integer (nullable)  -- null = unlimited
  max_users                 integer (nullable)
  allowed_models            text[]
  allowed_integration_types text[]
  features                  jsonb               -- feature flag map
  sort_order                integer
  is_active                 boolean

tenant_credit_usage
  tenant_id       uuid FK → tenants
  period_start    date
  period_end      date
  credits_used    integer
  credits_limit   integer
  updated_at      timestamptz

credit_top_ups
  id              uuid PK
  tenant_id       uuid FK → tenants
  credits         integer
  amount_charged  numeric
  stripe_payment_id text
  approved_by     uuid FK → tenant_members
  created_at      timestamptz
```

### Credit Limit Behavior (Soft Cap)

- **80% used:** Notification to tenant admin (email + in-app)
- **100% used:** Analyses blocked for non-admins. Admin sees "Buy 50 more credits for $X" or "Upgrade plan"
- **Top-up purchased:** Stripe one-time charge, credits added immediately

### Subscription Lifecycle

- **Trial:** 14-day Pro trial, no payment method required
- **Conversion:** Add payment method → trial transitions to active
- **Non-conversion:** Read-only mode, data preserved 90 days, "Reactivate" option
- **Upgrades:** Prorated by Stripe
- **Downgrades:** Take effect at period end
- **Seat changes:** Add = immediate prorated charge; Remove = takes effect at period end
- **Cancellation:** Access until period end, then read-only
- **Past due:** 3 Stripe retry attempts, then suspend

### Subscription Tables

```sql
tenant_subscriptions
  id                      uuid PK
  tenant_id               uuid FK → tenants
  plan_id                 uuid FK → plans
  stripe_subscription_id  text
  status                  text    -- trialing, active, past_due, canceled, paused
  billing_cycle           text    -- monthly, annual
  seat_count              integer
  current_period_start    timestamptz
  current_period_end      timestamptz
  trial_ends_at           timestamptz (nullable)
  canceled_at             timestamptz (nullable)
  cancel_at_period_end    boolean DEFAULT false
  updated_at              timestamptz

tenant_invoices
  id                  uuid PK
  tenant_id           uuid FK → tenants
  stripe_invoice_id   text
  amount              numeric
  currency            text
  status              text    -- draft, open, paid, void, uncollectible
  invoice_url         text    -- Stripe hosted invoice link
  period_start        timestamptz
  period_end          timestamptz
  created_at          timestamptz
```

### Entitlement Checking

Single function used everywhere:

```typescript
async function checkEntitlement(tenantId: string, feature: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePrompt?: string
}>
```

Frontend caches entitlement map on load. Features show/hide based on entitlements, not error messages after the user tries something.

### Stripe Webhooks

Handled at `/api/webhooks/stripe/route.ts` (idempotent):

- `customer.subscription.created/updated/deleted`
- `customer.subscription.trial_will_end`
- `invoice.paid/payment_failed/finalized`
- `checkout.session.completed` (credit top-ups)

Payment method management via Stripe Customer Portal (not custom-built).

---

## 7. Worker & Background Jobs

### Postgres-Backed Job Queue

No Redis. Uses `FOR UPDATE SKIP LOCKED` for concurrent processing.

```
apps/worker/
  ├── server.ts              # Express health check + webhook receiver
  ├── queue/
  │   ├── processor.ts       # Pulls jobs, executes, reports results
  │   ├── scheduler.ts       # Creates recurring jobs from schedules
  │   └── types.ts
  ├── jobs/
  │   ├── sync-crm.ts
  │   ├── sync-meetings.ts
  │   ├── sync-tickets.ts
  │   ├── process-embeddings.ts
  │   ├── send-notification.ts
  │   ├── generate-briefing.ts
  │   ├── scheduled-analysis.ts
  │   ├── tenant-provision.ts
  │   ├── tenant-suspend.ts
  │   ├── tenant-reactivate.ts
  │   └── tenant-purge.ts
  └── lib/
      ├── circuit-breaker.ts
      ├── rate-limiter.ts
      └── retry.ts
```

### Job Tables

```sql
jobs
  id              uuid PK
  tenant_id       uuid FK → tenants
  job_type        text
  status          text        -- queued, running, completed, failed, stalled
  priority        integer DEFAULT 0
  payload         jsonb
  result          jsonb (nullable)
  error           text (nullable)
  attempts        integer DEFAULT 0
  max_attempts    integer DEFAULT 3
  run_after       timestamptz
  started_at      timestamptz (nullable)
  completed_at    timestamptz (nullable)
  locked_by       text (nullable)
  locked_at       timestamptz (nullable)
  created_at      timestamptz

job_schedules
  id                uuid PK
  tenant_id         uuid FK → tenants
  integration_id    uuid FK → integration_connections (nullable)
  job_type          text
  interval_minutes  integer
  enabled           boolean DEFAULT true
  last_enqueued_at  timestamptz
  next_run_at       timestamptz
  config            jsonb
```

### Processing Model

- **Scheduler** runs every minute, creates jobs from `job_schedules`
- **Processor** loops continuously, pulls jobs with `FOR UPDATE SKIP LOCKED`
- **Per-tenant concurrency limit** (default: 2 concurrent jobs per tenant)
- **Priority system:** webhook (10) > user-initiated (5) > scheduled (1) > bulk (0)
- **CRM API quota awareness:** When a tenant is near their CRM's daily API limit, auto-defer background syncs (priority 0-1) and only execute user-initiated syncs (priority 5+). The adapter's `checkQuotaRemaining()` is called before each sync job.
- **Retry:** Exponential backoff, max 3 attempts, then fail + notify
- **Stall detection:** Jobs running > 15 minutes auto-reset

### Default Sync Frequencies (Plan-Gated)

| Job Type | Starter | Pro | Enterprise |
|----------|---------|-----|------------|
| CRM sync | Every 4h | Every 1h | Every 15min + webhooks |
| Meeting sync | Every 4h | Every 2h | Every 1h |
| Ticket sync | Every 4h | Every 1h | Every 15min + webhooks |
| Embeddings | Every 6h | Every 2h | Every 1h |
| Briefings | Daily | Daily | Daily |

Tenant admins on Pro+ can adjust within plan limits.

### Scaling Path

1. Add worker instances (share queue automatically via `SKIP LOCKED`)
2. Dedicated queues per job type if needed
3. Migrate to Redis + BullMQ if Postgres queue becomes bottleneck (unlikely below thousands of tenants)

### Tenant Lifecycle Jobs

- `tenant_provision` — seed defaults on signup
- `tenant_suspend` — pause all jobs on payment failure
- `tenant_reactivate` — resume on payment
- `tenant_purge` — full data deletion after retention period (requires platform admin approval)

### Tenant-Facing Sync Status

Tenant admins see sync health per integration (last sync time, status, record counts, errors). Can trigger manual sync or force full re-sync.

### Scheduled Analyses

Recurring crew runs (e.g., "run account health weekly for all accounts"). Configured by tenant admin, plan-gated. Credit-aware — runs as many as budget allows, notifies if exceeded.

### Notification System

```sql
notification_rules
  id              uuid PK
  tenant_id       uuid FK → tenants
  event_type      text        -- 'sync_failed', 'credits_80_pct', 'analysis_complete', etc.
  channels        text[]      -- ['email', 'in_app', 'slack']
  recipients      jsonb       -- { roles: ['admin'], specific_users: [...] }
  config          jsonb       -- event-specific thresholds
  enabled         boolean
  created_at      timestamptz

notifications
  id              uuid PK
  tenant_id       uuid FK → tenants
  user_id         uuid FK → users
  event_type      text
  channel         text        -- 'email', 'in_app', 'slack'
  title           text
  body            text
  action_url      text (nullable)
  status          text        -- 'pending', 'sent', 'read', 'failed'
  sent_at         timestamptz (nullable)
  read_at         timestamptz (nullable)
  created_at      timestamptz
```

Event-driven: code emits events → notification engine checks rules → enqueues delivery jobs.

---

## 8. Observability & Operations

### Three Pillars

**1. Structured Logging**

Every log line is JSON with tenant context:

```json
{
  "timestamp": "2026-02-22T14:32:01.123Z",
  "level": "info",
  "service": "web",
  "tenant_id": "...",
  "tenant_slug": "acme",
  "user_id": "...",
  "trace_id": "abc-123-def",
  "message": "CRM sync completed",
  "data": { "deals_synced": 47, "duration_ms": 3200 }
}
```

Shared logger from `packages/observability`. Tenant context injected automatically.

**2. Error Tracking (Sentry)**

Tenant-tagged (`tenant_id`, `tenant_slug`, `plan`). Filter in Sentry by tenant or plan.

**3. Distributed Tracing (Sentry Performance)**

Single `trace_id` follows requests across web → ai-service → worker. Passed via HTTP headers and job payloads.

### Platform Health Dashboard

Admin UI showing: tenant counts, MRR, system health (latency, queue depth, error rates), alerts, top tenants by usage.

### Alerting

```sql
platform_alert_rules
  id                uuid PK
  name              text
  condition         jsonb
  channels          text[]      -- ['slack', 'pagerduty']
  severity          text        -- 'info', 'warning', 'critical'
  enabled           boolean
  cooldown_minutes  integer
```

Default alerts: sync failures, stalled jobs, queue backup, AI service down, payment failures, high error rate.

### Audit Trail

```sql
audit_log
  id              uuid PK
  tenant_id       uuid FK → tenants (nullable)
  actor_id        uuid FK → users
  actor_type      text        -- 'user', 'admin', 'system', 'impersonation'
  action          text        -- 'member.invited', 'integration.connected', etc.
  resource_type   text
  resource_id     text
  changes         jsonb (nullable)
  ip_address      inet
  user_agent      text
  created_at      timestamptz
```

Append-only. Never updated or deleted. Enterprise tenants get access to their own audit log.

---

## 9. Frontend Architecture

### Tech Stack

| Layer | Choice |
|-------|--------|
| Components | shadcn/ui (Radix primitives + Tailwind) |
| Server state | React Query (TanStack Query) |
| Client state | Zustand |
| Routing | Next.js App Router |
| Styling | Tailwind CSS |

### Route Structure

```
apps/web/src/app/
  ├── (auth)/                   # Login, callback, invite
  ├── (tenant)/                 # Tenant-scoped (requires auth)
  │   ├── dashboard/
  │   ├── deals/
  │   ├── organizations/
  │   ├── tickets/
  │   ├── contacts/
  │   ├── analyses/
  │   ├── prep/
  │   ├── settings/
  │   │   ├── integrations/
  │   │   ├── members/
  │   │   ├── billing/
  │   │   ├── notifications/
  │   │   ├── crews/
  │   │   └── field-mappings/
  │   └── layout.tsx            # Tenant shell
  ├── (platform-admin)/         # Platform admin
  │   ├── tenants/
  │   ├── health/
  │   └── layout.tsx
  └── api/
```

### Tenant Context Flow

```
Request → middleware.ts
  ├── Extract subdomain → look up tenant (cached)
  ├── Validate session cookie → user_id, role
  ├── Inject headers: x-tenant-id, x-user-id, x-user-role
  └── TenantProvider on client → useTenant() hook available everywhere
```

### Configurable Dashboards

Widget registry pattern. Default layouts per role. Tenant admins rearrange via drag-and-drop on Pro+.

### Custom Fields in UI

`EntityDetail` and `DataTable` components dynamically render custom fields from `tenant_custom_field_definitions`. Standard columns are fixed, custom columns added at runtime.

### Tenant Theming

```sql
tenant_branding
  tenant_id       uuid PK FK → tenants
  logo_url        text (nullable)
  favicon_url     text (nullable)
  primary_color   text (nullable)
  secondary_color text (nullable)
  font_family     text (nullable)
  custom_domain   text (nullable)       -- Enterprise only
  custom_css      text (nullable)       -- Enterprise escape hatch
  updated_at      timestamptz
```

Implemented via CSS custom properties. `TenantProvider` injects branding as CSS variables.

**Plan gating:**
- Starter: light/dark mode
- Pro: logo + primary color
- Enterprise: full white-label + custom domain

---

## 10. Cross-Cutting Concerns

### Search

Postgres full-text search (`pg_trgm` + `tsvector`). Global search bar queries across organizations, deals, tickets, contacts, analyses. Tenant-scoped. Dedicated search service (Meilisearch/Typesense) can be added later if needed.

### Embeddings & RAG

Carry-over from LUCI. `pgvector` in Supabase for vector embeddings. Embedding pipeline is a worker job type. Embeddings are tenant-scoped. RAG chatbot feature is plan-gated (Pro+).

### Data Export & Public API

- **CSV/Excel export** from any data table (all plans)
- **REST API** for programmatic access (Enterprise plan)

```sql
tenant_api_keys
  id              uuid PK
  tenant_id       uuid FK → tenants
  created_by      uuid FK → tenant_members
  name            text
  key_hash        text            -- hashed, never plain text
  key_prefix      text            -- 'wf_live_abc...' for identification
  scopes          text[]          -- ['read:deals', 'read:organizations']
  rate_limit      integer         -- requests per minute
  last_used_at    timestamptz
  expires_at      timestamptz (nullable)
  revoked_at      timestamptz (nullable)
```

API routes under `/api/v1/` with API key auth middleware.

### GDPR & Data Compliance (Basics)

- **Data export endpoint:** Full tenant data dump on request
- **Tenant deletion job:** `tenant_purge` cascades through all tables, revokes OAuth tokens, cleans up Stripe (requires platform admin approval)
- **Retention policy:** Configurable per table type
- **Data preserved 90 days** after churn before purge eligibility

### Drizzle + RLS Compatibility

RLS policies use Postgres session variables, not Supabase auth context:

```sql
-- Set at start of each request by Drizzle middleware (inside a transaction)
BEGIN;
SET LOCAL app.current_tenant_id = 'tenant-uuid';
-- ... all queries run here ...
COMMIT;

-- RLS policy
CREATE POLICY tenant_isolation ON deals
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Critical:** Use `SET LOCAL` (not `SET`) to scope the session variable to the current transaction only. This prevents tenant_id leaking between requests when using PgBouncer/Supavisor in transaction pooling mode.

### Seat Enforcement (Database-Level)

In addition to UI-level seat checks, enforce seat limits at the database level:

```sql
CREATE OR REPLACE FUNCTION enforce_seat_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count integer;
  seat_limit integer;
BEGIN
  SELECT count(*) INTO current_count
  FROM tenant_members
  WHERE tenant_id = NEW.tenant_id AND status IN ('active', 'invited');

  SELECT ts.seat_count INTO seat_limit
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = NEW.tenant_id AND ts.status IN ('active', 'trialing');

  IF current_count >= seat_limit THEN
    RAISE EXCEPTION 'Seat limit reached (% of %)', current_count, seat_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_seat_limit
  BEFORE INSERT ON tenant_members
  FOR EACH ROW EXECUTE FUNCTION enforce_seat_limit();
```

This prevents over-provisioning even if the UI has a bug or is bypassed via API.

---

## 11. Known Unknowns

Decisions to resolve during implementation, not now:

1. **CrewAI vs alternatives** — Evaluate CrewAI, LangGraph, native Claude agents, and custom orchestration during AI service implementation. The `CrewExecutor` interface insulates the rest of the system.

2. **Real-time updates** — WebSockets or Server-Sent Events for live sync status, in-app notifications, dashboard refresh. Architecture supports it; implementation timing TBD.

3. **Multi-region deployment** — If EU customers require EU-hosted data. Not an architecture change, just deployment configuration.

4. **Mobile app** — Responsive web may suffice. API-first design supports native apps if needed.

5. **Bidirectional CRM sync** — v1 is one-way (CRM → platform). Write-back (platform → CRM) is a future feature, potentially plan-gated.

6. **Webhook delivery to tenants** — Enterprise tenants may want outbound webhooks ("notify my system when a deal stage changes"). The event system supports this; delivery infrastructure TBD.

7. **Seat abuse prevention** — Currently trust-based (Google OAuth prevents credential sharing naturally). Monitor usage patterns; add concurrent session limits if needed.

---

## Appendix: Complete Table Inventory

### Platform Tables
- `tenants`
- `users`
- `tenant_members`
- `plans`
- `tenant_subscriptions`
- `tenant_invoices`
- `credit_top_ups`
- `tenant_credit_usage`
- `platform_admins`
- `platform_alert_rules`
- `audit_log`

### Auth & Session Tables
- `sessions`
- `tenant_auth_settings`

### Integration Tables
- `integration_connections`
- `tenant_custom_field_definitions`
- `stage_mappings`
- `sync_events`

### Business Data Tables (all have tenant_id + soft delete)
- `organizations`
- `deals`
- `tickets`
- `contacts`
- `meetings`

### AI Tables
- `crew_templates`
- `tenant_crew_overrides`
- `tenant_ai_settings`
- `ai_usage`

### Worker Tables
- `jobs`
- `job_schedules`

### Notification Tables
- `notification_rules`
- `notifications`

### Frontend Tables
- `dashboard_configs`
- `tenant_branding`

### API Tables
- `tenant_api_keys`
