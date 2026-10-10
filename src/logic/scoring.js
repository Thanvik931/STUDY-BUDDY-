// src/logic/scoring.js
// Pure functions for cognitive memory scoring, recency decay, and difficulty selection.
// WHY: Decoupled as pure functions so the exact mathematical weighting can be unit tested
// without external services or database connections.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calculates exponential recency decay.
 * Formula: recency = exp(-ageDays / 14) using memory.updatedAt
 * Memories updated today score ~1.0; memories 14 days old score ~0.368.
 */
export function calculateRecencyScore(updatedAt, now = new Date()) {
  const ageMs = Math.max(0, now.getTime() - new Date(updatedAt).getTime());
  const ageDays = ageMs / DAY_MS;
  return Math.exp(-ageDays / 14);
}

/**
 * Computes final memory composite score.
 * Formula: final = 0.5 * relevance + 0.3 * strength + 0.2 * recency
 */
export function computeMemoryScore({ relevance, strength, recency }) {
  const safeRelevance = Math.min(Math.max(0, relevance), 1);
  const safeStrength = Math.min(Math.max(0, strength), 1);
  const safeRecency = Math.min(Math.max(0, recency), 1);

  const finalScore = (0.5 * safeRelevance) + (0.3 * safeStrength) + (0.2 * safeRecency);
  return Number(finalScore.toFixed(4));
}

/**
 * Selects question difficulty based on retrieved memories for the topic.
 * Rule:
 * - A retrieved weakness for this topic means EASY (plus example-based explanation)
 * - A retrieved strength means HARD
 * - No memory means MEDIUM
 */
export function determineDifficulty(retrievedMemories, currentTopic) {
  if (!retrievedMemories || retrievedMemories.length === 0) {
    return 'medium';
  }

  // Check top memory matching this topic
  const topicMemory = retrievedMemories.find((m) => m.topic === currentTopic);
  if (!topicMemory) {
    return 'medium';
  }

  if (topicMemory.type === 'weakness') {
    return 'easy';
  }

  if (topicMemory.type === 'strength') {
    return 'hard';
  }

  return 'medium';
}

/**
 * Builds the plain-text "whyThisQuestion" explanation for student transparency.
 * WHY: Explains in clear language which memories altered the question and why.
 */
export function buildWhyThisQuestion(difficulty, memoriesUsed = [], currentTopic) {
  if (!memoriesUsed || memoriesUsed.length === 0) {
    return `Medium difficulty diagnostic question for ${currentTopic} (no active memories for this topic).`;
  }

  const primary = memoriesUsed[0];
  const matchedText = primary.matchedBy ? `matched by ${primary.matchedBy.join(' and ')}` : 'matched by memory';
  const scoreText = primary.scores ? `score ${primary.scores.final}` : 'active memory';

  if (difficulty === 'easy' && primary.type === 'weakness') {
    return `Easy question because: [weakness] "${primary.content}" (${scoreText}, ${matchedText}). Focused on foundational clarity and examples.`;
  }

  if (difficulty === 'hard' && primary.type === 'strength') {
    return `Hard challenge question because: [strength] "${primary.content}" (${scoreText}, ${matchedText}). Advancing to deeper conceptual mastery.`;
  }

  return `${difficulty.toUpperCase()} question influenced by ${memoriesUsed.length} active learning memories.`;
}
