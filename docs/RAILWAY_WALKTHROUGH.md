# Complete Railway Deployment Walkthrough

Step-by-step guide to deploy the WF Platform to Railway from scratch.

## Pre-Deployment Checklist

Before starting, gather these items:

- [ ] Railway account (free tier is fine to start)
- [ ] GitHub repository pushed and up-to-date
- [ ] OpenAI API key (for AI features)
- [ ] Anthropic API key (optional, for Claude models)
- [ ] Sentry DSN (optional, for error tracking)
- [ ] Domain name (optional, Railway provides free subdomains)

---

## Part 1: Railway Account Setup (5 minutes)

### Step 1: Create Railway Account

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Sign up with GitHub (recommended for auto-deploy)
4. Authorize Railway to access your GitHub account

### Step 2: Install Railway CLI (Optional but Recommended)

```bash
# Install globally
npm install -g @railway/cli

# Login to Railway
railway login

# This will open a browser for authentication
```

---

## Part 2: Create the Project (2 minutes)

### Step 3: Create New Project

**Via Railway Dashboard:**

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository: `MondayMorning`
4. Railway will scan your repo but DON'T deploy yet

**Or via CLI:**

```bash
# In your project directory
cd /path/to/MondayMorning

# Initialize Railway project
railway init

# Link to your repo
railway link
```

### Step 4: Project Settings

1. Click on your project name (top left)
2. Go to **Settings**
3. Set **Project Name**: `wf-platform` (or your preference)
4. Note your Project ID for later

---

## Part 3: Add PostgreSQL Database (3 minutes)

### Step 5: Add Database Service

**Option A: Railway Postgres (Recommended)**

1. Click **"+ New"** in your project
2. Select **"Database"**
3. Choose **"Add PostgreSQL"**
4. Railway will provision a database (~30 seconds)
5. Click on the Postgres service
6. Go to **"Variables"** tab
7. Copy `DATABASE_URL` value (you'll need this)

**Option B: Use Existing Supabase**

If you're already using Supabase:

1. Click **"+ New"** → **"Empty Service"**
2. Name it `postgres-external`
3. Add variable: `DATABASE_URL=your-supabase-connection-string`

### Step 6: Test Database Connection

```bash
# Via CLI
railway run psql $DATABASE_URL

# You should see PostgreSQL prompt
# Type \q to exit
```

---

## Part 4: Create Service 1 - Web App (10 minutes)

### Step 7: Create Web Service

1. Click **"+ New"** in your project
2. Select **"GitHub Repo"**
3. Choose your `MondayMorning` repository
4. Railway will detect it's a monorepo

### Step 8: Configure Web Service

Click on the new service, then:

**1. General Settings:**
- Service Name: `web`
- Root Directory: `/` (leave as is)
- Build Command: (leave empty, using Dockerfile)

**2. Build Settings:**
- Builder: `Dockerfile`
- Dockerfile Path: `apps/web/Dockerfile`

**3. Deploy Settings:**
- Port: `3000` (Railway auto-detects from EXPOSE)
- Health Check Path: `/api/health`
- Restart Policy: `On Failure`
- Max Retries: `10`

**4. Networking:**
- Public Networking: ✅ Enabled
- Click **"Generate Domain"** to get a Railway subdomain

### Step 9: Add Web Environment Variables

Click **"Variables"** tab, then **"+ New Variable"** for each:

```bash
# Core
NODE_ENV=production

# Database (Reference from Postgres service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# NextAuth
NEXTAUTH_SECRET=<click "Generate" or paste 32-char string>
NEXTAUTH_URL=${{web.PUBLIC_URL}}

# Internal Service URLs
AI_SERVICE_URL=http://ai-service.railway.internal:8000

# Logging (Optional)
LOG_LEVEL=info
SERVICE_NAME=web
```

**To generate NEXTAUTH_SECRET:**
```bash
# Run this locally to generate a secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 10: Add Sentry Variables (Optional)

```bash
SENTRY_DSN=https://your-key@sentry.io/your-project
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
SENTRY_TRACES_SAMPLE_RATE=0.1

# Public variables (for browser)
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_ENABLED=true
```

### Step 11: Deploy Web Service

1. Click **"Deploy"** (top right)
2. Watch the build logs
3. Wait for **"Success"** status (~3-5 minutes for first build)
4. Click on generated domain to see your app

**Troubleshooting Web Deploy:**
- Build fails? Check Dockerfile path is correct
- 503 errors? Check database connection
- Can't access? Ensure public networking is enabled

---

## Part 5: Create Service 2 - Worker (5 minutes)

### Step 12: Create Worker Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Choose `MondayMorning` repository again
3. Railway creates a new service from same repo

### Step 13: Configure Worker Service

**1. General Settings:**
- Service Name: `worker`
- Root Directory: `/`

**2. Build Settings:**
- Builder: `Dockerfile`
- Dockerfile Path: `apps/web/Dockerfile.worker`

**3. Deploy Settings:**
- No port needed (internal service)
- Health Check: Leave empty (process-based)
- Restart Policy: `Always` (worker should always run)

**4. Networking:**
- Public Networking: ❌ Disabled (internal only)

### Step 14: Add Worker Environment Variables

```bash
# Core
NODE_ENV=production

# Database (Reference from Postgres)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Internal Services
AI_SERVICE_URL=http://ai-service.railway.internal:8000

# Worker Config
POLL_INTERVAL_MS=5000
MAX_ATTEMPTS=3

# Logging
LOG_LEVEL=info
SERVICE_NAME=worker

# Sentry (Optional)
SENTRY_DSN=https://your-key@sentry.io/your-project
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
```

### Step 15: Deploy Worker

1. Click **"Deploy"**
2. Wait for build to complete
3. Check logs: `railway logs --service worker`
4. You should see: "AI Execution Worker starting..."

---

## Part 6: Create Service 3 - AI Service (5 minutes)

### Step 16: Create AI Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Choose `MondayMorning` repository
3. New service created

### Step 17: Configure AI Service

**1. General Settings:**
- Service Name: `ai-service`
- Root Directory: `/apps/ai-service` ⚠️ IMPORTANT

**2. Build Settings:**
- Builder: `Dockerfile`
- Dockerfile Path: `Dockerfile` (relative to root directory)

**3. Deploy Settings:**
- Port: `8000`
- Health Check Path: `/api/v1/health`
- Restart Policy: `On Failure`

**4. Networking:**
- Public Networking: ❌ Disabled (internal only)
- Private Networking: ✅ Enabled (default)

### Step 18: Add AI Service Environment Variables

```bash
# Core
ENVIRONMENT=production
LOG_LEVEL=info

# AI API Keys (REQUIRED)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-api03-...

# Service Config
SERVICE_NAME=ai-service
API_PREFIX=/api/v1

# Sentry (Optional)
SENTRY_DSN=https://your-key@sentry.io/your-project
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
```

**⚠️ IMPORTANT:** You MUST add real API keys for OpenAI and/or Anthropic.

### Step 19: Deploy AI Service

1. Click **"Deploy"**
2. Wait for build (~2-3 minutes)
3. Check health: Should show "Success" status

**Test AI Service Internally:**
```bash
railway run curl http://ai-service.railway.internal:8000/api/v1/health
```

---

## Part 7: Run Database Migrations (5 minutes)

### Step 20: Prepare Migration Environment

You have two options:

**Option A: Run Locally Against Railway DB**

1. Get DATABASE_URL from Railway Postgres service
2. Create local `.env.railway.local`:

```bash
DATABASE_URL=postgresql://railway-url-here
```

3. Run migrations:

```bash
# Set environment
export $(cat .env.railway.local | xargs)

# Run migrations
pnpm --filter @wf/db migrate

# Seed crew templates
pnpm --filter @wf/db seed:crews
```

**Option B: Create Migration Service on Railway**

1. Click **"+ New"** → **"Empty Service"**
2. Name: `migrations`
3. Root Directory: `/`
4. Build Command: `echo "Migrations service"`
5. Start Command:

```bash
pnpm install && pnpm --filter @wf/db migrate && pnpm --filter @wf/db seed:crews && echo "Migrations complete - stopping service"
```

6. Add variable: `DATABASE_URL=${{Postgres.DATABASE_URL}}`
7. Deploy once
8. After success, you can delete this service

### Step 21: Verify Database Schema

```bash
# Connect to Railway database
railway run psql $DATABASE_URL

# Check tables
\dt

# You should see:
# - tenants
# - users
# - organizations
# - deals
# - contacts
# - tickets
# - ai_executions
# - ai_execution_jobs
# - crew_templates
# - notifications
# (and more)

# Exit
\q
```

---

## Part 8: Final Configuration (5 minutes)

### Step 22: Update Web Service with Domain

If you have a custom domain:

1. Go to Web service → **"Settings"** → **"Domains"**
2. Click **"Custom Domain"**
3. Enter your domain: `app.yourdomain.com`
4. Railway provides DNS settings
5. Update your DNS with CNAME record

**Update NEXTAUTH_URL:**
1. Web service → **"Variables"**
2. Update `NEXTAUTH_URL` to your custom domain
3. Redeploy

### Step 23: Configure CORS (If Needed)

If you're using a custom domain, update Next.js config:

**apps/web/next.config.ts:**
```typescript
const nextConfig: NextConfig = {
  // ... existing config
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
        ],
      },
    ];
  },
};
```

### Step 24: Set Up Monitoring

**Enable Railway Monitoring:**
1. Each service → **"Observability"** tab
2. View metrics: CPU, Memory, Network
3. Set up alerts (optional)

**Configure Sentry Alerts:**
1. Go to sentry.io
2. Project Settings → Alerts
3. Create alerts for error rate, performance

---

## Part 9: Verify Deployment (10 minutes)

### Step 25: Check All Services are Running

**Railway Dashboard:**
```
✅ postgres - Running
✅ web - Running (with public URL)
✅ worker - Running
✅ ai-service - Running
```

### Step 26: Test Web Application

1. Open web service public URL
2. You should see the landing page
3. Test health endpoint: `https://your-url.railway.app/api/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-02-24T...",
  "service": "web",
  "version": "0.0.1"
}
```

### Step 27: Test Worker Service

```bash
# View worker logs
railway logs --service worker --follow

# You should see:
# "AI Execution Worker starting"
# "AI Service URL: http://ai-service.railway.internal:8000"
# "Poll interval: 5000ms"
```

### Step 28: Test AI Service

```bash
# Test from worker or web service
railway run --service web \
  curl http://ai-service.railway.internal:8000/api/v1/health

# Expected response:
{
  "status": "healthy",
  "service": "ai-service"
}
```

### Step 29: Test Full Flow (AI Execution)

**Via API:**
```bash
# Create AI execution
curl -X POST https://your-url.railway.app/api/crews/execute \
  -H "Content-Type: application/json" \
  -d '{
    "crewTemplateId": "account_health",
    "entityId": "org-123",
    "tenantId": "tenant-1",
    "userId": "user-1"
  }'

# Should return:
{
  "executionId": "...",
  "status": "pending",
  "estimate": {...}
}
```

**Check worker logs:**
```bash
railway logs --service worker --follow

# You should see:
# "Found 1 pending jobs"
# "Processing job..."
# "Job completed successfully"
```

---

## Part 10: Post-Deployment (Ongoing)

### Step 30: Monitor Logs

**View logs for all services:**
```bash
# Web logs
railway logs --service web --follow

# Worker logs
railway logs --service worker --follow

# AI service logs
railway logs --service ai-service --follow

# All services
railway logs --follow
```

### Step 31: Set Up Backups

**Railway Postgres:**
- Automatic daily backups (included)
- View in Postgres service → "Backups" tab

**Manual backup:**
```bash
# Download backup
railway run --service postgres pg_dump $DATABASE_URL > backup.sql
```

### Step 32: Cost Monitoring

**View usage:**
1. Project → "Usage" tab
2. Monitor:
   - Compute hours
   - Database size
   - Bandwidth
   - Current month cost

**Free tier includes:**
- $5 credit/month
- 500 hours execution
- Good for development/testing

**Paid plans:**
- Hobby: $5/month
- Pro: $20/month
- Scale based on usage

---

## Troubleshooting Guide

### Build Failures

**Issue: "Cannot find module @wf/..."**
```bash
# Fix: Check package.json dependencies
# Make sure all @wf/* packages are installed
```

**Issue: "Dockerfile not found"**
```bash
# Fix: Check Dockerfile path in service settings
# For web: apps/web/Dockerfile
# For worker: apps/web/Dockerfile.worker
# For AI: Dockerfile (with root dir set to apps/ai-service)
```

### Runtime Errors

**Issue: "Database connection failed"**
```bash
# Check DATABASE_URL is set correctly
railway variables --service web

# Test connection
railway run --service web psql $DATABASE_URL
```

**Issue: "Cannot reach AI service"**
```bash
# Check internal URL is correct:
# http://ai-service.railway.internal:8000

# Not:
# http://ai-service:8000 (missing .railway.internal)
```

**Issue: "Worker not processing jobs"**
```bash
# Check worker logs
railway logs --service worker

# Verify AI_SERVICE_URL is set
railway variables --service worker

# Check database connection
```

### Performance Issues

**Issue: "Slow response times"**
```bash
# Check metrics in Railway dashboard
# Look for:
# - High CPU usage (may need to scale)
# - Memory spikes
# - Database query time

# Solutions:
# 1. Add database indexes
# 2. Enable connection pooling
# 3. Scale to larger instance
```

---

## Scaling Guide

### Horizontal Scaling (Multiple Instances)

**Web Service:**
```bash
# In Railway dashboard
Service → Settings → Scaling
Replicas: 2 (or more)
```

**Worker Service:**
```bash
# Be careful with workers - may cause duplicate processing
# Better: Increase POLL_INTERVAL_MS or optimize job processing
```

### Vertical Scaling (Larger Instances)

Railway auto-scales resources. You can set limits:

```bash
Service → Settings → Resources
CPU: 2 vCPU
Memory: 2GB
```

---

## Security Checklist

- [ ] All secrets in Railway environment variables (not code)
- [ ] NEXTAUTH_SECRET is strong (32+ random characters)
- [ ] Database not publicly accessible
- [ ] AI service is internal-only
- [ ] CORS configured correctly
- [ ] Sentry enabled for error tracking
- [ ] Regular backups enabled
- [ ] Monitoring and alerts configured

---

## What's Next?

After successful deployment:

1. **Add Authentication** - Implement user login/signup
2. **Create First Tenant** - Seed initial data
3. **Connect CRM** - Add Salesforce/HubSpot integration
4. **Test AI Analysis** - Run account health analysis
5. **Invite Team** - Add team members
6. **Monitor Usage** - Track credits and API usage
7. **Scale as Needed** - Adjust resources based on traffic

---

## Getting Help

- **Railway Discord**: https://discord.gg/railway
- **Railway Docs**: https://docs.railway.app
- **Project Issues**: https://github.com/webfeathers/MondayMorning/issues

---

## Quick Reference

### Essential URLs
```
Web App: https://web-production-xxx.railway.app
Database: railway.app/project/xxx/service/postgres
Project: railway.app/project/xxx
```

### Essential Commands
```bash
# View logs
railway logs --service <service-name> --follow

# Run migrations
railway run --service web pnpm --filter @wf/db migrate

# Connect to database
railway run --service web psql $DATABASE_URL

# Redeploy service
railway up --service <service-name>

# View environment variables
railway variables --service <service-name>
```

### Service Names
- `postgres` - Database
- `web` - Next.js application
- `worker` - Background job processor
- `ai-service` - AI execution service

---

🎉 **Congratulations!** Your WF Platform is now deployed on Railway!
