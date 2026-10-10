// src/routes/lessons.js
// Interactive concept teaching powered by MongoDB Cognitive Memory and Gemini AI.
// WHY: Addresses user request: Teach concepts in depth by ingesting the exact memory of
// passed and failed percentages from MongoDB attempts, and generating structured lessons.

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../db.js';
import { requireUser } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { buildOwnerFilter } from '../logic/filters.js';
import { TOPICS, TOPIC_LABELS, isValidTopic } from '../config/topics.js';
import { generateGeminiLesson } from '../services/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lessonBankPath = path.join(__dirname, '../../data/lessonBank.json');
const lessonBank = JSON.parse(fs.readFileSync(lessonBankPath, 'utf-8'));

const router = express.Router();

/**
 * Helper: Computes exact pass/fail counts and accuracy percentage for an owner and topic
 */
async function getTopicStats(db, ownerId, topic) {
  const [attemptAgg, topicDoc] = await Promise.all([
    db.collection('attempts').aggregate([
      { $match: { ownerId, topic } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          passed: { $sum: { $cond: ['$correct', 1, 0] } },
          failed: { $sum: { $cond: ['$correct', 0, 1] } }
        }
      }
    ]).toArray(),
    db.collection('topic_stats').findOne(buildOwnerFilter(ownerId, { topic }))
  ]);

  const totalAttempts = attemptAgg[0]?.total || 0;
  const passedCount = attemptAgg[0]?.passed || 0;
  const failedCount = attemptAgg[0]?.failed || 0;
  const accuracyPercent = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0;

  return {
    totalAttempts,
    passedCount,
    failedCount,
    accuracyPercent,
    wrongSinceReset: topicDoc?.wrongSinceReset || 0,
    consecutiveRight: topicDoc?.consecutiveRight || 0,
    lastSeen: topicDoc?.lastSeen || null
  };
}

// GET /api/lessons/recommended - Returns lessons recommended for the student based on cognitive memory
router.get('/lessons/recommended', requireUser, async (req, res, next) => {
  try {
    const db = getDB();
    const ownerId = req.ownerId;

    // Fetch active weaknesses
    const weakMemories = await db.collection('memories').find(
      buildOwnerFilter(ownerId, { type: 'weakness', status: 'active' })
    ).sort({ strength: -1, updatedAt: -1 }).toArray();

    // Fetch topic stats with wrong > 0
    const weakStats = await db.collection('topic_stats').find(
      buildOwnerFilter(ownerId, { wrong: { $gt: 0 } })
    ).sort({ wrongSinceReset: -1, lastSeen: -1 }).toArray();

    const recommended = [];
    const seen = new Set();

    for (const mem of weakMemories) {
      if (!seen.has(mem.topic)) {
        seen.add(mem.topic);
        const stats = await getTopicStats(db, ownerId, mem.topic);
        recommended.push({
          subject: mem.subject,
          topic: mem.topic,
          title: TOPIC_LABELS[mem.topic] || mem.topic,
          reason: `Active weakness: ${mem.content}`,
          stats: `${stats.failedCount} Failed / ${stats.passedCount} Passed (${stats.accuracyPercent}% Accuracy)`,
          passedCount: stats.passedCount,
          failedCount: stats.failedCount,
          accuracyPercent: stats.accuracyPercent,
          strength: mem.strength,
          hasLesson: Boolean(lessonBank[mem.topic])
        });
      }
    }

    for (const st of weakStats) {
      if (!seen.has(st.topic)) {
        seen.add(st.topic);
        const stats = await getTopicStats(db, ownerId, st.topic);
        recommended.push({
          subject: st.subject,
          topic: st.topic,
          title: TOPIC_LABELS[st.topic] || st.topic,
          reason: `${st.wrong} incorrect answers on quizzes`,
          stats: `${stats.failedCount} Failed / ${stats.passedCount} Passed (${stats.accuracyPercent}% Accuracy)`,
          passedCount: stats.passedCount,
          failedCount: stats.failedCount,
          accuracyPercent: stats.accuracyPercent,
          hasLesson: Boolean(lessonBank[st.topic])
        });
      }
    }

    // If no weaknesses yet, suggest foundational topics
    if (recommended.length === 0) {
      const dbmsStats = await getTopicStats(db, ownerId, 'sql-joins');
      recommended.push({
        subject: 'DBMS',
        topic: 'sql-joins',
        title: TOPIC_LABELS['sql-joins'],
        reason: 'Recommended core foundation for Database Systems',
        stats: `${dbmsStats.failedCount} Failed / ${dbmsStats.passedCount} Passed (${dbmsStats.accuracyPercent}% Accuracy)`,
        passedCount: dbmsStats.passedCount,
        failedCount: dbmsStats.failedCount,
        accuracyPercent: dbmsStats.accuracyPercent,
        hasLesson: true
      });

      const osStats = await getTopicStats(db, ownerId, 'process-scheduling');
      recommended.push({
        subject: 'OS',
        topic: 'process-scheduling',
        title: TOPIC_LABELS['process-scheduling'],
        reason: 'Recommended core foundation for Operating Systems',
        stats: `${osStats.failedCount} Failed / ${osStats.passedCount} Passed (${osStats.accuracyPercent}% Accuracy)`,
        passedCount: osStats.passedCount,
        failedCount: osStats.failedCount,
        accuracyPercent: osStats.accuracyPercent,
        hasLesson: true
      });
    }

    res.status(200).json({ recommended });
  } catch (err) {
    next(err);
  }
});

// POST /api/lessons/teach - Delivers an in-depth concept lesson tailored to student pass/fail memory
router.post('/lessons/teach', requireUser, csrfProtection, async (req, res, next) => {
  try {
    const { subject, topic } = req.body;

    if (!subject || !topic || !isValidTopic(subject, topic)) {
      return res.status(400).json({
        error: { code: 'INVALID_TOPIC', message: 'Valid subject and topic are required' }
      });
    }

    const db = getDB();
    const ownerId = req.ownerId;

    // 1. Fetch student's exact pass/fail memory and active cognitive memories
    const [stats, weakMemory, strengthMemory] = await Promise.all([
      getTopicStats(db, ownerId, topic),
      db.collection('memories').findOne(buildOwnerFilter(ownerId, { topic, type: 'weakness', status: 'active' })),
      db.collection('memories').findOne(buildOwnerFilter(ownerId, { topic, type: 'strength', status: 'active' }))
    ]);

    const topicLabel = TOPIC_LABELS[topic] || topic;
    const baseLesson = lessonBank[topic] || null;

    // 2. Generate lesson using Gemini AI engine (with adaptive memory fallback)
    const generatedLesson = await generateGeminiLesson({
      subject,
      topic,
      topicLabel,
      studentStats: stats,
      weakMemory,
      strengthMemory,
      baseLesson
    });

    // 3. Record lesson completion in cognitive memory
    const now = new Date();
    await db.collection('memories').updateOne(
      { ownerId, subject, topic, type: 'outcome' },
      {
        $set: {
          content: `Completed in-depth concept lesson on ${topicLabel}. Passed: ${stats.passedCount}, Failed: ${stats.failedCount} (${stats.accuracyPercent}%).`,
          source: 'student_input',
          strength: 0.9,
          status: 'active',
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );

    res.status(200).json({
      lesson: {
        ...generatedLesson,
        title: topicLabel,
        topic,
        subject,
        topicLabel,
        studentStats: stats
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
