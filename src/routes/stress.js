// src/routes/stress.js
// Runtime flag configuration for stress testing.
// WHY: Allows the automated test harness to inject faults (e.g. failEmbedding, failAi, delayAiMs)
// dynamically at runtime without restarting the server.
// INVARIANT: This route is mounted ONLY when STRESS_MODE=true. If STRESS_MODE is false, it returns 404.

import express from 'express';
import { env, setStressFlags, getStressFlags, resetStressFlags } from '../config/env.js';

const router = express.Router();

// Safety Guard: if somehow mounted when STRESS_MODE is false, reject immediately
router.use((req, res, next) => {
  if (!env.STRESS_MODE) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Stress testing endpoints are disabled in normal operation'
      }
    });
  }
  next();
});

// POST /api/stress/flags - Dynamically set runtime failure injection flags
router.post('/stress/flags', (req, res) => {
  try {
    const { failEmbedding, failAi, delayAiMs } = req.body || {};
    const updated = setStressFlags({ failEmbedding, failAi, delayAiMs });
    res.status(200).json({
      success: true,
      flags: updated
    });
  } catch (err) {
    res.status(400).json({
      error: {
        code: 'INVALID_STRESS_FLAGS',
        message: err.message
      }
    });
  }
});

// GET /api/stress/flags - Inspect active runtime failure flags
router.get('/stress/flags', (req, res) => {
  res.status(200).json({
    flags: getStressFlags()
  });
});

// POST /api/stress/reset - Reset runtime flags back to initial configuration
router.post('/stress/reset', (req, res) => {
  resetStressFlags();
  res.status(200).json({
    success: true,
    flags: getStressFlags()
  });
});

export default router;
