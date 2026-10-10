// src/routes/lessons.js
// Interactive concept teaching powered by MongoDB Cognitive Memory.
// WHY: Addresses the core user need: "Teach lessons where are you teaching new concepts".
// Analyzes student weaknesses and delivers structured, high-yield engineering lessons.

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../db.js';
import { requireUser } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { buildOwnerFilter } from '../logic/filters.js';
import { TOPICS, TOPIC_LABELS, isValidTopic } from '../config/topics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lessonBankPath = path.join(__dirname, '../../data/lessonBank.json');
const lessonBank = JSON.parse(fs.readFileSync(lessonBankPath, 'utf-8'));

const router = express.Router();

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
        recommended.push({
          subject: mem.subject,
          topic: mem.topic,
          title: TOPIC_LABELS[mem.topic] || mem.topic,
          reason: `Active weakness diagnosed: ${mem.content}`,
          strength: mem.strength,
          hasLesson: Boolean(lessonBank[mem.topic])
        });
      }
    }

    for (const st of weakStats) {
      if (!seen.has(st.topic)) {
        seen.add(st.topic);
        recommended.push({
          subject: st.subject,
          topic: st.topic,
          title: TOPIC_LABELS[st.topic] || st.topic,
          reason: `${st.wrong} incorrect attempt(s) recorded`,
          hasLesson: Boolean(lessonBank[st.topic])
        });
      }
    }

    // If no weaknesses yet, suggest foundational topics
    if (recommended.length === 0) {
      recommended.push({
        subject: 'DBMS',
        topic: 'sql-joins',
        title: TOPIC_LABELS['sql-joins'],
        reason: 'Recommended core foundation for Database Systems',
        hasLesson: true
      });
      recommended.push({
        subject: 'OS',
        topic: 'process-scheduling',
        title: TOPIC_LABELS['process-scheduling'],
        reason: 'Recommended core foundation for Operating Systems',
        hasLesson: true
      });
    }

    res.status(200).json({ recommended });
  } catch (err) {
    next(err);
  }
});

// POST /api/lessons/teach - Delivers an in-depth concept lesson tailored to student memory
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

    // Check student's cognitive memory for this topic
    const [weakMemory, strengthMemory, stats] = await Promise.all([
      db.collection('memories').findOne(buildOwnerFilter(ownerId, { topic, type: 'weakness', status: 'active' })),
      db.collection('memories').findOne(buildOwnerFilter(ownerId, { topic, type: 'strength', status: 'active' })),
      db.collection('topic_stats').findOne(buildOwnerFilter(ownerId, { topic }))
    ]);

    const baseLesson = lessonBank[topic] || {
      subject,
      topic,
      title: TOPIC_LABELS[topic] || topic,
      summary: `Comprehensive lesson on ${topic}`,
      analogy: `Think of ${topic} as a foundational mechanism in ${subject}.`,
      coreMechanics: 'Core conceptual rules and mechanics.',
      commonPitfalls: 'Avoid confusing basic terms and definitions.',
      codeOrDiagram: '-- Conceptual Diagram / Query',
      examTips: 'Review standard definitions and edge cases.',
      keyTakeaways: ['Understand core concepts.', 'Practice problem solving.']
    };

    // Personalize the lesson with the student's live Agentic Memory
    let studentDiagnosis = null;
    let personalTip = null;

    if (weakMemory) {
      studentDiagnosis = `Cognitive Diagnosis: The AI tutor observed difficulty with "${weakMemory.content}". Pay extra attention to the pitfalls section below!`;
      personalTip = `Focus Area: Based on your previous quiz attempts, you were caught by tricky options. Notice how the core mechanics clarify this.`;
    } else if (strengthMemory) {
      studentDiagnosis = `Status: You currently have demonstrated strength in this topic (${Math.round((strengthMemory.strength || 0.8) * 100)}% mastery). Use this lesson to reinforce advanced nuances.`;
      personalTip = `Advanced Challenge: Look out for edge cases and exam tricks.`;
    } else if (stats && stats.wrong > 0) {
      studentDiagnosis = `Progress Note: You have ${stats.wrong} wrong answer(s) recorded in this topic. Reviewing this lesson will help clear any misconceptions.`;
    }

    // Record lesson completion in cognitive memory (preference / learning outcome)
    const now = new Date();
    await db.collection('memories').updateOne(
      { ownerId, subject, topic, type: 'outcome' },
      {
        $set: {
          content: `Completed concept lesson on ${TOPIC_LABELS[topic] || topic}`,
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
        ...baseLesson,
        studentDiagnosis,
        personalTip,
        topicLabel: TOPIC_LABELS[topic] || topic
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
