// src/routes/progress.js
// Provides student progress metrics using an aggregation pipeline over the 'attempts' collection.
// WHY: Aggregation pipeline groups attempts by day and topic, calculating accuracy over time
// for rendering the Chart.js visual progress dashboard.

import express from 'express';
import { getDB } from '../db.js';
import { requireStudent } from '../middleware/requireStudent.js';

const router = express.Router();

router.get('/progress', requireStudent, async (req, res, next) => {
  try {
    const db = getDB();
    const ownerId = req.ownerId;

    // MongoDB Aggregation Pipeline: accuracy per topic per day
    const pipeline = [
      // 1. Strict owner filter
      {
        $match: { ownerId }
      },
      // 2. Group by calendar date and topic
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
      // 3. Compute accuracy percentage
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
      // 4. Sort chronologically
      {
        $sort: { date: 1, topic: 1 }
      }
    ];

    const progress = await db.collection('attempts').aggregate(pipeline).toArray();

    // Summary totals across all topics
    const totalAttempts = progress.reduce((acc, p) => acc + p.attempts, 0);
    const totalCorrect = progress.reduce((acc, p) => acc + p.correct, 0);
    const overallAccuracy = totalAttempts > 0
      ? Number(((totalCorrect / totalAttempts) * 100).toFixed(1))
      : 0;

    res.status(200).json({
      studentId: ownerId,
      overallAccuracy,
      totalAttempts,
      totalCorrect,
      timeline: progress
    });
  } catch (err) {
    next(err);
  }
});

export default router;
