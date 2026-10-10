// src/routes/tutor.js
// Dedicated AI Tutor routes: 1-on-1 Socratic doubt solving, personalized study planner,
// active recall flashcards, timed mock exams, and engineering cheat sheets.
// WHY: Empowers Study Buddy with all essential features of a world-class AI Engineering Tutor,
// deeply grounded in MongoDB Atlas Agentic Memory.

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { requireUser } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { buildOwnerFilter } from '../logic/filters.js';
import { TOPICS, TOPIC_LABELS } from '../config/topics.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flashcardBankPath = path.join(__dirname, '../../data/flashcardBank.json');
const flashcards = JSON.parse(fs.readFileSync(flashcardBankPath, 'utf-8'));

const cheatSheetsPath = path.join(__dirname, '../../data/cheatSheets.json');
const cheatSheets = JSON.parse(fs.readFileSync(cheatSheetsPath, 'utf-8'));

const questionBankPath = path.join(__dirname, '../../data/questionBank.json');
const questionBank = JSON.parse(fs.readFileSync(questionBankPath, 'utf-8'));

const router = express.Router();

/**
 * 1. POST /api/tutor/chat - 1-on-1 Interactive AI Tutor Doubt Solving
 */
router.post('/tutor/chat', requireUser, csrfProtection, async (req, res, next) => {
  try {
    const { message, mode = 'socratic', currentTopic = null } = req.body;
    const ownerId = req.ownerId;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Message is required' }
      });
    }

    const db = getDB();

    // Fetch student's active cognitive memories to ground the tutor
    const [weakMemories, strengthMemories, recentAttempts] = await Promise.all([
      db.collection('memories').find(buildOwnerFilter(ownerId, { type: 'weakness', status: 'active' })).limit(5).toArray(),
      db.collection('memories').find(buildOwnerFilter(ownerId, { type: 'strength', status: 'active' })).limit(5).toArray(),
      db.collection('attempts').find({ ownerId }).sort({ createdAt: -1 }).limit(5).toArray()
    ]);

    const weaknessContext = weakMemories.map((m) => `${m.topic}: ${m.content}`).join('; ');
    const strengthContext = strengthMemories.map((m) => `${m.topic}: ${m.content}`).join('; ');

    // Pedagogical instructions per mode
    let modeInstruction = '';
    if (mode === 'socratic') {
      modeInstruction = 'Act as a Socratic engineering mentor. Do not just hand out the final answer; ask a clarifying question or provide an incremental hint that leads the student to derive the solution themselves.';
    } else if (mode === 'eli5') {
      modeInstruction = 'Explain Like I\'m 5: Use a vivid, everyday physical analogy (e.g. library, kitchen, highway, postal system) to make the abstract computer science concept crystal clear and memorable.';
    } else if (mode === 'deepdive') {
      modeInstruction = 'Provide a university-level rigorous proof, mathematical formulas, state machine invariants, and time/space complexity analysis.';
    } else if (mode === 'debug') {
      modeInstruction = 'Analyze the code, query, or algorithm step-by-step. Identify common syntax traps, concurrency race conditions, or off-by-one errors.';
    }

    let tutorReply = '';
    let followUp = '';

    // Attempt Gemini AI response with official models
    if (env.GEMINI_API_KEY) {
      for (const modelName of ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']) {
        if (tutorReply) break;
        try {
          const prompt = `You are a distinguished Computer Science Professor and personal AI Tutor specializing in ${currentTopic || 'Coding, Data Structures, Algorithms, DBMS, OS, and System Design'}.
Mode instructions: ${modeInstruction}

STUDENT CONTEXT FROM MONGODB COGNITIVE MEMORY:
- Mode Selected: ${mode}
- Active Weaknesses: ${weaknessContext || 'None recorded yet'}
- Strengths: ${strengthContext || 'None recorded yet'}
- Topic Context: ${currentTopic || 'General Computer Science & Engineering'}

STUDENT'S QUESTION:
"${message.trim()}"

Respond strictly according to the selected mode (${mode}):
- If mode is 'socratic': Use guided inquiry with hints, step-by-step logic, and ask leading questions. Never just output raw answers.
- If mode is 'eli5': Use a fun, physical, non-technical analogy (kitchen, traffic, library, pizza). No dense jargon.
- If mode is 'deepdive': Deliver mathematical proofs, Big-O time and space complexity, theorems, and state invariants.
- If mode is 'debug': Provide code snippets, explain the bug, trace execution step-by-step, and supply the optimal fix.

End with a concise follow-up question to test their understanding.`;

          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
            })
          });

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const generated = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (generated) {
              tutorReply = generated;
              break;
            }
          }
        } catch (_) {}
      }
    }

    // High-yield mode-aware multi-subject adaptive tutor engine fallback
    if (!tutorReply) {
      const lower = message.toLowerCase();

      if (mode === 'eli5') {
        if (lower.includes('sort') || lower.includes('search') || lower.includes('tree') || lower.includes('array') || lower.includes('code') || lower.includes('dsa')) {
          tutorReply = `ELI5 Analogy (Algorithms & Coding):
Imagine you are looking for a friend's name in an encyclopedia of 1,000 pages:
• Linear Search is checking every page from 1 to 1,000 — slow and exhausting!
• Binary Search is opening the middle page (500). If your friend starts with 'S', you instantly throw away pages 1 to 499! In just 10 quick splits, you find the exact page.
That is why O(log N) is so ridiculously fast!`;
          followUp = 'If you doubled the book to 2,000 pages, how many extra page splits would Binary Search need?';
        } else if (lower.includes('join') || lower.includes('sql') || lower.includes('dbms') || lower.includes('index')) {
          tutorReply = `ELI5 Analogy (Databases & Indexes):
Imagine a giant recipe book with 5,000 dishes:
• Without an index: To find 'Tacos', you must read every single page from the front (Full Table Scan).
• With a B+ Tree index: You turn to the alphabetical index at the back. It says 'Tacos -> Page 342'. You jump straight there in one second!
• LEFT JOIN: Think of ordering combos at a diner. You want ALL kids meals (Left Table), and if they pick a toy (Right Table), attach it. If no toy exists, they still get their food with an empty toy slot (NULL)!`;
          followUp = 'What happens if you throw away the kids who didn\'t get a toy? What kind of JOIN did you just turn it into?';
        } else if (lower.includes('network') || lower.includes('tcp') || lower.includes('udp') || lower.includes('http')) {
          tutorReply = `ELI5 Analogy (Computer Networks):
• TCP is like sending a certified letter with a signed delivery receipt. If the mail carrier drops it in the mud, they apologize and resend it until both parties confirm delivery.
• UDP is like a live radio broadcast or tossing postcards from an airplane. If static clips out 2 seconds of music, the radio doesn't pause the whole song to replay it — it keeps jamming!`;
          followUp = 'Why do online multiplayer video games and voice calls use UDP instead of TCP?';
        } else {
          tutorReply = `ELI5 Analogy (Operating Systems & Hardware):
Imagine your computer is a busy restaurant kitchen:
• The CPU is the chef cooking meals as fast as possible.
• RAM is the kitchen counter where ingredients are placed right next to the chef.
• Virtual Memory (Disk) is the basement freezer down two flights of stairs.
When the counter runs out of space, the chef swaps less-used pots into the basement freezer!`;
          followUp = 'What happens to kitchen speed if the chef has to run to the basement freezer for every single bite (Thrashing)?';
        }
      } else if (mode === 'debug') {
        if (lower.includes('sort') || lower.includes('search') || lower.includes('array') || lower.includes('code') || lower.includes('dsa') || lower.includes('python')) {
          tutorReply = `Code Debugger Analysis (Data Structures & Coding):
Here is the robust, bug-free Two-Pointer pattern to avoid common index traps:

\`\`\`python
def search_target_range(nums, target):
    # Bug guard: handle empty or invalid inputs
    if not nums: return -1
    
    left, right = 0, len(nums) - 1
    # Critical invariant: use left <= right for inclusive search
    while left <= right:
        mid = left + (right - left) // 2  # Prevents integer overflow!
        if nums[mid] == target:
            return mid  # Found target at O(log N)
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
\`\`\`
Key Trap Spotted: Using \`(left + right) // 2\` can cause integer overflow in languages like C++/Java when values exceed 2^31 - 1. Always use \`left + (right - left) // 2\`.`;
          followUp = 'What off-by-one error happens if you use `left < right` instead of `left <= right` on a single-element array?';
        } else if (lower.includes('sql') || lower.includes('join') || lower.includes('dbms')) {
          tutorReply = `SQL Query Debugger & Optimization:
Common Bug Diagnosis: Unintentional conversion of outer joins to inner joins.

\`\`\`sql
-- BUGGY QUERY:
SELECT u.username, o.order_id 
FROM users u 
LEFT JOIN orders o ON u.id = o.user_id 
WHERE o.status = 'COMPLETED'; -- BUG: Drops users with NO orders because NULL = 'COMPLETED' is false!

-- CORRECT FIX: Move filter into the ON clause:
SELECT u.username, o.order_id 
FROM users u 
LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'COMPLETED';
\`\`\`
Performance Note: Ensure a composite index exists on \`orders(user_id, status)\` to prevent full sequential scans!`;
          followUp = 'How does EXPLAIN ANALYZE show whether PostgreSQL/MySQL utilized your composite index or performed a Seq Scan?';
        } else {
          tutorReply = `Systems Concurrency & Race Condition Debugger:
Common Bug: Missing atomic locks around shared counter increment.

\`\`\`javascript
// RACE CONDITION:
// Thread A: read count (0)
// Thread B: read count (0)
// Thread A: write count (1)
// Thread B: write count (1) -> Lost update anomaly!

// FIX: Use atomic primitives or mutex synchronization:
async function incrementSafely(db, docId) {
  // MongoDB Atomic $inc avoids application-level race conditions:
  return await db.collection('counters').updateOne(
    { _id: docId },
    { $inc: { seq: 1 } }
  );
}
\`\`\``;
          followUp = 'Why does atomic `$inc` in MongoDB succeed without distributed transaction locks?';
        }
      } else if (mode === 'deepdive') {
        if (lower.includes('sort') || lower.includes('search') || lower.includes('tree') || lower.includes('dsa') || lower.includes('code')) {
          tutorReply = `Exam Deep Dive & Mathematical Proofs (Algorithms):
Theorem: Comparison-based sorting algorithms have a lower bound of Ω(N log N).
Proof by Decision Tree Model:
1. Every comparison has 2 outcomes (a_i < a_j or a_i >= a_j), yielding a binary tree.
2. An array of N distinct elements has N! possible permutations.
3. To correctly sort all inputs, the decision tree must have at least N! leaves:
   L >= N!
4. A binary tree of height h has at most 2^h leaves:
   2^h >= N!  =>  h >= log2(N!)
5. By Stirling's Approximation:
   ln(N!) ≈ N ln(N) - N  =>  log2(N!) = Ω(N log N).
Therefore, no comparison sort (QuickSort, MergeSort, HeapSort) can beat O(N log N) in the worst case!`;
          followUp = 'Why can non-comparison sorts like Radix Sort or Counting Sort achieve O(N) time?';
        } else {
          tutorReply = `Exam Deep Dive & Rigorous Proofs (Systems & DBMS):
Theorem: Two-Phase Locking (2PL) guarantees Conflict Serializability.
Proof Sketch:
1. Suppose for contradiction that a schedule under 2PL contains a directed cycle in its Precedence Graph: T_1 -> T_2 -> ... -> T_k -> T_1.
2. T_1 -> T_2 implies T_1 released a lock on data item X before T_2 acquired a conflicting lock on X.
3. By the 2PL Growing/Shrinking invariant:
   Once a transaction releases ANY lock, it can NEVER acquire new locks.
4. Following the cycle:
   Time(T_1 releases X) < Time(T_2 acquires X) <= Time(T_2 releases Y) < ... < Time(T_1 acquires Z).
5. This implies Time(T_1 releases first lock) < Time(T_1 acquires last lock), directly violating Phase 2 of 2PL!
Contradiction. Therefore, the precedence graph is acyclic, ensuring conflict serializability.`;
          followUp = 'Why does Strict 2PL (holding exclusive locks until COMMIT) prevent cascading aborts in addition to ensuring serializability?';
        }
      } else {
        // Socratic Mentor mode
        if (lower.includes('sort') || lower.includes('search') || lower.includes('array') || lower.includes('tree') || lower.includes('code') || lower.includes('dsa')) {
          tutorReply = `Socratic Mentor (Coding & Algorithms):
Let us examine the problem methodically:
1. What is the fundamental trade-off between time complexity and auxiliary space here?
2. If your input array is already sorted, can you eliminate half of the search space at each comparison rather than checking element by element?
3. Think about where your pointers should start: what invariant holds true if one pointer starts at index 0 and the other at index N-1?`;
          followUp = 'What condition determines whether the left pointer should advance or the right pointer should contract?';
        } else if (lower.includes('join') || lower.includes('sql') || lower.includes('dbms')) {
          tutorReply = `Socratic Mentor (Database Architecture):
Consider what relational algebra tells us about Cartesian products:
1. If Table A has M rows and Table B has N rows, what is the raw cross-product size?
2. When you specify a predicate in the ON clause versus the WHERE clause, at which phase of the query evaluation pipeline does the relational engine apply the filter?
3. If an outer row has no matching partner in the inner table, how should the relational engine preserve the outer tuple?`;
          followUp = 'If you put `WHERE B.age > 21` after a LEFT JOIN, what happens to rows in A that had no matching B?';
        } else {
          tutorReply = `Socratic Mentor (Engineering Systems):
Welcome! Let us dissect this systems challenge systematically:
1. What are the state transitions involved when a process requests this shared resource?
2. Which hardware or kernel invariant prevents two CPU cores from updating this memory word simultaneously?
3. What is the worst-case failure mode if the network or disk latency spikes by 10x?`;
          followUp = 'Which specific layer — application code, database index, or kernel scheduler — do you want to analyze first?';
        }
      }
    }

    // Save message pair in MongoDB tutor_chats collection
    const now = new Date();
    await db.collection('tutor_chats').insertMany([
      { ownerId, role: 'user', content: message.trim(), mode, createdAt: now },
      { ownerId, role: 'assistant', content: tutorReply, mode, followUp, createdAt: new Date(now.getTime() + 100) }
    ]);

    res.status(200).json({
      reply: tutorReply,
      followUp,
      mode
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. GET /api/tutor/chat-history - Retrieve recent conversation history
 */
router.get('/tutor/chat-history', requireUser, async (req, res, next) => {
  try {
    const db = getDB();
    const ownerId = req.ownerId;

    const messages = await db.collection('tutor_chats')
      .find({ ownerId })
      .sort({ createdAt: 1 })
      .limit(30)
      .toArray();

    res.status(200).json({ messages });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. POST /api/tutor/study-plan - Generates personalized daily study roadmap based on pass/fail memory
 */
router.post('/tutor/study-plan', requireUser, csrfProtection, async (req, res, next) => {
  try {
    const db = getDB();
    const ownerId = req.ownerId;

    // Gather pass/fail counts per topic
    const [attemptsAgg, weakMemories, strengthMemories] = await Promise.all([
      db.collection('attempts').aggregate([
        { $match: { ownerId } },
        {
          $group: {
            _id: { topic: '$topic', subject: '$subject' },
            total: { $sum: 1 },
            passed: { $sum: { $cond: ['$correct', 1, 0] } },
            failed: { $sum: { $cond: ['$correct', 0, 1] } }
          }
        }
      ]).toArray(),
      db.collection('memories').find(buildOwnerFilter(ownerId, { type: 'weakness', status: 'active' })).toArray(),
      db.collection('memories').find(buildOwnerFilter(ownerId, { type: 'strength', status: 'active' })).toArray()
    ]);

    const topicStatsMap = new Map();
    for (const a of attemptsAgg) {
      const topic = a._id.topic;
      const accuracy = a.total > 0 ? Math.round((a.passed / a.total) * 100) : 0;
      topicStatsMap.set(topic, {
        total: a.total,
        passed: a.passed,
        failed: a.failed,
        accuracy
      });
    }

    const weakTopicsSet = new Set(weakMemories.map((m) => m.topic));
    const strongTopicsSet = new Set(strengthMemories.map((m) => m.topic));

    const allTopics = Object.entries(TOPICS).flatMap(([subj, list]) =>
      list.map((t) => ({ topic: t, subject: subj }))
    );

    const criticalList = [];
    const reinforcementList = [];
    const masteredList = [];
    const unexploredList = [];

    for (const { topic, subject } of allTopics) {
      const label = TOPIC_LABELS[topic] || topic;
      const stats = topicStatsMap.get(topic) || { total: 0, passed: 0, failed: 0, accuracy: 0 };

      if (stats.total === 0) {
        unexploredList.push({ topic, subject, label, status: 'Unexplored' });
      } else if (weakTopicsSet.has(topic) || stats.accuracy < 50) {
        criticalList.push({
          topic,
          subject,
          label,
          failed: stats.failed,
          passed: stats.passed,
          accuracy: stats.accuracy,
          reason: `High failure rate (${stats.accuracy}%) & diagnosed cognitive weakness`
        });
      } else if (stats.accuracy < 80) {
        reinforcementList.push({
          topic,
          subject,
          label,
          failed: stats.failed,
          passed: stats.passed,
          accuracy: stats.accuracy,
          reason: `Moderate mastery (${stats.accuracy}%). Practice edge cases.`
        });
      } else {
        masteredList.push({
          topic,
          subject,
          label,
          accuracy: stats.accuracy,
          status: 'Demonstrated Mastery'
        });
      }
    }

    // Compute overall readiness score (0-100%)
    const totalAttempted = attemptsAgg.reduce((acc, a) => acc + a.total, 0);
    const totalPassed = attemptsAgg.reduce((acc, a) => acc + a.passed, 0);
    const overallAccuracy = totalAttempted > 0 ? Math.round((totalPassed / totalAttempted) * 100) : 0;
    const coverageScore = Math.round(((allTopics.length - unexploredList.length) / allTopics.length) * 100);
    const readinessScore = Math.round(overallAccuracy * 0.6 + coverageScore * 0.4);

    // AI Tutor's Recommended Action Checklist
    const actionChecklist = [];
    if (criticalList.length > 0) {
      actionChecklist.push(`Priority 1: Master ${criticalList[0].label} — review concept lesson and take 10-question quiz.`);
    }
    if (criticalList.length > 1) {
      actionChecklist.push(`Priority 2: Clear misconceptions on ${criticalList[1].label}.`);
    } else if (unexploredList.length > 0) {
      actionChecklist.push(`Priority 2: Explore foundational topic ${unexploredList[0].label}.`);
    }
    actionChecklist.push('Daily Habit: Flip 5 active recall flashcards before your study session.');
    actionChecklist.push('⏱️ Weekend Milestone: Complete a 15-question Timed Mock Exam.');

    res.status(200).json({
      readinessScore,
      overallAccuracy,
      coverageScore,
      criticalList,
      reinforcementList,
      masteredList,
      unexploredList,
      actionChecklist
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. GET /api/tutor/flashcards - Active recall flashcards
 */
router.get('/tutor/flashcards', requireUser, async (req, res, next) => {
  try {
    const { subject } = req.query;
    let list = flashcards;
    if (subject && SUBJECTS.includes(subject)) {
      list = flashcards.filter((f) => f.subject === subject);
    }
    res.status(200).json({ flashcards: list });
  } catch (err) {
    next(err);
  }
});

/**
 * 5. POST /api/tutor/flashcard-rate - Record self-rating for spaced repetition
 */
router.post('/tutor/flashcard-rate', requireUser, csrfProtection, async (req, res, next) => {
  try {
    const { flashcardId, rating, topic, subject } = req.body;
    const ownerId = req.ownerId;

    if (!flashcardId || !rating || !topic || !subject) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
    }

    const db = getDB();
    const now = new Date();

    await db.collection('flashcard_reviews').insertOne({
      ownerId,
      flashcardId,
      rating,
      topic,
      subject,
      reviewedAt: now
    });

    // Spaced repetition impact on cognitive memory:
    // If rated "again", record an active weakness!
    if (rating === 'again') {
      await db.collection('memories').updateOne(
        { ownerId, subject, topic, type: 'weakness', status: 'active' },
        {
          $set: {
            content: `Struggled with active recall on ${TOPIC_LABELS[topic] || topic} flashcard`,
            strength: 0.85,
            source: 'flashcard_review',
            updatedAt: now
          },
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      );
    } else if (rating === 'easy') {
      // If rated "easy", strengthen topic!
      await db.collection('topic_stats').updateOne(
        { ownerId, subject, topic },
        { $inc: { consecutiveRight: 1 }, $set: { lastSeen: now } },
        { upsert: true }
      );
    }

    res.status(200).json({ message: 'Rating saved and cognitive memory updated', rating });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. GET /api/tutor/cheatsheet/:subject - High-yield cheat sheets
 */
router.get('/tutor/cheatsheet/:subject', requireUser, (req, res) => {
  const { subject } = req.params;
  const sheet = cheatSheets[subject.toUpperCase()];
  if (!sheet) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cheat sheet not found for subject' } });
  }
  res.status(200).json({ sheet });
});

/**
 * 7. POST /api/tutor/mock-exam/start - Launch 15-question timed mock exam
 */
router.post('/tutor/mock-exam/start', requireUser, csrfProtection, async (req, res, next) => {
  try {
    const db = getDB();
    const ownerId = req.ownerId;

    // Pick 15 varied questions spanning DBMS and OS
    const shuffled = [...questionBank].sort(() => 0.5 - Math.random()).slice(0, 15);
    const questionsWithoutAnswers = [];

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes limit

    for (const q of shuffled) {
      const qDoc = {
        _id: new ObjectId(),
        ownerId,
        subject: q.subject,
        topic: q.topic,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        difficulty: q.difficulty || 'medium',
        isMockExam: true,
        createdAt: now
      };
      await db.collection('questions').insertOne(qDoc);

      questionsWithoutAnswers.push({
        questionId: qDoc._id.toString(),
        subject: q.subject,
        topic: q.topic,
        question: q.question,
        options: q.options,
        difficulty: qDoc.difficulty
      });
    }

    res.status(200).json({
      examId: new ObjectId().toString(),
      totalQuestions: 15,
      timeLimitSeconds: 900, // 15 mins
      expiresAt: expiresAt.toISOString(),
      questions: questionsWithoutAnswers
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 8. POST /api/tutor/mock-exam/submit - Evaluate mock exam with grade card & advice
 */
router.post('/tutor/mock-exam/submit', requireUser, csrfProtection, async (req, res, next) => {
  try {
    const { submissions = [], timeSpentSeconds = 0 } = req.body;
    const ownerId = req.ownerId;
    const db = getDB();

    let score = 0;
    const details = [];
    const topicBreakdown = {};

    for (const sub of submissions) {
      let qDoc = null;
      try {
        qDoc = await db.collection('questions').findOne({ _id: new ObjectId(sub.questionId), ownerId });
      } catch (_) {}

      if (!qDoc) continue;

      const isCorrect = sub.selectedOptionIndex === qDoc.correctIndex;
      if (isCorrect) score += 1;

      if (!topicBreakdown[qDoc.topic]) {
        topicBreakdown[qDoc.topic] = { total: 0, passed: 0, subject: qDoc.subject };
      }
      topicBreakdown[qDoc.topic].total += 1;
      if (isCorrect) topicBreakdown[qDoc.topic].passed += 1;

      // Record attempt
      await db.collection('attempts').insertOne({
        ownerId,
        questionId: qDoc._id.toString(),
        subject: qDoc.subject,
        topic: qDoc.topic,
        correct: isCorrect,
        selectedOptionIndex: sub.selectedOptionIndex,
        difficulty: qDoc.difficulty,
        isMockExam: true,
        createdAt: new Date()
      });

      details.push({
        questionId: sub.questionId,
        question: qDoc.question,
        correct: isCorrect,
        correctIndex: qDoc.correctIndex,
        explanation: qDoc.explanation,
        topic: qDoc.topic,
        subject: qDoc.subject
      });
    }

    const total = submissions.length || 15;
    const accuracy = Math.round((score / total) * 100);

    let letterGrade = 'F';
    if (accuracy >= 90) letterGrade = 'A+';
    else if (accuracy >= 80) letterGrade = 'A';
    else if (accuracy >= 70) letterGrade = 'B';
    else if (accuracy >= 60) letterGrade = 'C';
    else if (accuracy >= 50) letterGrade = 'D';

    // Tutor Advice
    let tutorAdvice = '';
    if (accuracy >= 85) {
      tutorAdvice = 'Outstanding performance! You showed exceptional mastery across both DBMS and OS. Keep reviewing edge cases in flashcards to retain this top percentile!';
    } else if (accuracy >= 65) {
      tutorAdvice = 'Good effort! You have a solid grasp on core concepts, but tripped up on complex scheduling and indexing nuances. Review the recommended lessons for missed topics.';
    } else {
      tutorAdvice = 'Don\'t be discouraged! This diagnostic exam identified crucial gaps in your foundation. Go to the "Teach Concepts" tab and start with the highest priority lessons.';
    }

    res.status(200).json({
      score,
      total,
      accuracy,
      letterGrade,
      timeSpentSeconds,
      tutorAdvice,
      details,
      topicBreakdown
    });
  } catch (err) {
    next(err);
  }
});

export default router;
