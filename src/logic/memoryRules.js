// src/logic/memoryRules.js
// Pure functions containing all business logic for cognitive memory transitions.
// WHY: Pure functions have NO database calls, NO side effects, and are 100% deterministic.
// They can be tested with unit tests instantly without needing a running database.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calculates the exact expiry date based on memory type and status.
 * Expiry rules:
 * - weakness: 30 days
 * - strength: 14 days
 * - preference: 60 days
 * - any superseded memory: now + 7 days
 */
export function calculateExpiryDate(type, isSuperseded = false, now = new Date()) {
  const baseTime = now.getTime();
  if (isSuperseded) {
    return new Date(baseTime + 7 * DAY_MS);
  }

  switch (type) {
    case 'weakness':
      return new Date(baseTime + 30 * DAY_MS);
    case 'strength':
      return new Date(baseTime + 14 * DAY_MS);
    case 'preference':
      return new Date(baseTime + 60 * DAY_MS);
    default:
      return new Date(baseTime + 30 * DAY_MS);
  }
}

/**
 * Generates the stable embedding text when a memory is first created.
 * WHY: As required by the spec, embedding text is stable and created only once.
 * Incrementing attempt counts must NOT trigger a re-embed.
 */
export function generateStableEmbeddingText(subject, topic, type, specificIssue = '') {
  if (type === 'weakness') {
    const detail = specificIssue ? ` (${specificIssue})` : '';
    return `${subject} ${topic}: student demonstrates conceptual difficulty with ${topic}${detail}`;
  }
  if (type === 'strength') {
    return `${subject} ${topic}: student has mastered concepts in ${topic}`;
  }
  return `${subject} ${topic}: student preference or note`;
}

/**
 * Generates the atomic MongoDB update document for topic_stats on each answer.
 * WHY: Atomicity prevents race conditions if a student submits multiple answers quickly.
 */
export function buildTopicStatsUpdate(isCorrect, now = new Date()) {
  if (isCorrect) {
    return {
      $inc: {
        attempts: 1,
        correct: 1,
        correctStreak: 1
      },
      $set: {
        lastSeen: now
      }
    };
  } else {
    return {
      $inc: {
        attempts: 1,
        wrong: 1,
        wrongSinceReset: 1
      },
      $set: {
        correctStreak: 0,
        lastSeen: now
      }
    };
  }
}

/**
 * Evaluates what memory transitions should occur given the student's updated stats.
 * Pure function: takes the current state, returns planned actions.
 *
 * Rules:
 * - Rule A (Wrong Answer): if wrongSinceReset >= 2, create or strengthen weakness (strength = min(1, wrongSinceReset / 4)).
 * - Rule B (Correct Answer): if correctStreak >= 3, create strength, supersede active weakness, reset wrongSinceReset to 0.
 * - Conflict (Wrong Answer): if active strength exists and wrongSinceReset >= 2, supersede strength (new evidence wins).
 */
export function evaluateMemoryRules({ isCorrect, topicStats, activeWeakness = null, activeStrength = null }) {
  const result = {
    action: 'none',
    createWeakness: false,
    weaknessStrength: 0,
    supersedeStrength: false,
    createStrength: false,
    supersedeWeakness: false,
    resetWrongSinceReset: false
  };

  // RULE A: Evaluated ONLY after a WRONG answer
  if (!isCorrect) {
    const wrongCount = topicStats?.wrongSinceReset || 0;
    if (wrongCount >= 2) {
      result.createWeakness = true;
      result.weaknessStrength = Math.min(1, wrongCount / 4);

      // Conflict rule: New evidence wins over old strength
      if (activeStrength) {
        result.supersedeStrength = true;
        result.action = 'conflict_downgraded_strength_and_created_weakness';
      } else {
        result.action = activeWeakness ? 'strengthened_weakness' : 'created_weakness';
      }
    }
    return result;
  }

  // RULE B: Evaluated ONLY after a CORRECT answer
  if (isCorrect) {
    const streak = topicStats?.correctStreak || 0;
    if (streak >= 3) {
      result.createStrength = true;
      result.resetWrongSinceReset = true;
      result.action = 'created_strength';

      if (activeWeakness) {
        result.supersedeWeakness = true;
        result.action = 'created_strength_and_superseded_weakness';
      }
    }
    return result;
  }

  return result;
}
