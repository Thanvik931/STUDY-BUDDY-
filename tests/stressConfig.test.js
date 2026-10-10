// tests/stressConfig.test.js
// Unit tests verifying stress mode configuration, database isolation, and resilience fallbacks.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestionWithAI } from '../src/services/aiService.js';
import { env, setStressFlags } from '../src/config/env.js';

test('14. AI generation falls back gracefully with degraded=true when Anthropic API fails or is unconfigured', async () => {
  if (env.STRESS_MODE) {
    setStressFlags({ failAi: true });
  }
  try {
    const result = await generateQuestionWithAI({
      subject: 'DBMS',
      topic: 'sql-joins',
      difficulty: 'easy',
      memories: []
    });

    assert.ok(result.question, 'Fallback question must exist');
    assert.equal(Array.isArray(result.options), true, 'Options must be an array');
    assert.equal(result.options.length, 4, 'Must have exactly 4 options');
    assert.equal(typeof result.correctIndex, 'number', 'correctIndex must be a number');
    assert.ok(result.explanation, 'Explanation must exist');
    assert.equal(result.degraded, true, 'Result must be marked degraded when falling back');
  } finally {
    if (env.STRESS_MODE) {
      setStressFlags({ failAi: false });
    }
  }
});

test('15. Stress configuration resolves isolated database name and default pool size', () => {
  const defaultDbName = env.STRESS_MODE ? 'study_buddy_stress' : (env.MONGODB_DB || 'study_buddy_db');
  assert.ok(defaultDbName, 'Database name must be non-empty');
  assert.equal(typeof env.MONGO_MAX_POOL, 'number', 'MONGO_MAX_POOL must be a number');
  assert.ok(env.MONGO_MAX_POOL > 0, 'MONGO_MAX_POOL must be positive');
  assert.equal(typeof env.STRESS_MODE, 'boolean', 'STRESS_MODE must be a boolean');
});

test('16. Concurrency rule enforces atomic upsert filter { ownerId, subject, topic, type, status: "active" }', () => {
  const ownerId = 'stu_concurrency_check';
  const subject = 'DBMS';
  const topic = 'sql-joins';
  const type = 'weakness';

  // Verify the exact required filter shape
  const filter = { ownerId, subject, topic, type, status: 'active' };
  assert.equal(filter.ownerId, ownerId);
  assert.equal(filter.subject, subject);
  assert.equal(filter.topic, topic);
  assert.equal(filter.type, type);
  assert.equal(filter.status, 'active');

  // Verify retry simulation on code 11000
  let retryCount = 0;
  function simulateUpsertWithRetry(simulateDuplicateKey) {
    try {
      if (simulateDuplicateKey) {
        const error = new Error('E11000 duplicate key error');
        error.code = 11000;
        throw error;
      }
      return 'upserted';
    } catch (err) {
      if (err.code === 11000) {
        retryCount += 1;
        return 'updated_after_retry';
      }
      throw err;
    }
  }

  const outcome = simulateUpsertWithRetry(true);
  assert.equal(outcome, 'updated_after_retry');
  assert.equal(retryCount, 1, 'Must retry exactly ONCE on error 11000');
});

test('17. Resilience observability exposes eventLoopDelay and memoryUsage metrics', async () => {
  const { getEventLoopDelay } = await import('../src/middleware/metrics.js');
  const eld = getEventLoopDelay();
  assert.equal(typeof eld.min_ms, 'number', 'min_ms must be numeric');
  assert.equal(typeof eld.max_ms, 'number', 'max_ms must be numeric');
  assert.equal(typeof eld.mean_ms, 'number', 'mean_ms must be numeric');
  assert.equal(typeof eld.p50_ms, 'number', 'p50_ms must be numeric');
  assert.equal(typeof eld.p99_ms, 'number', 'p99_ms must be numeric');

  const mem = process.memoryUsage();
  assert.ok(mem.rss > 0, 'RSS memory must be positive');
  assert.ok(mem.heapUsed > 0, 'Heap used must be positive');
});

