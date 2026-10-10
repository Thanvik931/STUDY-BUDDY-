// tests/memoryRules.test.js
// Unit tests for pure memory transition rules using Node.js built-in node:test.
// WHY: Pure logic tests execute in under 50ms and guarantee that cognitive state rules
// work exactly as specified before touching the database.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMemoryRules,
  calculateExpiryDate,
  generateStableEmbeddingText,
  buildTopicStatsUpdate
} from '../src/logic/memoryRules.js';

test('1. wrong twice creates a weakness memory with correct strength', () => {
  const stats = { attempts: 2, wrong: 2, wrongSinceReset: 2, correctStreak: 0 };
  const decision = evaluateMemoryRules({
    isCorrect: false,
    topicStats: stats,
    activeWeakness: null,
    activeStrength: null
  });

  assert.equal(decision.createWeakness, true);
  assert.equal(decision.weaknessStrength, 0.5); // min(1, 2 / 4) = 0.5
  assert.equal(decision.action, 'created_weakness');
});

test('2. Rule A is not run after a correct answer', () => {
  // Even if wrongSinceReset was 2 prior to this answer, a correct answer must NOT create a weakness!
  const stats = { attempts: 3, wrong: 2, wrongSinceReset: 2, correctStreak: 1 };
  const decision = evaluateMemoryRules({
    isCorrect: true,
    topicStats: stats,
    activeWeakness: null,
    activeStrength: null
  });

  assert.equal(decision.createWeakness, false);
  assert.equal(decision.createStrength, false); // Streak is only 1, so no strength either
  assert.equal(decision.action, 'none');
});

test('3. a streak of 3 correct creates a strength and supersedes the weakness', () => {
  const stats = { attempts: 5, correct: 3, wrong: 2, wrongSinceReset: 0, correctStreak: 3 };
  const activeWeakness = { _id: 'mem_weak_1', type: 'weakness', status: 'active' };

  const decision = evaluateMemoryRules({
    isCorrect: true,
    topicStats: stats,
    activeWeakness,
    activeStrength: null
  });

  assert.equal(decision.createStrength, true);
  assert.equal(decision.supersedeWeakness, true);
  assert.equal(decision.resetWrongSinceReset, true);
  assert.equal(decision.action, 'created_strength_and_superseded_weakness');
});

test('4. conflict downgrades a strength when wrongSinceReset reaches 2', () => {
  const stats = { attempts: 6, wrong: 2, wrongSinceReset: 2, correctStreak: 0 };
  const activeStrength = { _id: 'mem_strength_1', type: 'strength', status: 'active' };

  const decision = evaluateMemoryRules({
    isCorrect: false,
    topicStats: stats,
    activeWeakness: null,
    activeStrength
  });

  assert.equal(decision.createWeakness, true);
  assert.equal(decision.supersedeStrength, true);
  assert.equal(decision.action, 'conflict_downgraded_strength_and_created_weakness');
});

test('Expiry calculations respect type policies and superseded rules', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  const dayMs = 24 * 60 * 60 * 1000;

  const weaknessExpiry = calculateExpiryDate('weakness', false, now);
  assert.equal(weaknessExpiry.getTime() - now.getTime(), 30 * dayMs);

  const strengthExpiry = calculateExpiryDate('strength', false, now);
  assert.equal(strengthExpiry.getTime() - now.getTime(), 14 * dayMs);

  const preferenceExpiry = calculateExpiryDate('preference', false, now);
  assert.equal(preferenceExpiry.getTime() - now.getTime(), 60 * dayMs);

  const supersededExpiry = calculateExpiryDate('weakness', true, now);
  assert.equal(supersededExpiry.getTime() - now.getTime(), 7 * dayMs);
});
