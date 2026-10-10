// src/routes/quiz.js
// Handles question dispatching and answer evaluations.
// WHY: Enforces that correctIndex is NEVER revealed before an answer is submitted,
// logs every attempt for progress tracking, and invokes cognitive memory transitions.

import express from 'express';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../db.js';
import { requireStudent } from '../middleware/requireStudent.js';
import { subjectTopicSchema, answerSubmissionSchema, validateInput } from '../logic/validators.js';
import { buildOwnerFilter } from '../logic/filters.js';
import { processAnswerMemoryRules } from '../services/memoryService.js';

import { retrieveHybridMemories } from '../services/retrievalService.js';
import { generateQuestionWithAI } from '../services/aiService.js';
import { determineDifficulty, buildWhyThisQuestion } from '../logic/scoring.js';

const router = express.Router();

// POST /api/question - Request an adaptive question powered by Agentic Memory & AI
router.post('/question', requireStudent, async (req, res, next) => {
  const validation = validateInput(subjectTopicSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_SUBJECT_OR_TOPIC',
        message: validation.error.issues[0].message
      }
    });
  }

  const { subject, topic } = validation.data;
  const ownerId = req.ownerId;
  const now = new Date();

  try {
    const db = getDB();

    // 1. Hybrid Memory Retrieval (Atlas Vector Search + Exact Topic Lookup)
    let retrievedMemories = [];
    let retrievalFailed = false;

    try {
      retrievedMemories = await retrieveHybridMemories({ ownerId, subject, topic });
      if (retrievedMemories?.embeddingFailed || retrievedMemories?.degraded) {
        retrievalFailed = true;
      }
    } catch (err) {
      console.warn('Memory retrieval failed, continuing with no memories:', err.message);
      retrievalFailed = true;
    }

    // 2. Select Difficulty based on retrieved memories (default to medium if retrieval degraded)
    const difficulty = retrievalFailed
      ? 'medium'
      : determineDifficulty(retrievedMemories, topic);

    // 3. Generate Question with AI (with 1 retry and fallback to question bank)
    const generated = await generateQuestionWithAI({
      subject,
      topic,
      difficulty,
      memories: retrievedMemories
    });

    // 4. Construct transparent whyThisQuestion explanation
    const whyThisQuestion = buildWhyThisQuestion(difficulty, retrievedMemories, topic);

    // 5. Store question in 'questions' collection (auto-expires in 24 hours via TTL index)
    const questionDoc = {
      ownerId,
      subject,
      topic,
      question: generated.question,
      options: generated.options,
      correctIndex: generated.correctIndex, // Safely stored on server only!
      explanation: generated.explanation,
      difficulty: generated.difficulty || difficulty,
      memoryIdsUsed: retrievedMemories.map((m) => m._id),
      createdAt: now
    };

    const insertResult = await db.collection('questions').insertOne(questionDoc);

    // 6. Return response to client: correctIndex is STRICTLY EXCLUDED!
    res.status(200).json({
      questionId: insertResult.insertedId.toString(),
      subject,
      topic,
      question: generated.question,
      options: generated.options,
      difficulty: generated.difficulty || difficulty,
      memoriesUsed: retrievedMemories, // Full breakdown: relevance, strength, recency, final, matchedBy
      degraded: Boolean(generated.degraded || retrievalFailed),
      whyThisQuestion
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/answer - Submit an answer to a question
router.post('/answer', requireStudent, async (req, res, next) => {
  const validation = validateInput(answerSubmissionSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: validation.error.issues[0].message
      }
    });
  }

  const { questionId, selectedOptionIndex } = validation.data;
  const ownerId = req.ownerId;
  const now = new Date();

  try {
    const db = getDB();

    let targetId;
    try {
      targetId = new ObjectId(questionId);
    } catch (err) {
      return res.status(400).json({
        error: {
          code: 'INVALID_QUESTION_ID',
          message: 'Question ID must be a valid MongoDB ObjectId'
        }
      });
    }

    // Retrieve question, strictly ensuring student owns it
    const questionDoc = await db.collection('questions').findOne(
      buildOwnerFilter(ownerId, { _id: targetId })
    );

    if (!questionDoc) {
      return res.status(404).json({
        error: {
          code: 'QUESTION_NOT_FOUND',
          message: 'Question not found or expired'
        }
      });
    }

    const isCorrect = selectedOptionIndex === questionDoc.correctIndex;

    // 1. Log attempt into 'attempts' collection (governed by strict $jsonSchema)
    const attemptDoc = {
      ownerId,
      subject: questionDoc.subject,
      topic: questionDoc.topic,
      questionId: questionId,
      correct: isCorrect,
      difficulty: questionDoc.difficulty,
      createdAt: now
    };
    await db.collection('attempts').insertOne(attemptDoc);

    // 2. Process memory rules (atomic topic_stats update + Rule A/B transitions)
    const memoryResult = await processAnswerMemoryRules({
      ownerId,
      subject: questionDoc.subject,
      topic: questionDoc.topic,
      isCorrect,
      specificIssue: `Selected option ${selectedOptionIndex}`
    });

    res.status(200).json({
      correct: isCorrect,
      correctIndex: questionDoc.correctIndex, // Revealed only now after submission
      explanation: questionDoc.explanation,
      topicStats: memoryResult.updatedStats,
      memoryActions: memoryResult.actionsTaken
    });
  } catch (err) {
    next(err);
  }
});

export default router;
