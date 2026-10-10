// src/routes/students.js
// Handles student profile listing and creation.
// WHY: In Study Buddy, students pick or create a profile to maintain isolated
// memories and topic statistics.

import express from 'express';
import { getDB } from '../db.js';
import { studentCreateSchema, validateInput } from '../logic/validators.js';

const router = express.Router();

// GET /api/students - List all student profiles
router.get('/students', async (req, res, next) => {
  try {
    const db = getDB();
    const students = await db.collection('students')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ students });
  } catch (err) {
    next(err);
  }
});

// POST /api/students - Create a new student profile
router.post('/students', async (req, res, next) => {
  const validation = validateInput(studentCreateSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: validation.error.issues[0].message
      }
    });
  }

  try {
    const db = getDB();
    const { name } = validation.data;
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const studentId = `stu_${Date.now()}_${randomSuffix}`;

    const studentDoc = {
      _id: studentId,
      name,
      createdAt: new Date()
    };

    await db.collection('students').insertOne(studentDoc);

    res.status(201).json({
      message: 'Student created successfully',
      student: studentDoc
    });
  } catch (err) {
    next(err);
  }
});

export default router;
