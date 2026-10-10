// src/routes/session.js
// Handles starting a study session for a student.
// WHY: As required by the spec, the backend (not the AI) inspects past memory
// and returns a personalized opener ("Last time sql-joins was tricky. Let's start there.")
// along with top weak topics to guide the student.

import express from 'express';
import { getDB } from '../db.js';
import { requireStudent } from '../middleware/requireStudent.js';
import { buildOwnerFilter } from '../logic/filters.js';

const router = express.Router();

router.post('/session/start', requireStudent, async (req, res, next) => {
  try {
    const db = getDB();
    const ownerId = req.ownerId;

    // 1. Fetch active weaknesses
    const weakMemories = await db.collection('memories').find(
      buildOwnerFilter(ownerId, { type: 'weakness', status: 'active' })
    ).sort({ updatedAt: -1 }).toArray();

    // 2. Fetch topic stats with wrongSinceReset >= 2
    const weakStats = await db.collection('topic_stats').find(
      buildOwnerFilter(ownerId, { wrongSinceReset: { $gte: 2 } })
    ).sort({ lastSeen: -1 }).toArray();

    // Deduplicate weak topic list
    const weakTopicSet = new Set();
    weakMemories.forEach((m) => weakTopicSet.add(`${m.subject}:${m.topic}`));
    weakStats.forEach((s) => weakTopicSet.add(`${s.subject}:${s.topic}`));

    const weakTopics = Array.from(weakTopicSet).map((str) => {
      const [subject, topic] = str.split(':');
      return { subject, topic };
    });

    // 3. Generate backend-written opener
    let opener = `Welcome, ${req.student.name}! What subject would you like to practice today?`;
    if (weakTopics.length > 0) {
      const primaryWeak = weakTopics[0];
      opener = `Last time ${primaryWeak.topic} was tricky. Let's start there.`;
    }

    res.status(200).json({
      student: req.student,
      opener,
      weakTopics
    });
  } catch (err) {
    next(err);
  }
});

export default router;
