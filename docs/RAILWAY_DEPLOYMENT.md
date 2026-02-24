# Railway Deployment Guide

Complete guide for deploying the WF Platform to Railway.

## Architecture

The platform consists of 3 services:
- **Web**: Next.js application (port 3000)
- **Worker**: Background job processor
- **AI Service**: Python FastAPI service (port 8000)

Plus a PostgreSQL database (Supabase or Railway Postgres).

## Prerequisites

1. Railway account: https://railway.app
2. Railway CLI installed: `npm install -g @railway/cli`
3. GitHub repository connected to Railway

## Setup Steps

### 1. Create Railway Project

```bash
# Login to Railway
railway login

# Create new project
railway init

# Link to GitHub repository
railway link
```

### 2. Add Database

**Option A: Use existing Supabase**
- Add Supabase connection string as environment variable
- DATABASE_URL="postgresql://..."

**Option B: Add Railway Postgres**
```bash
railway add --database postgres
```

### 3. Create Services

You'll create 3 services in Railway, one for each component:

#### Service 1: Web (Next.js)

```bash
# Create web service
railway service create web

# Set Dockerfile path
railway service --name web

# Configure service
```

**Settings:**
- Root Directory: `/`
- Dockerfile Path: `apps/web/Dockerfile`
- Port: `3000`
- Health Check Path: `/api/health`

**Environment Variables:**
```bash
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
NEXTAUTH_SECRET=<generate-random-secret>
NEXTAUTH_URL=https://your-domain.railway.app
AI_SERVICE_URL=http://ai-service.railway.internal:8000

# Sentry (optional)
SENTRY_DSN=<your-sentry-dsn>
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
SENTRY_TRACES_SAMPLE_RATE=0.1
```

#### Service 2: Worker

**Settings:**
- Root Directory: `/`
- Dockerfile Path: `apps/web/Dockerfile.worker`
- No public port needed (internal service)

**Environment Variables:**
```bash
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
AI_SERVICE_URL=http://ai-service.railway.internal:8000
SENTRY_DSN=<your-sentry-dsn>
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
```

#### Service 3: AI Service

**Settings:**
- Root Directory: `/apps/ai-service`
- Dockerfile Path: `Dockerfile`
- Port: `8000`
- Health Check Path: `/api/v1/health`

**Environment Variables:**
```bash
ENVIRONMENT=production
LOG_LEVEL=info
OPENAI_API_KEY=<your-openai-key>
ANTHROPIC_API_KEY=<your-anthropic-key>
SENTRY_DSN=<your-sentry-dsn>
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
```

### 4. Configure Private Networking

Railway services can communicate internally:

- Web can reach AI Service via: `http://ai-service.railway.internal:8000`
- Worker can reach AI Service via: `http://ai-service.railway.internal:8000`
- All services share the same database connection

### 5. Run Database Migrations

```bash
# Connect to your project
railway link

# Run migrations
railway run pnpm --filter @wf/db migrate
```

Or add a migration service:

**Migration Service (one-time):**
```bash
railway service create migrations
```

Set the start command to:
```bash
pnpm --filter @wf/db migrate && echo "Migrations complete"
```

### 6. Configure Custom Domain (Optional)

```bash
# Add domain to web service
railway domain

# Follow prompts to add your domain
```

Update DNS:
- Add CNAME record pointing to Railway domain

## Environment Variables Reference

### Required for All Services

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
NODE_ENV=production
```

### Web Service

```bash
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=https://your-domain.com
AI_SERVICE_URL=http://ai-service.railway.internal:8000
```

### AI Service

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
ENVIRONMENT=production
LOG_LEVEL=info
```

### Optional (Sentry)

```bash
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

## Deployment

Railway will automatically deploy when you push to your connected branch:

```bash
git push origin main
```

Or manually trigger:

```bash
railway up
```

## Monitoring

### Logs

```bash
# View web logs
railway logs --service web

# View worker logs
railway logs --service worker

# View AI service logs
railway logs --service ai-service

# Follow logs
railway logs --service web --follow
```

### Health Checks

- Web: `https://your-domain.com/api/health`
- AI Service: `https://ai-service-url.railway.app/api/v1/health`

### Metrics

Railway dashboard provides:
- CPU usage
- Memory usage
- Network traffic
- Response times
- Error rates

## Scaling

### Horizontal Scaling

```bash
# Scale web service to 2 replicas
railway service --name web
# In Railway dashboard: Set replicas to 2
```

### Vertical Scaling

Railway auto-scales resources based on usage. You can set limits in the dashboard.

## Troubleshooting

### Build Failures

```bash
# Check build logs
railway logs --build

# Common issues:
# 1. Missing environment variables
# 2. Incorrect Dockerfile path
# 3. Missing dependencies in package.json
```

### Runtime Errors

```bash
# Check runtime logs
railway logs --service web

# Common issues:
# 1. Database connection failure (check DATABASE_URL)
# 2. Missing environment variables
# 3. Port configuration (Railway injects PORT variable)
```

### Database Connection

```bash
# Test database connection
railway run pnpm --filter @wf/db drizzle-kit studio
```

### Service Communication

```bash
# Test internal networking
railway run curl http://ai-service.railway.internal:8000/api/v1/health
```

## Cost Optimization

1. **Use Railway Postgres** instead of Supabase for lower latency
2. **Single replica** for non-critical services
3. **Sleep on inactivity** for dev environments
4. **Monitor resource usage** and set appropriate limits
5. **Use Sentry sampling** (10% trace rate) to control costs

## Security

1. **Rotate secrets regularly**: NEXTAUTH_SECRET, API keys
2. **Use environment variables**: Never commit secrets
3. **Enable Railway's built-in security**:
   - Private networking
   - Automatic HTTPS
   - DDoS protection
4. **Configure CORS** appropriately in Next.js and FastAPI
5. **Set up Sentry** for error tracking and security monitoring

## Backup and Disaster Recovery

1. **Database backups**: Railway Postgres auto-backs up daily
2. **Export backups**: Download via Railway dashboard
3. **Test restoration** regularly
4. **Document recovery procedures**

## CI/CD

Railway automatically deploys on push. For more control:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## Support

- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app
- Platform Issues: https://github.com/webfeathers/MondayMorning/issues
