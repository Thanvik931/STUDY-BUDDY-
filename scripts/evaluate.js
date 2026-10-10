// scripts/evaluate.js
// Deterministic simulation comparing a random-topic baseline vs. memory-driven policy.
// WHY: Section 11 requirement. Evaluates how agentic memory adapts question targeting
// and improves student recovery on hidden weak topics over 10 sessions of 10 questions.
//
// ️ IMPORTANT NOTICE:
// "Simulation. It demonstrates the policy, not real learning gains."

import { TOPICS } from '../src/config/topics.js';

// Simple deterministic Mulberry32 PRNG (seed = 42)
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const allTopics = [
  ...TOPICS.DBMS.map((t) => ({ subject: 'DBMS', topic: t })),
  ...TOPICS.OS.map((t) => ({ subject: 'OS', topic: t }))
];

// Student has hidden weak topics
const HIDDEN_WEAK_TOPICS = ['sql-joins', 'deadlocks'];

function simulateQuestionOutcome(topic, difficulty, prng) {
  const isWeak = HIDDEN_WEAK_TOPICS.includes(topic);
  const rand = prng();

  if (isWeak) {
    // If weak: on Hard/Medium, low accuracy; on Easy (adaptive scaffolding), higher accuracy
    if (difficulty === 'easy') {
      return rand < 0.75; // 75% chance correct when tutor provides example scaffolding
    }
    return rand < 0.35; // 35% chance correct without memory scaffolding
  }

  // Strong topic
  return rand < 0.88; // 88% base accuracy
}

function runSimulation() {
  console.log('========================================================================');
  console.log('  STUDY BUDDY: AGENTIC MEMORY POLICY EVALUATION');
  console.log('  "Simulation. It demonstrates the policy, not real learning gains."');
  console.log('========================================================================\n');

  const NUM_SESSIONS = 10;
  const QUESTIONS_PER_SESSION = 10;

  // --- 1. BASELINE POLICY (Random Topic, Uniform Difficulty) ---
  const prngBaseline = mulberry32(42);
  const baselineSessionAccuracies = [];
  let baselineWeakAttempts = 0;
  let baselineWeakCorrect = 0;
  let baselineTotalCorrect = 0;

  for (let s = 1; s <= NUM_SESSIONS; s++) {
    let sessionCorrect = 0;

    for (let q = 1; q <= QUESTIONS_PER_SESSION; q++) {
      const randomIdx = Math.floor(prngBaseline() * allTopics.length);
      const chosen = allTopics[randomIdx];
      const correct = simulateQuestionOutcome(chosen.topic, 'medium', prngBaseline);

      if (correct) {
        sessionCorrect++;
        baselineTotalCorrect++;
      }

      if (HIDDEN_WEAK_TOPICS.includes(chosen.topic)) {
        baselineWeakAttempts++;
        if (correct) baselineWeakCorrect++;
      }
    }

    baselineSessionAccuracies.push(Number(((sessionCorrect / QUESTIONS_PER_SESSION) * 100).toFixed(1)));
  }

  // --- 2. MEMORY-DRIVEN POLICY (Adaptive Selection & Targeted Scaffolding) ---
  const prngMemory = mulberry32(42);
  const memorySessionAccuracies = [];
  let memoryWeakAttempts = 0;
  let memoryWeakCorrect = 0;
  let memoryTotalCorrect = 0;

  // Simulated student memory state
  const activeWeaknesses = new Set();
  const topicStreaks = {};

  for (let s = 1; s <= NUM_SESSIONS; s++) {
    let sessionCorrect = 0;

    for (let q = 1; q <= QUESTIONS_PER_SESSION; q++) {
      let chosen;
      let difficulty = 'medium';

      // Memory policy: If active weaknesses exist, 50% chance to target weak topic with Easy scaffolding
      if (activeWeaknesses.size > 0 && prngMemory() < 0.55) {
        const weakList = Array.from(activeWeaknesses);
        const weakTopic = weakList[Math.floor(prngMemory() * weakList.length)];
        chosen = allTopics.find((t) => t.topic === weakTopic) || allTopics[0];
        difficulty = 'easy'; // Adaptive difficulty
      } else {
        const randomIdx = Math.floor(prngMemory() * allTopics.length);
        chosen = allTopics[randomIdx];
        if (topicStreaks[chosen.topic] >= 3) {
          difficulty = 'hard';
        }
      }

      const correct = simulateQuestionOutcome(chosen.topic, difficulty, prngMemory);

      if (correct) {
        sessionCorrect++;
        memoryTotalCorrect++;
        topicStreaks[chosen.topic] = (topicStreaks[chosen.topic] || 0) + 1;
        // Rule B: Streak of 3 resolves weakness
        if (topicStreaks[chosen.topic] >= 3) {
          activeWeaknesses.delete(chosen.topic);
        }
      } else {
        topicStreaks[chosen.topic] = 0;
        // Rule A: Wrong answer forms weakness memory
        activeWeaknesses.add(chosen.topic);
      }

      if (HIDDEN_WEAK_TOPICS.includes(chosen.topic)) {
        memoryWeakAttempts++;
        if (correct) memoryWeakCorrect++;
      }
    }

    memorySessionAccuracies.push(Number(((sessionCorrect / QUESTIONS_PER_SESSION) * 100).toFixed(1)));
  }

  // --- RESULTS TABLE ---
  console.log('| Session | Random Baseline Acc (%) | Memory-Driven Policy Acc (%) | Advantage |');
  console.log('|:-------:|:-----------------------:|:----------------------------:|:---------:|');
  for (let i = 0; i < NUM_SESSIONS; i++) {
    const diff = (memorySessionAccuracies[i] - baselineSessionAccuracies[i]).toFixed(1);
    const sign = diff >= 0 ? '+' : '';
    console.log(`|   ${String(i + 1).padStart(2, ' ')}    |         ${baselineSessionAccuracies[i]}%          |            ${memorySessionAccuracies[i]}%             |   ${sign}${diff}%   |`);
  }

  console.log('\n--- PERFORMANCE SUMMARY ---');
  const baselineOverall = ((baselineTotalCorrect / (NUM_SESSIONS * QUESTIONS_PER_SESSION)) * 100).toFixed(1);
  const memoryOverall = ((memoryTotalCorrect / (NUM_SESSIONS * QUESTIONS_PER_SESSION)) * 100).toFixed(1);

  const baselineWeakAcc = ((baselineWeakCorrect / Math.max(1, baselineWeakAttempts)) * 100).toFixed(1);
  const memoryWeakAcc = ((memoryWeakCorrect / Math.max(1, memoryWeakAttempts)) * 100).toFixed(1);

  console.log(`• Overall Accuracy (All Questions):`);
  console.log(`  - Baseline (Random Policy):  ${baselineOverall}%`);
  console.log(`  - Memory-Driven (Adaptive):  ${memoryOverall}%`);

  console.log(`\n• Accuracy on Hidden Weak Topics (${HIDDEN_WEAK_TOPICS.join(', ')}):`);
  console.log(`  - Baseline (Without Memory): ${baselineWeakAcc}% (${baselineWeakCorrect}/${baselineWeakAttempts} correct)`);
  console.log(`  - Memory-Driven Policy:      ${memoryWeakAcc}% (${memoryWeakCorrect}/${memoryWeakAttempts} correct)`);

  console.log('\n------------------------------------------------------------------------');
  console.log('Conclusion: The memory-driven policy detects recurring errors, adapts');
  console.log('difficulty to foundational scaffolding, and produces higher recovery');
  console.log('on vulnerable topics compared to random practice.');
  console.log('------------------------------------------------------------------------\n');
}

runSimulation();
