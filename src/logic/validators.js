// src/logic/validators.js
// This file contains:
// 1. MongoDB $jsonSchema definitions for the 'memories' and 'attempts' collections.
//    WHY: MongoDB database-level schemas reject malformed documents with validationLevel 'strict',
//    acting as a rock-solid safety net against corrupted data.
// 2. Pure Zod schemas for validating incoming HTTP request bodies and AI outputs.
//    WHY: Pure functions have zero database calls, making them fast and 100% unit testable.

import { z } from 'zod';
import { TOPICS, SUBJECTS } from '../config/topics.js';

// --- MONGODB $jsonSchema DEFINITIONS ---

export const memoriesSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['ownerId', 'type', 'subject', 'topic', 'content', 'source', 'strength', 'status', 'createdAt', 'updatedAt'],
    properties: {
      ownerId: {
        bsonType: 'string',
        description: 'ID of the student who owns this memory'
      },
      type: {
        enum: ['weakness', 'strength', 'preference', 'outcome', 'feedback'],
        description: 'Category of cognitive memory'
      },
      subject: {
        enum: SUBJECTS,
        description: 'Subject code (DBMS or OS)'
      },
      topic: {
        bsonType: 'string',
        description: 'Specific topic key within the subject'
      },
      content: {
        bsonType: 'string',
        maxLength: 300,
        description: 'Concise summary of the memory (up to 300 characters)'
      },
      source: {
        enum: ['quiz_attempt', 'student_correction', 'student_input', 'seed', 'demo'],
        description: 'Where this memory originated'
      },
      strength: {
        bsonType: ['double', 'int'],
        minimum: 0,
        maximum: 1,
        description: 'Confidence / strength score between 0 and 1'
      },
      evidence: {
        bsonType: 'object',
        properties: {
          wrong: { bsonType: 'int', minimum: 0 },
          attempts: { bsonType: 'int', minimum: 0 }
        }
      },
      embedding: {
        bsonType: 'array',
        items: { bsonType: ['double', 'int'] },
        description: 'Numerical vector representation for semantic search'
      },
      status: {
        enum: ['active', 'superseded'],
        description: 'Whether this memory is actively used or has been replaced'
      },
      private: {
        bsonType: 'bool',
        description: 'If true, never inject into AI prompts'
      },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
      lastUsedAt: { bsonType: ['date', 'null'] },
      expiresAt: { bsonType: ['date', 'null'] },
      supersededBy: { bsonType: ['objectId', 'null'] }
    }
  }
};

export const attemptsSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['ownerId', 'subject', 'topic', 'questionId', 'correct', 'difficulty', 'createdAt'],
    properties: {
      ownerId: { bsonType: 'string' },
      subject: { enum: SUBJECTS },
      topic: { bsonType: 'string' },
      questionId: { bsonType: 'string' },
      correct: { bsonType: 'bool' },
      difficulty: { enum: ['easy', 'medium', 'hard'] },
      createdAt: { bsonType: 'date' }
    }
  }
};

// --- PURE ZOD SCHEMAS FOR INCOMING HTTP REQUESTS ---

export const studentCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters')
});

export const subjectTopicSchema = z.object({
  subject: z.enum(['DBMS', 'OS'], { errorMap: () => ({ message: 'Subject must be either DBMS or OS' }) }),
  topic: z.string().min(1, 'Topic is required')
}).refine((data) => {
  return TOPICS[data.subject] && TOPICS[data.subject].includes(data.topic);
}, {
  message: 'Topic is not valid for the selected subject',
  path: ['topic']
});

export const answerSubmissionSchema = z.object({
  questionId: z.string().min(1, 'questionId is required'),
  selectedOptionIndex: z.number().int().min(0).max(3)
});

export const memoryCorrectionSchema = z.object({
  content: z.string().trim().min(5, 'Content must be at least 5 characters').max(300, 'Content must be at most 300 characters').optional(),
  studentCorrectionText: z.string().trim().min(5, 'Correction text must be at least 5 characters').max(300, 'Correction text must be at most 300 characters').optional()
}).refine((data) => Boolean(data.content || data.studentCorrectionText), {
  message: 'Correction content is required',
  path: ['content']
}).transform((data) => ({
  content: data.content || data.studentCorrectionText
}));

// Zod schema for validating AI-generated questions
export const aiGeneratedQuestionSchema = z.object({
  question: z.string().min(10, 'Question must be at least 10 characters'),
  options: z.array(z.string().min(1)).length(4, 'Must provide exactly 4 options'),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(10, 'Explanation must be at least 10 characters'),
  difficulty: z.enum(['easy', 'medium', 'hard'])
});

// Pure helper to validate input data without database access
export function validateInput(schema, data) {
  return schema.safeParse(data);
}
