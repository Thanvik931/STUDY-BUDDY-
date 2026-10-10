// tests/promptBuilder.test.js
// Unit tests for prompt building, XML fencing, and privacy exclusion.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSystemPrompt,
  buildUserPrompt,
  sanitizeMemoryText
} from '../src/logic/promptBuilder.js';

test('7. the prompt builder fences memory text and excludes private memories', () => {
  const publicMemory = {
    content: 'Struggles with 2NF partial dependencies',
    type: 'weakness',
    private: false
  };

  const privateMemory = {
    content: 'Student has test anxiety and prefers extra time',
    type: 'preference',
    private: true // Must be excluded from prompt!
  };

  const prompt = buildUserPrompt({
    subject: 'DBMS',
    topic: 'normalization',
    difficulty: 'easy',
    memories: [publicMemory, privateMemory]
  });

  // Verify memory XML fencing
  assert.match(prompt, /<student_memories>/);
  assert.match(prompt, /<\/student_memories>/);

  // Verify public memory is included
  assert.match(prompt, /Struggles with 2NF partial dependencies/);

  // Verify private memory is strictly excluded
  assert.equal(prompt.includes('Student has test anxiety'), false);
});

test('Sanitizer strips control characters and caps length to 300', () => {
  const rawWithControl = 'Valid text\x00\x08with hidden\x1Fcontrol characters';
  const clean = sanitizeMemoryText(rawWithControl, 300);
  assert.equal(clean, 'Valid textwith hiddencontrol characters');

  const longText = 'a'.repeat(400);
  const capped = sanitizeMemoryText(longText, 300);
  assert.equal(capped.length, 300);
});
