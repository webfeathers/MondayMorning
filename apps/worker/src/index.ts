import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3001;
const VERSION = process.env.npm_package_version || '0.0.1';

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
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    console.log('HTTP server closed');

    // TODO: Close database connections when implemented
    // TODO: Finish processing current jobs

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
