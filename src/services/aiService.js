// src/services/aiService.js
// Integrates Claude via @anthropic-ai/sdk to generate personalized questions.
// WHY: Resilience principle: If the Anthropic API is down, missing a key, timing out (>15s),
// or returns malformed JSON, we retry once and gracefully fall back to our verified question bank.
// The application NEVER crashes because an external third-party API is unavailable.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { buildSystemPrompt, buildUserPrompt } from '../logic/promptBuilder.js';
import { aiGeneratedQuestionSchema, validateInput } from '../logic/validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load question bank for reliable fallback
const questionBankPath = path.join(__dirname, '../../data/questionBank.json');
const questionBank = JSON.parse(fs.readFileSync(questionBankPath, 'utf-8'));

let anthropicClient = null;
if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim()) {
  try {
    anthropicClient = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY.trim()
    });
  } catch (err) {
    console.warn('Failed to initialize Anthropic client:', err.message);
  }
}

/**
 * Picks a fallback question from data/questionBank.json for the topic.
 */
function getFallbackQuestion(subject, topic) {
  const matches = questionBank.filter((q) => q.subject === subject && q.topic === topic);
  if (matches.length > 0) {
    const randomIndex = Math.floor(Math.random() * matches.length);
    return { ...matches[randomIndex] };
  }
  return { ...questionBank[0] };
}

/**
 * Attempts a single call to Claude to generate an MCQ.
 */
async function callClaudeOnce(systemPrompt, userPrompt) {
  if (!anthropicClient) {
    throw new Error('Anthropic API key is not configured.');
  }

  // Set strict 15-second timeout as required by the hackathon spec
  const response = await anthropicClient.messages.create(
    {
      model: env.AI_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    },
    { timeout: 15000 }
  );

  const rawText = response.content?.[0]?.text?.trim() || '';

  // Clean Markdown formatting (e.g., ```json ... ```)
  let cleanJson = rawText;
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.slice(7);
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.slice(3);
  }
  if (cleanJson.endsWith('```')) {
    cleanJson = cleanJson.slice(0, -3);
  }

  const parsed = JSON.parse(cleanJson.trim());
  const validation = validateInput(aiGeneratedQuestionSchema, parsed);

  if (!validation.success) {
    throw new Error(`Claude output failed Zod validation: ${validation.error.issues[0]?.message}`);
  }

  return validation.data;
}

/**
 * Generates an adaptive question using Claude with 1 retry and fallback to question bank.
 */
export async function generateQuestionWithAI({ subject, topic, difficulty, memories = [] }) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ subject, topic, difficulty, memories });

  // Attempt 1
  try {
    const questionData = await callClaudeOnce(systemPrompt, userPrompt);
    return {
      ...questionData,
      degraded: false
    };
  } catch (err1) {
    console.warn(`Claude question generation attempt 1 failed: ${err1.message}. Retrying once...`);

    // Attempt 2 (Retry once)
    try {
      const questionData = await callClaudeOnce(systemPrompt, userPrompt);
      return {
        ...questionData,
        degraded: false
      };
    } catch (err2) {
      console.warn(`Claude question generation attempt 2 failed: ${err2.message}. Gracefully falling back to question bank.`);
    }
  }

  // Fallback to verified curated question bank
  const fallback = getFallbackQuestion(subject, topic);
  return {
    question: fallback.question,
    options: fallback.options,
    correctIndex: fallback.correctIndex,
    explanation: fallback.explanation,
    difficulty: fallback.difficulty || difficulty,
    degraded: true // Mark degraded as required by specification
  };
}
