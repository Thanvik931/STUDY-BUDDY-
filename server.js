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
import stressRouter from './src/routes/stress.js';

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

// 4. Request timeout middleware: 30 seconds max duration
// WHY: Resilience requirement. Prevents slow clients or hung downstream connections from holding server sockets indefinitely.
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(504).json({
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Server request timed out after 30 seconds'
        }
      });
    }
  });
  next();
});

// 4. Rate Limiting: 60 requests/min overall, 20 requests/min on /api/question
// Concurrency rule: Header 'x-stress-bypass-limit: 1' skips limiter ONLY when STRESS_MODE=true
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: (req) => Boolean(env.STRESS_MODE && req.headers['x-stress-bypass-limit'] === '1'),
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
  skip: (req) => Boolean(env.STRESS_MODE && req.headers['x-stress-bypass-limit'] === '1'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'QUESTION_RATE_LIMIT_EXCEEDED',
      message: 'Too many question requests. Please wait a minute.'
    }
  }
});

// 5. Liveness and metrics monitoring endpoints (unthrottled for monitoring/health probes)
app.use('/api', healthRouter);
app.use('/api', metricsRouter);

// 6. Apply rate limits to API routes
app.use('/api', globalLimiter);
app.use('/api/question', questionLimiter);

// 7. Limit JSON request bodies to 10kb to prevent memory exhaustion attacks
app.use(express.json({ limit: '10kb' }));

// 8. Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// 9. Mount API routes
app.use('/api', progressRouter);
app.use('/api', studentsRouter);
app.use('/api', sessionRouter);
app.use('/api', quizRouter);
app.use('/api', memoriesRouter);
app.use('/api', demoRouter);

// Mount stress testing fault-injection routes ONLY when STRESS_MODE=true
if (env.STRESS_MODE) {
  app.use('/api', stressRouter);
}

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
      if (env.STRESS_MODE) {
        console.log('\n' + '!'.repeat(70));
        console.log('⚠️⚠️⚠️  WARNING: SERVER IS RUNNING IN STRESS_MODE!  ⚠️⚠️⚠️');
        console.log('   - External AI calls (Claude) are DISABLED; simulated question bank active.');
        console.log('   - Embeddings are deterministic fake vectors (no paid API calls).');
        console.log('   - Rate limiter bypass header "x-stress-bypass-limit: 1" is ACTIVE.');
        console.log('   - Runtime fault injection routes (/api/stress/flags) are MOUNTED.');
        console.log('   - Test database isolated: "study_buddy_stress".');
        console.log('!'.repeat(70) + '\n');
      }
    });
    // Set 30 seconds HTTP request timeout on server socket layer
    server.requestTimeout = 30000;
    server.headersTimeout = 35000;
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
