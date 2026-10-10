// tests/validators.test.js
// Unit tests for input validation schemas and AI output validation.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  subjectTopicSchema,
  memoryCorrectionSchema,
  aiGeneratedQuestionSchema,
  validateInput
} from '../src/logic/validators.js';

test('8. validation rejects a bad subject, bad topic and oversized input', () => {
  // Valid subject and topic
  assert.equal(validateInput(subjectTopicSchema, { subject: 'DBMS', topic: 'sql-joins' }).success, true);
  assert.equal(validateInput(subjectTopicSchema, { subject: 'OS', topic: 'deadlocks' }).success, true);

  // Bad subject
  const badSubject = validateInput(subjectTopicSchema, { subject: 'MATH', topic: 'algebra' });
  assert.equal(badSubject.success, false);

  // Valid subject, but mismatched topic
  const badTopic = validateInput(subjectTopicSchema, { subject: 'DBMS', topic: 'deadlocks' });
  assert.equal(badTopic.success, false);

  // Oversized correction input (> 300 chars)
  const hugeText = 'a'.repeat(305);
  const oversized = validateInput(memoryCorrectionSchema, { content: hugeText });
  assert.equal(oversized.success, false);

  // Valid correction input
  const validCorrection = validateInput(memoryCorrectionSchema, { content: 'I now understand LEFT JOIN with NULLs.' });
  assert.equal(validCorrection.success, true);
});

test('9. the AI JSON validator accepts valid and rejects malformed output', () => {
  const validOutput = {
    question: 'What does an Inode store in Unix file systems?',
    options: ['File size', 'Permissions', 'Filename', 'Block pointers'],
    correctIndex: 2,
    explanation: 'Inodes store metadata but not filenames.',
    difficulty: 'medium'
  };

  assert.equal(validateInput(aiGeneratedQuestionSchema, validOutput).success, true);

  // Missing an option (only 3 options)
  const missingOption = {
    ...validOutput,
    options: ['A', 'B', 'C']
  };
  assert.equal(validateInput(aiGeneratedQuestionSchema, missingOption).success, false);

  // Invalid difficulty
  const badDifficulty = {
    ...validOutput,
    difficulty: 'impossible'
  };
  assert.equal(validateInput(aiGeneratedQuestionSchema, badDifficulty).success, false);

  // Out of range correctIndex
  const badIndex = {
    ...validOutput,
    correctIndex: 5
  };
  assert.equal(validateInput(aiGeneratedQuestionSchema, badIndex).success, false);
});
