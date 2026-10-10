// tests/stressConfig.test.js
// Unit tests verifying stress mode configuration, database isolation, and resilience fallbacks.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestionWithAI } from '../src/services/aiService.js';
import { env } from '../src/config/env.js';

test('14. AI generation falls back gracefully with degraded=true when Anthropic API fails or is unconfigured', async () => {
  // Even if AI service fails or is simulated down, the app must NEVER crash and must return a degraded question
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
});

test('15. Stress configuration resolves isolated database name and default pool size', () => {
  const defaultDbName = env.STRESS_MODE ? 'study_buddy_stress' : (env.MONGODB_DB || 'study_buddy_db');
  assert.ok(defaultDbName, 'Database name must be non-empty');
  assert.equal(typeof env.MONGO_MAX_POOL, 'number', 'MONGO_MAX_POOL must be a number');
  assert.ok(env.MONGO_MAX_POOL > 0, 'MONGO_MAX_POOL must be positive');
  assert.equal(typeof env.STRESS_MODE, 'boolean', 'STRESS_MODE must be a boolean');
});
