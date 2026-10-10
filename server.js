// server.js
// Main entry point for the Study Buddy application.
// Hardened with Helmet security headers (CSP self-only), Express rate limiting,
// NoSQL sanitization, request IDs, CORS, metrics tracking, and consistent error handling (Rule 13.1 - 13.5).

import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './src/config/env.js';
import { connectDB, closeDB } from './src/db.js';
import { logger } from './src/utils/logger.js';
import { metricsMiddleware } from './src/middleware/metrics.js';
import { sanitizeInputs } from './src/middleware/sanitize.js';
import { errorHandler, notFoundHandler } from './src/middleware/errors.js';

import healthRouter from './src/routes/health.js';
import metricsRouter from './src/routes/metrics.js';
import authRouter from './src/routes/auth.js';
import progressRouter from './src/routes/progress.js';
import studentsRouter from './src/routes/students.js';
import sessionRouter from './src/routes/session.js';
import quizRouter from './src/routes/quiz.js';
import memoriesRouter from './src/routes/memories.js';
import lessonsRouter from './src/routes/lessons.js';
import tutorRouter from './src/routes/tutor.js';
import demoRouter from './src/routes/demo.js';
import stressRouter from './src/routes/stress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. Disable X-Powered-By to prevent fingerprinting (Rule 13.2)
app.disable('x-powered-by');

// 2. Trust proxy (for reverse proxies, Render, Cloudflare, etc.)
app.set('trust proxy', 1);

// 3. Request ID middleware (Rule 13.2)
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('x-request-id', reqId);
  next();
});

// 4. HTTPS redirect in production (Rule 13.8)
if (env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// 5. Helmet HTTP Security Headers (strict self-hosted CSP, HSTS, referrer policy) (Rules 13.1, 13.8)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // Chart.js is self-hosted in public/vendor/chart.umd.js (Rule 13.1c)
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  hsts: env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// 6. CORS headers (Rules 13.5, 13.8)
const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [env.SITE_URL];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-stress-bypass-limit, x-requested-with');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 7. API Cache-Control: no-store, private (Rule 13.8)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// 8. Metrics tracking middleware
app.use(metricsMiddleware);

// 9. Request timeout: 30 seconds max duration
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

// 10. Rate Limiters (Rules 13.1, 13.5)
const isStressBypass = (req) => Boolean(
  env.STRESS_MODE && env.NODE_ENV !== 'production' && req.headers['x-stress-bypass-limit'] === '1'
);

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: isStressBypass,
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
  skip: isStressBypass,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'QUESTION_RATE_LIMIT_EXCEEDED',
      message: 'Too many question requests. Please wait a minute.'
    }
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skip: isStressBypass,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again after 15 minutes.'
    }
  }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  skip: isStressBypass,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many accounts created from this IP. Please try again later.'
    }
  }
});

// 11. Health & metrics endpoints (unthrottled for monitoring)
app.use('/api', healthRouter);
app.use('/api', metricsRouter);

// 12. Rate limiting applied to API & Auth endpoints
app.use('/api', globalLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/signup', signupLimiter);
app.use('/api/question', questionLimiter);

// 13. Limit JSON request bodies to 10kb to prevent memory exhaustion attacks (Rule 13.5)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 14. NoSQL operator injection and string sanitization (Rule 13.5)
app.use(sanitizeInputs);

// 15. Serve static frontend files from /public with no-cache in dev to prevent stale browser caches
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// 16. Mount API routes
app.use('/api', authRouter);
app.use('/api', progressRouter);
app.use('/api', studentsRouter);
app.use('/api', sessionRouter);
app.use('/api', quizRouter);
app.use('/api', memoriesRouter);
app.use('/api', lessonsRouter);
app.use('/api', tutorRouter);

// Demo routes only if DEMO_MODE and not production (Rule 13.1b)
if (env.DEMO_MODE && env.NODE_ENV !== 'production') {
  app.use('/api', demoRouter);
}

// Stress testing fault-injection routes only if STRESS_MODE and not production (Rule 13.1b)
if (env.STRESS_MODE && env.NODE_ENV !== 'production') {
  app.use('/api', stressRouter);
}

// 17. 404 Handler for unknown API endpoints
app.use('/api/*', notFoundHandler);

// 18. Centralized Error Handler (Rule 13.2, 13.5)
app.use(errorHandler);

let server;

// Start database and server
async function startServer() {
  try {
    await connectDB();
    server = app.listen(env.PORT, () => {
      logger.info(`Study Buddy server listening on http://localhost:${env.PORT}`);
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
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown: closes connections safely when stopping the app
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
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
