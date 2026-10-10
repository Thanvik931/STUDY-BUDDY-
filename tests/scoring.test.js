// tests/scoring.test.js
// Unit tests for memory scoring, recency decay, and difficulty selection.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRecencyScore,
  computeMemoryScore,
  determineDifficulty,
  buildWhyThisQuestion
} from '../src/logic/scoring.js';

test('5. scoring order and recency decay', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const dayMs = 24 * 60 * 60 * 1000;

  // Recent memory (0 days old) -> recency = 1.0
  const recentScore = calculateRecencyScore(now, now);
  assert.equal(recentScore.toFixed(3), '1.000');

  // 14 days old -> recency = exp(-1) ~ 0.3678
  const twoWeeksAgo = new Date(now.getTime() - 14 * dayMs);
  const olderScore = calculateRecencyScore(twoWeeksAgo, now);
  assert.equal(olderScore.toFixed(3), '0.368');

  // Verify composite scoring formula: 0.5*relevance + 0.3*strength + 0.2*recency
  const score1 = computeMemoryScore({ relevance: 1.0, strength: 1.0, recency: 1.0 });
  assert.equal(score1, 1.0);

  const score2 = computeMemoryScore({ relevance: 0.8, strength: 0.5, recency: 0.5 });
  // (0.5 * 0.8) + (0.3 * 0.5) + (0.2 * 0.5) = 0.40 + 0.15 + 0.10 = 0.65
  assert.equal(score2, 0.65);
});

test('6. difficulty selection logic', () => {
  // Weakness memory on current topic -> easy
  const weakMemories = [{ topic: 'sql-joins', type: 'weakness' }];
  assert.equal(determineDifficulty(weakMemories, 'sql-joins'), 'easy');

  // Strength memory on current topic -> hard
  const strongMemories = [{ topic: 'sql-joins', type: 'strength' }];
  assert.equal(determineDifficulty(strongMemories, 'sql-joins'), 'hard');

  // Memory on another topic -> medium
  const otherMemories = [{ topic: 'indexing', type: 'weakness' }];
  assert.equal(determineDifficulty(otherMemories, 'sql-joins'), 'medium');

  // No memories -> medium
  assert.equal(determineDifficulty([], 'sql-joins'), 'medium');
});

test('WhyThisQuestion plain-text explanation generator', () => {
  const memory = {
    content: 'confuses INNER and LEFT JOIN',
    type: 'weakness',
    scores: { final: 0.82 },
    matchedBy: ['vector', 'topic']
  };

  const explanation = buildWhyThisQuestion('easy', [memory], 'sql-joins');
  assert.match(explanation, /Easy question because: \[weakness\]/);
  assert.match(explanation, /score 0.82/);
  assert.match(explanation, /matched by vector and topic/);
});
