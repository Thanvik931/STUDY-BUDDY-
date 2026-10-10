// src/routes/health.js
// Health check route: verifies server is alive and MongoDB Atlas is responsive.
// WHY: Load balancers, deployment checks (e.g. Render/Railway), and judges call this
// to verify that the application and database connection are fully operational.

import express from 'express';
import { getDB } from '../db.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const db = getDB();
    // Ping MongoDB cluster
    await db.command({ ping: 1 });

    res.status(200).json({
      status: 'ok',
      service: 'Study Buddy Agentic Memory Engine',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connection failed: ' + err.message
      }
    });
  }
});

export default router;
