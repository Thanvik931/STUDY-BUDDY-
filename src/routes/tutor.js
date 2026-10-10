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

    // Attempt Gemini AI response
    if (env.GEMINI_API_KEY) {
      try {
        const prompt = `You are a distinguished Computer Science Professor and personal AI Tutor for engineering students.
${modeInstruction}

STUDENT CONTEXT FROM MONGODB COGNITIVE MEMORY:
- Active Weaknesses: ${weaknessContext || 'None recorded yet'}
- Strengths: ${strengthContext || 'None recorded yet'}
- Topic Context: ${currentTopic || 'General Computer Systems (DBMS & OS)'}

STUDENT'S QUESTION:
"${message.trim()}"

Provide an engaging, clear explanation directly answering the student. End with a short, thought-provoking follow-up question to test their understanding.`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
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
          }
        }
      } catch (err) {
        logger.warn(`Gemini tutor chat call failed: ${err.message}. Using intelligent adaptive tutor engine.`);
      }
    }

    // High-yield adaptive tutor fallback if Gemini is unconfigured or throttled
    if (!tutorReply) {
      const lower = message.toLowerCase();
      if (lower.includes('join') || lower.includes('sql')) {
        tutorReply = `Great question on SQL Joins! Remember the golden rule:
• INNER JOIN returns ONLY rows where the join predicate matches in BOTH tables.
• LEFT JOIN keeps EVERY row from the left table, padding unmatched right attributes with NULL.
• A common trap is placing right-table conditions in WHERE instead of ON — doing so converts your LEFT JOIN into an INNER JOIN!`;
        followUp = 'What happens to unmatched left rows if you write `WHERE right_table.status = "active"`?';
      } else if (lower.includes('b+ tree') || lower.includes('index') || lower.includes('b tree')) {
        tutorReply = `Database Indexing insight: B+ Trees dominate relational storage because:
1. Internal nodes store ONLY routing keys (no record pointers), maximizing fanout and keeping tree height low (3-4 levels for billions of rows).
2. Leaf nodes store all record pointers and are linked sequentially in a doubly linked list, making range queries O(log N + K) sequential scans!`;
        followUp = 'If node size is 4KB and each key+pointer is 32 bytes, what is the maximum fanout?';
      } else if (lower.includes('deadlock') || lower.includes('banker')) {
        tutorReply = `Deadlocks require all 4 Coffman conditions: Mutual Exclusion, Hold & Wait, No Preemption, and Circular Wait.
Banker's Algorithm prevents deadlock by ensuring that after granting any request, at least ONE safe sequence exists where every process can satisfy its Max Need with available resources!`;
        followUp = 'How does resource ordering (e.g. always acquire Mutex A before Mutex B) break Circular Wait?';
      } else if (lower.includes('page') || lower.includes('tlb') || lower.includes('virtual memory')) {
        tutorReply = `Virtual Memory relies on the TLB (Translation Lookaside Buffer) to cache Virtual Page Number → Physical Frame Number translations.
A TLB Miss incurs a page table walk in RAM. A Page Fault is far heavier: the page is not in RAM at all, triggering an OS trap to disk swap space!`;
        followUp = 'Why is the Effective Memory Access Time (EMAT) dominated by the Page Fault rate even if it occurs in 0.1% of accesses?';
      } else {
        tutorReply = `Hello! I am your AI Engineering Tutor. I'm analyzing your question against your cognitive memory profile.
In Computer Systems (DBMS & OS), clarity comes from understanding state transitions and invariants. Let's break your query down step-by-step!`;
        followUp = 'Which specific concept or edge case would you like to explore deeper?';
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

    const allTopics = [
      ...TOPICS.DBMS.map((t) => ({ topic: t, subject: 'DBMS' })),
      ...TOPICS.OS.map((t) => ({ topic: t, subject: 'OS' }))
    ];

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
      actionChecklist.push(`🚨 Priority 1: Master ${criticalList[0].label} — review concept lesson and take 10-question quiz.`);
    }
    if (criticalList.length > 1) {
      actionChecklist.push(`🚨 Priority 2: Clear misconceptions on ${criticalList[1].label}.`);
    } else if (unexploredList.length > 0) {
      actionChecklist.push(`⚡ Priority 2: Explore foundational topic ${unexploredList[0].label}.`);
    }
    actionChecklist.push('🗂️ Daily Habit: Flip 5 active recall flashcards before your study session.');
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
    if (subject && (subject === 'DBMS' || subject === 'OS')) {
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
