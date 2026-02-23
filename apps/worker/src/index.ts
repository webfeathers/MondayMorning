import express, { Request, Response } from 'express';
import { hostname } from 'os';
import { randomUUID } from 'crypto';
import { startProcessor, stopProcessor } from './processor/job-processor';

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

// Metrics endpoint (placeholder for now)
app.get('/metrics', (req: Request, res: Response) => {
  res.json({
    jobs: {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
    },
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Worker server listening on port ${PORT}`);
  console.log(`Worker ID: ${WORKER_ID}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Start job processor
const processor = startProcessor(WORKER_ID, 1000);
console.log('Job processor initialized and started');

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop job processor first
  console.log('Stopping job processor...');
  stopProcessor();

  server.close(() => {
    console.log('HTTP server closed');

    // TODO: Close database connections when implemented

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
