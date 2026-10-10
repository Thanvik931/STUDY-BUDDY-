// src/routes/health.js
// Health check route: verifies server is alive and MongoDB Atlas is responsive.
// WHY: Load balancers, deployment checks (e.g. Render/Railway), and judges call this
// to verify that the application and database connection are fully operational.

import express from 'express';
import { getDB } from '../db.js';
import { env } from '../config/env.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  let mongo = 'down';

  try {
    const db = getDB();
    // Real ping to MongoDB Atlas cluster
    await db.command({ ping: 1 });
    mongo = 'ok';
  } catch (err) {
    mongo = 'down';
  }

  const isHealthy = mongo === 'ok';
  const status = isHealthy ? 'ok' : 'down';

  res.status(isHealthy ? 200 : 503).json({
    status,
    stressMode: env.STRESS_MODE,
    mongo
  });
});

export default router;
