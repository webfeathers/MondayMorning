import express, { Request, Response } from 'express';
import { hostname } from 'os';
import { randomUUID } from 'crypto';
import { startProcessor, stopProcessor, registerJobHandler } from './processor/job-processor';
import { startScheduler, stopScheduler } from './scheduler/job-scheduler';
import { startStallDetection, stopStallDetection } from './processor/stall-detection';
import { syncCRMJobHandler } from './jobs/sync-crm-job';
import { circuitBreakerRegistry } from './processor/circuit-breaker';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@wf/db';

const app = express();
const PORT = process.env.PORT || 3001;
const VERSION = process.env.npm_package_version || '0.0.1';

// Generate worker ID (use hostname or UUID)
const WORKER_ID = process.env.WORKER_ID || hostname() || randomUUID();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const uptime = process.uptime();
  res.json({
    status: 'ok',
    uptime: Math.floor(uptime),
    version: VERSION,
  });
});

// Metrics endpoint
app.get('/metrics', (req: Request, res: Response) => {
  res.json({
    jobs: {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
    },
    circuitBreakers: circuitBreakerRegistry.getAllMetrics(),
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Worker server listening on port ${PORT}`);
  console.log(`Worker ID: ${WORKER_ID}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Initialize database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}
const sql = postgres(connectionString);
const db = drizzle(sql, { schema });
console.log('Database connection established');

// Start job processor
const processor = startProcessor(WORKER_ID, 1000);
console.log('Job processor initialized and started');

// Register job handlers
registerJobHandler('sync_crm', syncCRMJobHandler);
console.log('Registered job handlers: sync_crm');

// Start job scheduler (check every minute by default)
const checkInterval = process.env.SCHEDULER_CHECK_INTERVAL
  ? parseInt(process.env.SCHEDULER_CHECK_INTERVAL)
  : 60000;
startScheduler(db, checkInterval);
console.log(`Job scheduler started (checking every ${checkInterval}ms)`);

// Start stall detection (check every minute by default)
const stallCheckInterval = process.env.STALL_CHECK_INTERVAL
  ? parseInt(process.env.STALL_CHECK_INTERVAL)
  : 60000;
startStallDetection(stallCheckInterval);
console.log(`Stall detection started (checking every ${stallCheckInterval}ms)`);

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop job scheduler first
  console.log('Stopping job scheduler...');
  stopScheduler();

  // Stop stall detection
  console.log('Stopping stall detection...');
  stopStallDetection();

  // Stop job processor
  console.log('Stopping job processor...');
  stopProcessor();

  server.close(async () => {
    console.log('HTTP server closed');

    // Close database connection
    console.log('Closing database connection...');
    await sql.end();
    console.log('Database connection closed');

    console.log('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
