// src/routes/metrics.js
// Exposes API performance metrics including request counts, error counts, p50, and p95 latencies.
// WHY: Section 8 requirement. Demonstrates operational maturity and observability.

import express from 'express';
import { getMetricsData } from '../middleware/metrics.js';

const router = express.Router();

router.get('/metrics', (req, res) => {
  const data = getMetricsData();
  res.status(200).json({
    service: 'Study Buddy Metrics Engine',
    timestamp: new Date().toISOString(),
    routes: data
  });
});

export default router;
