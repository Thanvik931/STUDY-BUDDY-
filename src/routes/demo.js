// src/routes/demo.js
// Demo helper endpoints for judges and presentations.
// WHY: Section 8 requirement. Creates sample student profiles ("Ravi (Day 1)" and "Ravi (Day 5)")
// and provides a 120-second expiring memory to demonstrate MongoDB TTL index auto-expiry live.

import express from 'express';
import { getDB } from '../db.js';
import { env } from '../config/env.js';
import { getEmbedding } from '../services/embeddingService.js';
import { generateStableEmbeddingText, calculateExpiryDate } from '../logic/memoryRules.js';

const router = express.Router();

// Guard middleware: only allow if DEMO_MODE=true in .env
router.use((req, res, next) => {
  if (!env.DEMO_MODE) {
    return res.status(403).json({
      error: {
        code: 'DEMO_MODE_DISABLED',
        message: 'Demo routes are disabled in production'
      }
    });
  }
  next();
});

// POST /api/demo/seed - Creates Ravi (Day 1) and Ravi (Day 5) with memories
router.post('/demo/seed', async (req, res, next) => {
  const db = getDB();
  const now = new Date();

  try {
    // 1. Create Ravi (Day 1) - Fresh student with zero memories
    const raviDay1Id = `stu_demo_ravi_day1`;
    await db.collection('students').updateOne(
      { _id: raviDay1Id },
      { $set: { _id: raviDay1Id, name: 'Ravi (Day 1 - Blank Slate)', createdAt: now } },
      { upsert: true }
    );
    // Clear any prior demo memories for clean reset
    await db.collection('memories').deleteMany({ ownerId: raviDay1Id });
    await db.collection('topic_stats').deleteMany({ ownerId: raviDay1Id });

    // 2. Create Ravi (Day 5) - Experienced student with ~6 memories
    const raviDay5Id = `stu_demo_ravi_day5`;
    await db.collection('students').updateOne(
      { _id: raviDay5Id },
      { $set: { _id: raviDay5Id, name: 'Ravi (Day 5 - Evolved Brain)', createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) } },
      { upsert: true }
    );
    await db.collection('memories').deleteMany({ ownerId: raviDay5Id });
    await db.collection('topic_stats').deleteMany({ ownerId: raviDay5Id });

    const seedConfigs = [
      { subject: 'DBMS', topic: 'sql-joins', type: 'weakness', content: 'DBMS sql-joins: student confuses LEFT JOIN with INNER JOIN', strength: 0.75, wrong: 3, attempts: 4 },
      { subject: 'DBMS', topic: 'indexing', type: 'weakness', content: 'DBMS indexing: forgets that B+ Trees store all actual records in leaf nodes', strength: 0.5, wrong: 2, attempts: 3 },
      { subject: 'DBMS', topic: 'er-model-keys', type: 'strength', content: 'DBMS er-model-keys: mastered primary and candidate key definitions', strength: 1.0, wrong: 0, attempts: 5 },
      { subject: 'OS', topic: 'process-scheduling', type: 'strength', content: 'OS process-scheduling: mastered Round Robin time quantum calculations', strength: 1.0, wrong: 0, attempts: 4 },
      { subject: 'OS', topic: 'deadlocks', type: 'weakness', content: 'OS deadlocks: confuses Banker algorithm safety check with resource request algorithm', strength: 0.8, wrong: 3, attempts: 4 },
      { subject: 'OS', topic: 'memory-paging', type: 'preference', content: 'OS memory-paging: student understands best when using visual hardware metaphors', strength: 0.9, wrong: 1, attempts: 2 }
    ];

    const insertedMemories = [];

    for (const item of seedConfigs) {
      const embeddingText = generateStableEmbeddingText(item.subject, item.topic, item.type, item.content);
      const embedding = await getEmbedding(embeddingText);
      const expiresAt = calculateExpiryDate(item.type, false, now);

      const memDoc = {
        ownerId: raviDay5Id,
        type: item.type,
        subject: item.subject,
        topic: item.topic,
        content: item.content,
        source: 'seed',
        strength: item.strength,
        evidence: { wrong: item.wrong, attempts: item.attempts },
        embedding,
        status: 'active',
        private: false,
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: now,
        lastUsedAt: null,
        expiresAt,
        supersededBy: null
      };

      await db.collection('memories').insertOne(memDoc);
      insertedMemories.push(item.content);

      // Seed corresponding topic stats
      await db.collection('topic_stats').updateOne(
        { ownerId: raviDay5Id, subject: item.subject, topic: item.topic },
        {
          $set: {
            attempts: item.attempts,
            correct: item.attempts - item.wrong,
            wrong: item.wrong,
            correctStreak: item.type === 'strength' ? 3 : 0,
            wrongSinceReset: item.type === 'weakness' ? item.wrong : 0,
            lastSeen: now
          }
        },
        { upsert: true }
      );
    }

    res.status(200).json({
      message: 'Demo students seeded successfully',
      day1: { id: raviDay1Id, name: 'Ravi (Day 1 - Blank Slate)', memories: 0 },
      day5: { id: raviDay5Id, name: 'Ravi (Day 5 - Evolved Brain)', memories: insertedMemories.length }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/demo/expiring-memory - Creates a memory expiring in 120 seconds
router.post('/demo/expiring-memory', async (req, res, next) => {
  const db = getDB();
  const studentId = req.headers['x-student-id'] || 'stu_demo_ravi_day1';
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 120 * 1000); // 120 seconds in future

  try {
    const content = 'Temporary exam note: quick review on Round Robin preemption (expires in 120s)';
    const embedding = await getEmbedding(content);

    const memoryDoc = {
      ownerId: studentId,
      type: 'preference',
      subject: 'OS',
      topic: 'process-scheduling',
      content,
      source: 'demo',
      strength: 0.9,
      evidence: { wrong: 0, attempts: 1 },
      embedding,
      status: 'active',
      private: false,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      expiresAt, // Managed by MongoDB TTL index (expireAfterSeconds: 0)
      supersededBy: null
    };

    const result = await db.collection('memories').insertOne(memoryDoc);

    res.status(201).json({
      message: 'Expiring memory created! MongoDB TTL index will automatically purge it in 120 seconds.',
      memoryId: result.insertedId,
      expiresAt: expiresAt.toISOString(),
      secondsRemaining: 120
    });
  } catch (err) {
    next(err);
  }
});

export default router;
