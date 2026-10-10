// src/routes/metrics.js
// Exposes API performance metrics including request counts, error counts, p50, and p95 latencies.
// WHY: Section 8 requirement. Demonstrates operational maturity and observability.

import express from 'express';
import { getMetricsData, getEventLoopDelay } from '../middleware/metrics.js';

const router = express.Router();

router.get('/metrics', (req, res) => {
  const routes = getMetricsData();
  const eventLoopDelay = getEventLoopDelay();
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    service: 'Study Buddy Metrics Engine',
    timestamp: new Date().toISOString(),
    eventLoopDelay,
    memoryUsage,
    routes
  });
});

export default router;
