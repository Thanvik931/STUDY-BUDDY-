import { monitorEventLoopDelay } from 'perf_hooks';

// Event-loop delay histogram tracker (20ms resolution)
// WHY: Resilience observability. Monitors event-loop lags to detect blocking operations or CPU pressure.
const eldHistogram = monitorEventLoopDelay({ resolution: 20 });
eldHistogram.enable();

class MetricsTracker {
  constructor(windowSize = 200) {
    this.windowSize = windowSize;
    // Map of route path -> array of recent duration samples (ms)
    this.latencies = new Map();
    // Map of route path -> error count
    this.errorCounts = new Map();
    // Map of route path -> total requests
    this.totalCounts = new Map();
  }

  record(route, durationMs, isError = false) {
    // 1. Update total request count
    const count = (this.totalCounts.get(route) || 0) + 1;
    this.totalCounts.set(route, count);

    // 2. Track errors
    if (isError) {
      const errCount = (this.errorCounts.get(route) || 0) + 1;
      this.errorCounts.set(route, errCount);
    }

    // 3. Rolling window of latencies (last 200 samples)
    if (!this.latencies.has(route)) {
      this.latencies.set(route, []);
    }
    const samples = this.latencies.get(route);
    samples.push(durationMs);
    if (samples.length > this.windowSize) {
      samples.shift(); // Keep only last 200 requests
    }
  }

  getSnapshot() {
    const snapshot = {};

    for (const [route, samples] of this.latencies.entries()) {
      if (samples.length === 0) continue;

      // Sort samples ascending to calculate percentiles
      const sorted = [...samples].sort((a, b) => a - b);
      const count = this.totalCounts.get(route) || sorted.length;
      const errors = this.errorCounts.get(route) || 0;

      const p50Index = Math.floor(sorted.length * 0.5);
      const p95Index = Math.floor(sorted.length * 0.95);

      snapshot[route] = {
        totalRequests: count,
        recentSamples: sorted.length,
        errors,
        p50_ms: Number(sorted[p50Index].toFixed(2)),
        p95_ms: Number(sorted[Math.min(p95Index, sorted.length - 1)].toFixed(2)),
        min_ms: Number(sorted[0].toFixed(2)),
        max_ms: Number(sorted[sorted.length - 1].toFixed(2))
      };
    }

    return snapshot;
  }
}

const tracker = new MetricsTracker(200);

export function metricsMiddleware(req, res, next) {
  const startHrTime = process.hrtime();

  res.on('finish', () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    // Convert to milliseconds
    const durationMs = (elapsedHrTime[0] * 1000) + (elapsedHrTime[1] / 1e6);
    const isError = res.statusCode >= 400;

    // Use normalized route path or fallback to originalUrl
    const routeKey = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
    tracker.record(routeKey, durationMs, isError);
  });

  next();
}

export function getMetricsData() {
  return tracker.getSnapshot();
}

export function getEventLoopDelay() {
  return {
    min_ms: Number((eldHistogram.min / 1e6).toFixed(3)),
    max_ms: Number((eldHistogram.max / 1e6).toFixed(3)),
    mean_ms: Number((eldHistogram.mean / 1e6).toFixed(3)),
    p50_ms: Number((eldHistogram.percentile(50) / 1e6).toFixed(3)),
    p90_ms: Number((eldHistogram.percentile(90) / 1e6).toFixed(3)),
    p99_ms: Number((eldHistogram.percentile(99) / 1e6).toFixed(3))
  };
}
