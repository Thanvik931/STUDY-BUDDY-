// src/routes/health.js
// Health check routes (Rule 13.4).
// Public liveness probe returns only { status: "ok" }. Detailed diagnostics live behind admin.

import express from 'express';
import { getDB } from '../db.js';
import { env } from '../config/env.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/health - Minimal public liveness probe (Rule 13.4)
router.get('/health', async (req, res) => {
  let mongo = 'ok';
  try {
    const db = getDB();
    await db.command({ ping: 1 });
  } catch (_) {
    mongo = 'down';
  }

  if (mongo === 'down') {
    return res.status(503).json({ status: 'degraded' });
  }

  const response = { status: 'ok' };
  if (env.STRESS_MODE && env.NODE_ENV !== 'production') {
    response.stressMode = true;
    response.mongo = 'ok';
  }
  res.status(200).json(response);
});

// GET /api/health/detailed - Detailed diagnostics (Admin only, Rule 13.4)
if (env.ADMIN_ROUTES_ENABLED) {
  router.get('/health/detailed', requireUser, requireAdmin, async (req, res) => {
    let mongo = 'down';
    try {
      const db = getDB();
      await db.command({ ping: 1 });
      mongo = 'ok';
    } catch (_) {
      mongo = 'down';
    }

    res.status(mongo === 'ok' ? 200 : 503).json({
      status: mongo === 'ok' ? 'ok' : 'degraded',
      mongo,
      stressMode: env.STRESS_MODE,
      demoMode: env.DEMO_MODE,
      nodeVersion: process.version,
      uptime: process.uptime()
    });
  });
}

export default router;
