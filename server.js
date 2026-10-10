// server.js
// Main entry point for the Study Buddy application.
// Hardened with Helmet security headers, Express rate limiting, metrics tracking,
// and consistent error responses.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './src/config/env.js';
import { connectDB, closeDB } from './src/db.js';
import { metricsMiddleware } from './src/middleware/metrics.js';
import { errorHandler, notFoundHandler } from './src/middleware/errors.js';

import healthRouter from './src/routes/health.js';
import metricsRouter from './src/routes/metrics.js';
import progressRouter from './src/routes/progress.js';
import studentsRouter from './src/routes/students.js';
import sessionRouter from './src/routes/session.js';
import quizRouter from './src/routes/quiz.js';
import memoriesRouter from './src/routes/memories.js';
import demoRouter from './src/routes/demo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. Enable trust proxy for platforms like Render, Heroku, or behind Cloudflare
app.set('trust proxy', 1);

// 2. Helmet HTTP Security Headers (with CSP configured to allow Chart.js from CDN)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));

// 3. Metrics tracking middleware (records duration, errors, p50/p95 percentiles)
app.use(metricsMiddleware);

// 4. Rate Limiting: 60 requests/min overall, 20 requests/min on /api/question
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please wait a minute.'
    }
  }
});

const questionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'QUESTION_RATE_LIMIT_EXCEEDED',
      message: 'Too many question requests. Please wait a minute.'
    }
  }
});

// Apply rate limits to API routes
app.use('/api', globalLimiter);
app.use('/api/question', questionLimiter);

// 5. Limit JSON request bodies to 10kb to prevent memory exhaustion attacks
app.use(express.json({ limit: '10kb' }));

// 6. Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// 7. Mount API routes
app.use('/api', healthRouter);
app.use('/api', metricsRouter);
app.use('/api', progressRouter);
app.use('/api', studentsRouter);
app.use('/api', sessionRouter);
app.use('/api', quizRouter);
app.use('/api', memoriesRouter);
app.use('/api', demoRouter);

// 8. 404 Handler for unknown API endpoints
app.use('/api/*', notFoundHandler);

// 9. Centralized Error Handler: ensures consistent { error: { code, message } } format
app.use(errorHandler);

let server;

// Start database and server
async function startServer() {
  try {
    await connectDB();
    server = app.listen(env.PORT, () => {
      console.log(`🚀 Study Buddy server listening on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown: closes connections safely when stopping the app
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await closeDB();
      process.exit(0);
    });
  } else {
    await closeDB();
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();

export default app;
