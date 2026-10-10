// src/routes/progress.js
// Provides comprehensive multi-dimensional student progress metrics via MongoDB Aggregation Pipelines.
// WHY: Feeds 4 distinct Chart.js visualizations:
// 1. Topic Mastery Radar/Bar chart
// 2. Subject Performance (Pass vs Fail Comparison for DBMS vs OS)
// 3. Cognitive Memory State Breakdown (Strengths vs Weaknesses vs Superseded)
// 4. Learning Progression & Accuracy Timeline

import express from 'express';
import { getDB } from '../db.js';
import { requireUser } from '../middleware/auth.js';
import { TOPICS, TOPIC_LABELS } from '../config/topics.js';

const router = express.Router();

router.get('/progress', requireUser, async (req, res, next) => {
  try {
    const db = getDB();
    const ownerId = req.ownerId;

    // 1. Pipeline: Timeline grouped by date and topic
    const timelinePipeline = [
      { $match: { ownerId } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            subject: '$subject',
            topic: '$topic'
          },
          attempts: { $sum: 1 },
          correct: { $sum: { $cond: ['$correct', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          subject: '$_id.subject',
          topic: '$_id.topic',
          attempts: 1,
          correct: 1,
          accuracy: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$correct', { $max: ['$attempts', 1] }] },
                  100
                ]
              },
              1
            ]
          }
        }
      },
      { $sort: { date: 1, topic: 1 } }
    ];

    // 2. Pipeline: Topic Mastery Breakdown (all attempts per topic)
    const topicPipeline = [
      { $match: { ownerId } },
      {
        $group: {
          _id: { topic: '$topic', subject: '$subject' },
          attempts: { $sum: 1 },
          correct: { $sum: { $cond: ['$correct', 1, 0] } },
          wrong: { $sum: { $cond: ['$correct', 0, 1] } }
        }
      },
      {
        $project: {
          _id: 0,
          topic: '$_id.topic',
          subject: '$_id.subject',
          attempts: 1,
          correct: 1,
          wrong: 1,
          accuracy: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$correct', { $max: ['$attempts', 1] }] },
                  100
                ]
              },
              1
            ]
          }
        }
      },
      { $sort: { accuracy: -1 } }
    ];

    // 3. Pipeline: Subject Pass vs Fail Breakdown (DBMS vs OS)
    const subjectPipeline = [
      { $match: { ownerId } },
      {
        $group: {
          _id: '$subject',
          attempts: { $sum: 1 },
          passed: { $sum: { $cond: ['$correct', 1, 0] } },
          failed: { $sum: { $cond: ['$correct', 0, 1] } }
        }
      },
      {
        $project: {
          _id: 0,
          subject: '$_id',
          attempts: 1,
          passed: 1,
          failed: 1,
          accuracy: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$passed', { $max: ['$attempts', 1] }] },
                  100
                ]
              },
              1
            ]
          }
        }
      }
    ];

    // 4. Memory State Breakdown (Active Strengths, Weaknesses, Superseded)
    const memoryPipeline = [
      { $match: { ownerId } },
      {
        $group: {
          _id: { type: '$type', status: '$status' },
          count: { $sum: 1 }
        }
      }
    ];

    const [timeline, topicStats, subjectStats, memoryStats] = await Promise.all([
      db.collection('attempts').aggregate(timelinePipeline).toArray(),
      db.collection('attempts').aggregate(topicPipeline).toArray(),
      db.collection('attempts').aggregate(subjectPipeline).toArray(),
      db.collection('memories').aggregate(memoryPipeline).toArray()
    ]);

    // Aggregate summary metrics
    const totalAttempts = timeline.reduce((acc, p) => acc + p.attempts, 0);
    const totalCorrect = timeline.reduce((acc, p) => acc + p.correct, 0);
    const overallAccuracy = totalAttempts > 0
      ? Number(((totalCorrect / totalAttempts) * 100).toFixed(1))
      : 0;

    // Format topic breakdown with friendly labels
    const allTopics = [
      ...TOPICS.DBMS.map((t) => ({ topic: t, subject: 'DBMS' })),
      ...TOPICS.OS.map((t) => ({ topic: t, subject: 'OS' }))
    ];

    const topicBreakdown = allTopics.map(({ topic, subject }) => {
      const found = topicStats.find((s) => s.topic === topic);
      return {
        topic,
        subject,
        label: TOPIC_LABELS[topic] || topic,
        attempts: found ? found.attempts : 0,
        correct: found ? found.correct : 0,
        wrong: found ? found.wrong : 0,
        accuracy: found ? found.accuracy : 0
      };
    });

    // Format memory breakdown
    let activeStrengths = 0;
    let activeWeaknesses = 0;
    let supersededCount = 0;

    for (const m of memoryStats) {
      if (m._id.status === 'superseded') {
        supersededCount += m.count;
      } else if (m._id.status === 'active') {
        if (m._id.type === 'strength') activeStrengths += m.count;
        if (m._id.type === 'weakness') activeWeaknesses += m.count;
      }
    }

    res.status(200).json({
      studentId: ownerId,
      overallAccuracy,
      totalAttempts,
      totalCorrect,
      timeline,
      topicBreakdown,
      subjectBreakdown: subjectStats,
      memoryBreakdown: {
        activeStrengths,
        activeWeaknesses,
        supersededCount
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
