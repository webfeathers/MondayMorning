# Multi-Tenant SaaS Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-tenant SaaS platform from scratch, implementing the architecture defined in `docs/plans/2026-02-22-multi-tenant-saas-design.md`.

**Architecture:** Turborepo monorepo with 3 apps (Next.js web, Node.js worker, Python AI service) and 6 shared packages (db, auth, integrations, billing, observability, shared). Postgres via Drizzle ORM with tenant-aware middleware. Async job queue. Stripe billing. CRM adapter pattern.

**Tech Stack:** Next.js 15+, TypeScript, Drizzle ORM, Postgres/Supabase, Stripe, shadcn/ui, Zustand, React Query, Vitest, Playwright, Python FastAPI, Turborepo

---

## Phase Overview

| Phase | Focus | Deliverable |
|-------|-------|-------------|
| 1 | Monorepo + DB Foundation | Schema migrates, tenant-aware client works, tests pass |
| 2 | Auth + Tenant Resolution | Sign in via Google, subdomain routing, sessions, roles |
| 3 | Integration Framework | CRM provider interface, mock adapter, field mapper, sync engine |
| 4 | Billing + Entitlements | Stripe integration, plans, credits, entitlement checks |
| 5 | Worker + Background Jobs | Postgres job queue, scheduler, sync automation |
| 6 | Frontend Shell + Dashboards | App shell, data tables, entity views, custom fields |
| 7 | AI Service + Crew Execution | Python service, async execution, context assembly |
| 8 | Settings, Notifications, Observability | Admin pages, notification system, logging, audit |
| 9 | Polish, E2E Tests, Deploy | Playwright suite, platform admin, theming, production deploy |

---

## Phase 1: Monorepo + DB Foundation

**Goal:** Working Turborepo monorepo with Drizzle schema covering all core tables, tenant-aware DB client with `SET LOCAL` transaction isolation, seed data, and passing tests.

**Estimated tasks:** 12

---

### Task 1.1: Initialize Turborepo Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `turbo.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `.env.example`

**Step 1: Initialize the project**

```bash
mkdir -p apps/web apps/worker apps/ai-service
mkdir -p packages/db packages/auth packages/integrations packages/billing packages/observability packages/shared
mkdir -p tests/e2e tests/fixtures
mkdir -p infra
```

**Step 2: Create root package.json**

```json
{
  "name": "wf",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "lint": "turbo lint",
    "db:generate": "turbo db:generate --filter=@wf/db",
    "db:migrate": "turbo db:migrate --filter=@wf/db",
    "db:seed": "turbo db:seed --filter=@wf/db"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "db:generate": {},
    "db:migrate": {},
    "db:seed": {}
  }
}
```

**Step 4: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 5: Create .env.example**

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# AI Service
AI_SERVICE_URL=http://localhost:8000

# Sentry
SENTRY_DSN=

# App
NEXT_PUBLIC_APP_DOMAIN=wf-app.com
SESSION_SIGNING_SECRET=
```

**Step 6: Install dependencies and verify**

Run: `pnpm install`
Expected: Lock file created, no errors

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: initialize turborepo monorepo structure"
```

---

### Task 1.2: Set Up packages/shared

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/tenant.ts`
- Create: `packages/shared/src/types/enums.ts`
- Create: `packages/shared/src/constants.ts`

**Step 1: Create package.json**

```json
{
  "name": "@wf/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create type definitions**

`packages/shared/src/types/enums.ts`:
```typescript
export const TenantStatus = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  SUSPENDED: 'suspended',
  CHURNED: 'churned',
} as const;
export type TenantStatus = typeof TenantStatus[keyof typeof TenantStatus];

export const TenantRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type TenantRole = typeof TenantRole[keyof typeof TenantRole];

export const AppRole = {
  EXEC: 'exec',
  AE: 'ae',
  CSM: 'csm',
  SDR: 'sdr',
  SC: 'sc',
  SUPPORT: 'support',
} as const;
export type AppRole = typeof AppRole[keyof typeof AppRole];

export const ProviderType = {
  CRM: 'crm',
  MEETING: 'meeting',
  TICKETING: 'ticketing',
  PROJECT: 'project',
  ENRICHMENT: 'enrichment',
} as const;
export type ProviderType = typeof ProviderType[keyof typeof ProviderType];

export const ProviderName = {
  SALESFORCE: 'salesforce',
  HUBSPOT: 'hubspot',
  AVOMA: 'avoma',
  ZENDESK: 'zendesk',
  ZOOMINFO: 'zoominfo',
} as const;
export type ProviderName = typeof ProviderName[keyof typeof ProviderName];

export const JobStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  STALLED: 'stalled',
} as const;
export type JobStatus = typeof JobStatus[keyof typeof JobStatus];

export const PlanSlug = {
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;
export type PlanSlug = typeof PlanSlug[keyof typeof PlanSlug];

export const MappingStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REINDEXING: 'reindexing',
} as const;
export type MappingStatus = typeof MappingStatus[keyof typeof MappingStatus];
```

`packages/shared/src/constants.ts`:
```typescript
export const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const TRIAL_DURATION_DAYS = 14;
export const DATA_RETENTION_DAYS = 90;
export const MAX_CONCURRENT_JOBS_PER_TENANT = 2;
export const JOB_STALL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const CREDIT_WARNING_THRESHOLD = 0.8; // 80%

export const JOB_PRIORITY = {
  WEBHOOK: 10,
  USER_INITIATED: 5,
  SCHEDULED: 1,
  BULK: 0,
} as const;
```

**Step 3: Export from index**

`packages/shared/src/index.ts`:
```typescript
export * from './types/enums';
export * from './constants';
```

**Step 4: Install dependencies and test import**

Run: `cd packages/shared && pnpm install`

**Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat: add shared package with types, enums, and constants"
```

---

### Task 1.3: Set Up packages/db — Drizzle Schema (Core Identity Tables)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/schema/tenants.ts`
- Create: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/schema/tenant-members.ts`
- Create: `packages/db/src/schema/sessions.ts`
- Create: `packages/db/src/schema/index.ts`
- Test: `packages/db/src/__tests__/schema.test.ts`

**Step 1: Write the failing test**

`packages/db/src/__tests__/schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { tenants, users, tenantMembers, sessions } from '../schema';

describe('Core Identity Schema', () => {
  it('tenants table has required columns', () => {
    const columns = Object.keys(tenants);
    expect(columns).toContain('id');
    expect(columns).toContain('name');
    expect(columns).toContain('slug');
    expect(columns).toContain('planId');
    expect(columns).toContain('status');
    expect(columns).toContain('settings');
    expect(columns).toContain('stripeCustomerId');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  it('users table has required columns', () => {
    const columns = Object.keys(users);
    expect(columns).toContain('id');
    expect(columns).toContain('email');
    expect(columns).toContain('name');
    expect(columns).toContain('authProvider');
    expect(columns).toContain('authProviderId');
  });

  it('tenantMembers table has required columns', () => {
    const columns = Object.keys(tenantMembers);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('userId');
    expect(columns).toContain('role');
    expect(columns).toContain('appRole');
    expect(columns).toContain('status');
  });

  it('sessions table has required columns', () => {
    const columns = Object.keys(sessions);
    expect(columns).toContain('id');
    expect(columns).toContain('userId');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('tokenHash');
    expect(columns).toContain('expiresAt');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/db && pnpm test`
Expected: FAIL — modules not found

**Step 3: Create package.json and install Drizzle**

```json
{
  "name": "@wf/db",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/seed.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.38.0",
    "postgres": "^3.4.0",
    "@wf/shared": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "vitest": "^3.0.0",
    "typescript": "^5.7.0",
    "tsx": "^4.19.0"
  }
}
```

Run: `pnpm install`

**Step 4: Write the schema files**

`packages/db/src/schema/tenants.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamptz } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  planId: uuid('plan_id'),
  status: text('status').notNull().default('trial'),
  settings: jsonb('settings').default({}),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

`packages/db/src/schema/users.ts`:
```typescript
import { pgTable, uuid, text, timestamptz } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  authProvider: text('auth_provider').notNull().default('google'),
  authProviderId: text('auth_provider_id'),
  lastLoginAt: timestamptz('last_login_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

`packages/db/src/schema/tenant-members.ts`:
```typescript
import { pgTable, uuid, text, timestamptz } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const tenantMembers = pgTable('tenant_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: text('role').notNull().default('member'),
  appRole: text('app_role').notNull().default('ae'),
  invitedBy: uuid('invited_by').references(() => users.id),
  joinedAt: timestamptz('joined_at'),
  status: text('status').notNull().default('invited'),
});
```

`packages/db/src/schema/sessions.ts`:
```typescript
import { pgTable, uuid, text, timestamptz, inet } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tenants } from './tenants';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamptz('expires_at').notNull(),
  lastActiveAt: timestamptz('last_active_at').notNull().defaultNow(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  revokedAt: timestamptz('revoked_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});
```

`packages/db/src/schema/index.ts`:
```typescript
export * from './tenants';
export * from './users';
export * from './tenant-members';
export * from './sessions';
```

`packages/db/src/index.ts`:
```typescript
export * from './schema';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/db && pnpm test`
Expected: PASS — all column checks pass

**Step 6: Commit**

```bash
git add packages/db
git commit -m "feat: add db package with core identity schema (tenants, users, members, sessions)"
```

---

### Task 1.4: Drizzle Schema — Business Data Tables

**Files:**
- Create: `packages/db/src/schema/organizations.ts`
- Create: `packages/db/src/schema/deals.ts`
- Create: `packages/db/src/schema/tickets.ts`
- Create: `packages/db/src/schema/contacts.ts`
- Create: `packages/db/src/schema/meetings.ts`
- Update: `packages/db/src/schema/index.ts`
- Test: `packages/db/src/__tests__/business-schema.test.ts`

**Step 1: Write the failing test**

`packages/db/src/__tests__/business-schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { organizations, deals, tickets, contacts, meetings } from '../schema';

describe('Business Data Schema', () => {
  it('all business tables have tenant_id', () => {
    expect(Object.keys(organizations)).toContain('tenantId');
    expect(Object.keys(deals)).toContain('tenantId');
    expect(Object.keys(tickets)).toContain('tenantId');
    expect(Object.keys(contacts)).toContain('tenantId');
    expect(Object.keys(meetings)).toContain('tenantId');
  });

  it('all business tables have soft delete', () => {
    expect(Object.keys(organizations)).toContain('deletedAt');
    expect(Object.keys(deals)).toContain('deletedAt');
    expect(Object.keys(tickets)).toContain('deletedAt');
    expect(Object.keys(contacts)).toContain('deletedAt');
    expect(Object.keys(meetings)).toContain('deletedAt');
  });

  it('all business tables have source tracking', () => {
    expect(Object.keys(deals)).toContain('sourceProvider');
    expect(Object.keys(deals)).toContain('sourceId');
    expect(Object.keys(deals)).toContain('sourceMetadata');
    expect(Object.keys(deals)).toContain('customFields');
  });

  it('deals table has universal CRM fields', () => {
    const cols = Object.keys(deals);
    expect(cols).toContain('name');
    expect(cols).toContain('amount');
    expect(cols).toContain('currency');
    expect(cols).toContain('stage');
    expect(cols).toContain('probability');
    expect(cols).toContain('closeDate');
    expect(cols).toContain('ownerId');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/db && pnpm test`
Expected: FAIL — business tables not found

**Step 3: Write the schema files**

`packages/db/src/schema/organizations.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamptz, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  sourceProvider: text('source_provider'),
  sourceId: text('source_id'),
  name: text('name').notNull(),
  domain: text('domain'),
  industry: text('industry'),
  employeeCount: integer('employee_count'),
  annualRevenue: text('annual_revenue'),
  customFields: jsonb('custom_fields').default({}),
  sourceMetadata: jsonb('source_metadata').default({}),
  deletedAt: timestamptz('deleted_at'),
  lastSyncedAt: timestamptz('last_synced_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

`packages/db/src/schema/deals.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamptz, integer, numeric, date } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { organizations } from './organizations';
import { tenantMembers } from './tenant-members';

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  sourceProvider: text('source_provider'),
  sourceId: text('source_id'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  name: text('name').notNull(),
  amount: numeric('amount'),
  currency: text('currency').notNull().default('USD'),
  stage: text('stage'),
  probability: integer('probability'),
  closeDate: date('close_date'),
  ownerId: uuid('owner_id').references(() => tenantMembers.id),
  customFields: jsonb('custom_fields').default({}),
  sourceMetadata: jsonb('source_metadata').default({}),
  deletedAt: timestamptz('deleted_at'),
  lastSyncedAt: timestamptz('last_synced_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

`packages/db/src/schema/tickets.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamptz } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { organizations } from './organizations';

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  sourceProvider: text('source_provider'),
  sourceId: text('source_id'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  subject: text('subject').notNull(),
  status: text('status'),
  priority: text('priority'),
  category: text('category'),
  assigneeId: uuid('assignee_id'),
  customFields: jsonb('custom_fields').default({}),
  sourceMetadata: jsonb('source_metadata').default({}),
  deletedAt: timestamptz('deleted_at'),
  lastSyncedAt: timestamptz('last_synced_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

`packages/db/src/schema/contacts.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamptz } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { organizations } from './organizations';

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  sourceProvider: text('source_provider'),
  sourceId: text('source_id'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  title: text('title'),
  customFields: jsonb('custom_fields').default({}),
  sourceMetadata: jsonb('source_metadata').default({}),
  deletedAt: timestamptz('deleted_at'),
  lastSyncedAt: timestamptz('last_synced_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

`packages/db/src/schema/meetings.ts`:
```typescript
import { pgTable, uuid, text, jsonb, timestamptz } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { organizations } from './organizations';

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  sourceProvider: text('source_provider'),
  sourceId: text('source_id'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  title: text('title').notNull(),
  startTime: timestamptz('start_time'),
  endTime: timestamptz('end_time'),
  attendees: jsonb('attendees').default([]),
  transcript: text('transcript'),
  summary: text('summary'),
  customFields: jsonb('custom_fields').default({}),
  sourceMetadata: jsonb('source_metadata').default({}),
  deletedAt: timestamptz('deleted_at'),
  lastSyncedAt: timestamptz('last_synced_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

Update `packages/db/src/schema/index.ts` to export all new tables.

**Step 4: Run test to verify it passes**

Run: `cd packages/db && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: add normalized business data schema (organizations, deals, tickets, contacts, meetings)"
```

---

### Task 1.5: Drizzle Schema — Integration, Mapping & Sync Tables

**Files:**
- Create: `packages/db/src/schema/integration-connections.ts`
- Create: `packages/db/src/schema/custom-field-definitions.ts`
- Create: `packages/db/src/schema/stage-mappings.ts`
- Create: `packages/db/src/schema/sync-events.ts`
- Update: `packages/db/src/schema/index.ts`
- Test: `packages/db/src/__tests__/integration-schema.test.ts`

Follow same TDD pattern: write failing test for column names → implement schema → verify passes → commit.

Key schema details:
- `integration_connections`: provider_type, provider_name, credentials (jsonb encrypted), sync_state (jsonb), sync_schedule
- `tenant_custom_field_definitions`: includes `mapping_status` column (pending/active/reindexing)
- `stage_mappings`: includes `is_closed` and `is_won` booleans
- `sync_events`: append-only audit log for sync operations

```bash
git commit -m "feat: add integration, field mapping, and sync event schema"
```

---

### Task 1.6: Drizzle Schema — Billing & Plans Tables

**Files:**
- Create: `packages/db/src/schema/plans.ts`
- Create: `packages/db/src/schema/tenant-subscriptions.ts`
- Create: `packages/db/src/schema/tenant-invoices.ts`
- Create: `packages/db/src/schema/tenant-credit-usage.ts`
- Create: `packages/db/src/schema/credit-top-ups.ts`
- Update: `packages/db/src/schema/index.ts`
- Test: `packages/db/src/__tests__/billing-schema.test.ts`

Follow same TDD pattern. Key details:
- `plans`: monthly_credits (nullable = unlimited), max_users, allowed_models, features (jsonb)
- `tenant_subscriptions`: stripe_subscription_id, status, seat_count, trial_ends_at
- `tenant_credit_usage`: period-based credit tracking

```bash
git commit -m "feat: add billing schema (plans, subscriptions, credits, invoices)"
```

---

### Task 1.7: Drizzle Schema — AI, Worker, Notification, Audit Tables

**Files:**
- Create: `packages/db/src/schema/crew-templates.ts`
- Create: `packages/db/src/schema/tenant-crew-overrides.ts`
- Create: `packages/db/src/schema/tenant-ai-settings.ts`
- Create: `packages/db/src/schema/ai-usage.ts`
- Create: `packages/db/src/schema/jobs.ts`
- Create: `packages/db/src/schema/job-schedules.ts`
- Create: `packages/db/src/schema/notification-rules.ts`
- Create: `packages/db/src/schema/notifications.ts`
- Create: `packages/db/src/schema/audit-log.ts`
- Create: `packages/db/src/schema/permissions.ts`
- Create: `packages/db/src/schema/platform-admins.ts`
- Create: `packages/db/src/schema/tenant-auth-settings.ts`
- Create: `packages/db/src/schema/dashboard-configs.ts`
- Create: `packages/db/src/schema/tenant-branding.ts`
- Create: `packages/db/src/schema/tenant-api-keys.ts`
- Update: `packages/db/src/schema/index.ts`
- Test: `packages/db/src/__tests__/remaining-schema.test.ts`

Key details for `crew_templates`:
- `max_context` (jsonb) for context pruning limits: `{ deals: 20, meetings: 10 }`

Follow same TDD pattern.

```bash
git commit -m "feat: add AI, worker, notification, audit, and remaining schema tables"
```

---

### Task 1.8: Tenant-Aware Database Client

**Files:**
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/tenant-client.ts`
- Test: `packages/db/src/__tests__/tenant-client.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createTenantClient } from '../tenant-client';

describe('Tenant Client', () => {
  it('requires a tenant ID', () => {
    expect(() => createTenantClient('')).toThrow('tenant ID is required');
  });

  it('exposes tenant ID on the client', () => {
    const client = createTenantClient('test-tenant-id');
    expect(client.tenantId).toBe('test-tenant-id');
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Implement tenant client**

`packages/db/src/tenant-client.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createTenantClient(tenantId: string) {
  if (!tenantId) {
    throw new Error('tenant ID is required');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });

  return {
    db,
    tenantId,
    // Transaction wrapper that sets SET LOCAL for RLS safety net
    async withTenantContext<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => {
        await tx.execute(
          `SET LOCAL app.current_tenant_id = '${tenantId}'`
        );
        return fn(tx as unknown as typeof db);
      });
    },
  };
}
```

Note: The `SET LOCAL` ensures tenant_id is scoped to the transaction only, preventing leaks in connection-pooled environments (PgBouncer/Supavisor transaction mode).

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: add tenant-aware database client with SET LOCAL transaction isolation"
```

---

### Task 1.9: Drizzle Config & Migration Generation

**Files:**
- Create: `packages/db/drizzle.config.ts`
- Generated: `packages/db/drizzle/` (migration files)

**Step 1: Create Drizzle config**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 2: Generate migrations**

Run: `cd packages/db && pnpm db:generate`
Expected: Migration SQL files created in `packages/db/drizzle/`

**Step 3: Review generated SQL**

Manually inspect the generated migration to ensure all tables, foreign keys, and constraints are correct.

**Step 4: Commit**

```bash
git add packages/db/drizzle packages/db/drizzle.config.ts
git commit -m "feat: generate initial database migration from Drizzle schema"
```

---

### Task 1.10: Seed Data Script

**Files:**
- Create: `packages/db/src/seed.ts`
- Test: Run seed against local Postgres

**Step 1: Write seed script**

Seeds: default plans (starter/pro/enterprise), default permissions, one test tenant, one test user, one test tenant_member.

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

async function seed() {
  const sql = postgres(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  console.log('Seeding plans...');
  await db.insert(schema.plans).values([
    {
      slug: 'starter',
      name: 'Starter',
      monthlyCredits: 50,
      maxUsers: 5,
      allowedModels: ['gemini-2.0-flash'],
      allowedIntegrationTypes: ['crm'],
      features: { configurableDashboards: false, webhookSync: false, whiteLabel: false, apiAccess: false },
      pricePerSeatMonthly: '29',
      sortOrder: 1,
      isActive: true,
    },
    {
      slug: 'pro',
      name: 'Pro',
      monthlyCredits: 500,
      maxUsers: 50,
      allowedModels: ['claude-sonnet-4-20250514', 'gemini-2.0-flash'],
      allowedIntegrationTypes: ['crm', 'meeting', 'ticketing'],
      features: { configurableDashboards: true, webhookSync: true, whiteLabel: false, apiAccess: false },
      pricePerSeatMonthly: '79',
      sortOrder: 2,
      isActive: true,
    },
    {
      slug: 'enterprise',
      name: 'Enterprise',
      monthlyCredits: null, // unlimited
      maxUsers: null, // unlimited
      allowedModels: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'gemini-2.0-flash'],
      allowedIntegrationTypes: ['crm', 'meeting', 'ticketing', 'project', 'enrichment'],
      features: { configurableDashboards: true, webhookSync: true, whiteLabel: true, apiAccess: true },
      pricePerSeatMonthly: '149',
      sortOrder: 3,
      isActive: true,
    },
  ]).onConflictDoNothing();

  console.log('Seeding default permissions...');
  // Insert default permission rows (dashboard:*, settings:*, crew:*, etc.)

  console.log('Seed complete.');
  await sql.end();
}

seed().catch(console.error);
```

**Step 2: Run against local Postgres**

Run: `cd packages/db && pnpm db:migrate && pnpm db:seed`
Expected: Tables created, seed data inserted

**Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "feat: add seed script with default plans and permissions"
```

---

### Task 1.11: RLS Policies Migration

**Files:**
- Create: `packages/db/src/rls-policies.sql` (manual migration)

**Step 1: Write RLS policies**

```sql
-- Enable RLS on all business data tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies (safety net)
CREATE POLICY tenant_isolation_organizations ON organizations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_deals ON deals
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_tickets ON tickets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_contacts ON contacts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_meetings ON meetings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Seat limit enforcement trigger
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

  IF seat_limit IS NOT NULL AND current_count >= seat_limit THEN
    RAISE EXCEPTION 'Seat limit reached (% of %)', current_count, seat_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_seat_limit
  BEFORE INSERT ON tenant_members
  FOR EACH ROW EXECUTE FUNCTION enforce_seat_limit();
```

Note: `current_setting('app.current_tenant_id', true)` — the `true` parameter means return NULL instead of error if the setting doesn't exist, which avoids breaking non-tenant-scoped queries (like migrations and seeds).

**Step 2: Apply and verify**

Run: Apply migration against local Postgres and verify policies are active.

**Step 3: Commit**

```bash
git add packages/db/src/rls-policies.sql
git commit -m "feat: add RLS tenant isolation policies and seat limit trigger"
```

---

### Task 1.12: Vitest Configuration & Root Test Runner

**Files:**
- Create: `packages/db/vitest.config.ts`
- Create: `packages/shared/vitest.config.ts`
- Update: root `turbo.json` (test task config)

**Step 1: Configure Vitest for each package**

```typescript
// packages/db/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 2: Run all tests from root**

Run: `pnpm test`
Expected: All tests pass across packages/db and packages/shared

**Step 3: Commit**

```bash
git add .
git commit -m "feat: configure Vitest for all packages, verify root test runner"
```

---

### Phase 1 Completion Checklist

- [ ] Turborepo monorepo initialized with all directories
- [ ] `packages/shared` exports types, enums, constants
- [ ] `packages/db` has complete Drizzle schema (30+ tables)
- [ ] Tenant-aware DB client with `SET LOCAL` transaction isolation
- [ ] Migrations generated and apply cleanly
- [ ] RLS policies and seat limit trigger in place
- [ ] Seed data for plans and permissions
- [ ] All tests pass via `pnpm test`

---

## Phase 2: Auth + Tenant Resolution

**Goal:** Users can sign in via Google OAuth at `acme.localhost:3000`, middleware resolves tenant from subdomain, sessions are created and validated, roles and permissions work.

### Tasks

**2.1:** Initialize `apps/web` — Next.js 15 app with TypeScript, Tailwind, basic layout
**2.2:** Initialize `packages/auth` — exports session helpers, cookie signing, token hashing
**2.3:** Subdomain middleware — extract slug from Host header, look up tenant, inject headers, handle missing tenant
**2.4:** Google OAuth routes — `/auth/initiate` (redirect to Google), `/auth/callback` (exchange code, create/find user, create session)
**2.5:** Session management — `createSession()`, `validateSession()`, `revokeSession()`, sliding window refresh
**2.6:** `TenantProvider` + `useTenant()` hook — client-side context from server-injected headers
**2.7:** Permission system — `hasPermission()` helper, seeded permissions, middleware guard for API routes
**2.8:** Invitation flow — invite endpoint, email with token, accept invite callback
**2.9:** Login/logout pages — basic UI with shadcn, "Sign in with Google" button, error states
**2.10:** Tests — unit tests for session signing, middleware, permission checks; integration test for full OAuth flow (mocked)

```bash
# Phase 2 commits follow same TDD pattern per task
```

---

## Phase 3: Integration Framework

**Goal:** CRM provider interface defined, MockCRMAdapter works end-to-end, field mapper pipeline tested, sync engine can pull data through an adapter and upsert into normalized tables.

### Tasks

**3.1:** Initialize `packages/integrations` — package structure, types directory
**3.2:** Define `CRMProvider` interface — full TypeScript interface with all methods from design doc
**3.3:** Define supporting types — `SyncOptions`, `SyncResult`, `RawRecord`, `FieldMapping`, `StageMapping`, `RateLimitConfig`
**3.4:** Build `MockCRMAdapter` — implements CRMProvider, returns canned data, supports schema discovery
**3.5:** Build field mapper — type coercion, field mapping application, stage normalization, validation, skip logging
**3.6:** Build sync engine — orchestrates adapter → field mapper → DB upsert → sync_events logging
**3.7:** Build connection manager — OAuth token storage/refresh, connection health checks
**3.8:** Provider registry — maps provider names to adapter classes
**3.9:** Integration connection API routes — create, test, disconnect
**3.10:** Schema discovery API — discover objects/fields from connected CRM, propose mappings
**3.11:** Field mapping review API — save tenant's reviewed mappings, update mapping_status
**3.12:** Tests — unit tests for field mapper pipeline, sync engine with mock adapter, connection manager

---

## Phase 4: Billing + Entitlements

**Goal:** Stripe integration works end-to-end. Tenants start on 14-day Pro trial, can upgrade/downgrade, seat management enforced, credit system works.

### Tasks

**4.1:** Initialize `packages/billing` — Stripe SDK setup, typed Stripe helpers
**4.2:** Plan seeding — ensure Stripe Products and Prices exist, sync to `plans` table
**4.3:** Tenant provisioning — on signup: create Stripe Customer, create Subscription (trial), seed `tenant_credit_usage`
**4.4:** `checkEntitlement()` function — check plan features, seat limits, credit remaining
**4.5:** Stripe webhook handler — idempotent handler for subscription/invoice events
**4.6:** Credit system — deduct credits on crew run, check before execution, handle top-ups
**4.7:** Seat management — add/remove seats, prorated Stripe quantity updates, DB trigger enforcement
**4.8:** Subscription lifecycle — upgrade, downgrade, cancel, reactivate
**4.9:** Billing API routes — get current plan, get invoices, get credit usage, Stripe portal link
**4.10:** Tests — unit tests for entitlement checks, webhook handling; integration test with Stripe test mode

---

## Phase 5: Worker + Background Jobs

**Goal:** Postgres-backed job queue running. Scheduler creates jobs from `job_schedules`. Processor picks up and executes sync jobs. Stall detection works.

### Tasks

**5.1:** Initialize `apps/worker` — Express server, health check endpoint
**5.2:** Job queue processor — `FOR UPDATE SKIP LOCKED` polling loop, per-tenant concurrency limit
**5.3:** Job scheduler — minute-by-minute check of `job_schedules`, enqueue jobs
**5.4:** Stall detection — reset jobs running > 15 minutes
**5.5:** Sync CRM job — uses integration framework to sync a tenant's CRM data
**5.6:** Retry engine — exponential backoff, max attempts, failure notification
**5.7:** Circuit breaker — per-adapter circuit breaker for external API failures
**5.8:** CRM API quota awareness — check `checkQuotaRemaining()` before sync, defer if near limit
**5.9:** Tenant lifecycle jobs — provision, suspend, reactivate, purge
**5.10:** Worker deployment config — Railway Dockerfile, env vars, cron health check
**5.11:** Tests — unit tests for processor, scheduler, retry logic; integration test with mock jobs

---

## Phase 6: Frontend Shell + Dashboards

**Goal:** Working web app with tenant-scoped navigation, data tables showing synced data, entity detail views with custom fields, basic role-based dashboard.

### Tasks

**6.1:** shadcn/ui setup — install, configure Tailwind, add base components (Button, Card, Dialog, Table, etc.)
**6.2:** App shell layout — sidebar, top nav, tenant name, user avatar, role indicator
**6.3:** Zustand stores — `useTenantStore`, `useUIStore`, `useNotificationStore`
**6.4:** React Query setup — `QueryProvider`, base API client with tenant headers
**6.5:** DataTable component — generic sortable/filterable table with pagination, supports dynamic custom field columns
**6.6:** EntityDetail component — generic detail view, renders standard + custom fields
**6.7:** Organizations list + detail pages
**6.8:** Deals list + detail pages
**6.9:** Tickets list + detail pages
**6.10:** Contacts list + detail pages
**6.11:** Dashboard page — widget registry, default layouts per role, widget components (deal pipeline, health summary, recent analyses)
**6.12:** Entitlement-aware UI — `useEntitlements()` hook, feature gating, upgrade prompts
**6.13:** Global search — Postgres full-text search, search bar component
**6.14:** Tests — component tests for DataTable, EntityDetail; page-level smoke tests

---

## Phase 7: AI Service + Crew Execution

**Goal:** Python FastAPI service running, `CrewExecutor` interface defined, one working crew (account health), async execution through job queue, results visible in UI.

### Tasks

**7.1:** Initialize `apps/ai-service` — FastAPI, Uvicorn, project structure, health endpoint
**7.2:** `CrewExecutor` protocol — Python interface definition
**7.3:** `CrewAIExecutor` implementation — wraps CrewAI library, implements protocol
**7.4:** Account health crew — port from LUCI, adapt to normalized data input
**7.5:** Context assembler (web side) — build CRM-agnostic payloads from normalized tables, apply pruning limits from `crew_templates.max_context`
**7.6:** Pre-execution estimation — token count estimation, credit budget check, context size validation
**7.7:** Async execution flow — web enqueues `ai_job`, worker calls AI service, stores results, notifies
**7.8:** AI usage tracking — log tokens, model, cost estimate, execution time
**7.9:** Crew templates seeding — seed default crews with configs, context requirements, credit costs
**7.10:** Analysis results API + UI — list past analyses, view results, run new analysis button
**7.11:** Tests — unit tests for context assembler, token estimation; integration test with mock executor

---

## Phase 8: Settings, Notifications, Observability

**Goal:** Tenant admin can self-serve all settings. Notification system works. Structured logging and Sentry integrated.

### Tasks

**8.1:** Initialize `packages/observability` — structured logger, Sentry config, trace ID generation
**8.2:** Integrate logging across all services — tenant context on every log line
**8.3:** Sentry integration — error tracking with tenant tags, performance monitoring
**8.4:** Settings: Integrations page — marketplace UI, connect/disconnect, sync status
**8.5:** Settings: Members page — invite, change role, deactivate, seat count display
**8.6:** Settings: Billing page — current plan, credit usage, invoices, Stripe portal link
**8.7:** Settings: Crew customization page — view templates, override prompts, enable/disable
**8.8:** Settings: Field mappings page — view/edit custom field definitions, stage mappings
**8.9:** Notification system — event emitter, notification rules engine, delivery jobs (email, in-app)
**8.10:** Settings: Notifications page — configure notification rules per event type
**8.11:** In-app notification UI — bell icon, notification dropdown, mark as read
**8.12:** Audit log — append-only logging for sensitive operations, API route for Enterprise tenants
**8.13:** Tests — unit tests for notification rules engine, audit logging; integration tests for settings flows

---

## Phase 9: Polish, E2E Tests, Deploy

**Goal:** Production-ready. E2E tests cover critical paths. Platform admin dashboard works. Tenant branding/theming. Deployment configured.

### Tasks

**9.1:** Platform admin dashboard — tenant list, health overview, MRR, impersonation
**9.2:** Platform alerting — alert rules, Slack notifications for critical events
**9.3:** Tenant branding — logo, colors, CSS custom properties, plan-gated tiers
**9.4:** Data export — CSV/Excel export from any data table
**9.5:** Public API — `/api/v1/` routes, API key auth, scoped access, rate limiting
**9.6:** GDPR basics — full tenant data export endpoint, tenant purge job, retention policies
**9.7:** Playwright E2E suite — signup flow, connect CRM, view data, run analysis, billing
**9.8:** Vercel deployment — `apps/web` config, environment variables, domain setup
**9.9:** Railway deployment — `apps/worker` and `apps/ai-service` Dockerfiles, health checks
**9.10:** Wildcard DNS + subdomain routing — production domain configuration
**9.11:** Production smoke test — deploy, create tenant, verify full flow
**9.12:** Documentation — README, architecture overview, development setup guide

---

## Appendix: External Review Refinements

The following refinements from external review have been incorporated into the design doc and this plan:

1. **Immutable field mappings** — `mapping_status` column prevents mid-stream corruption (Task 1.5)
2. **`SET LOCAL` for RLS** — Transaction-scoped session variables prevent pool leaks (Task 1.8, 1.11)
3. **Pre-execution estimation** — Token count + credit check before AI execution (Task 7.6)
4. **Context pruning** — `max_context` limits per crew template (Task 7.5)
5. **Async AI execution** — Job queue pattern avoids HTTP timeouts (Task 7.7)
6. **CRM API quota awareness** — Auto-defer background syncs near rate limits (Task 5.8)
7. **`is_closed`/`is_won` on stage mappings** — CRM-agnostic terminal stage queries (Task 1.5)
8. **Database-level seat enforcement** — Postgres trigger prevents over-provisioning (Task 1.11)
