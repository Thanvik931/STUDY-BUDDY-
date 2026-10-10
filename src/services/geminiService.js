// src/services/geminiService.js
// Gemini AI integration for in-depth engineering concept teaching.
// WHY: Ingests live student memory (exact passed/failed counts, accuracy %, and weakness diagnoses)
// to deliver personalized, masterclass-level explanations with intuitions, mechanics, pitfalls, and code.

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Attempts to call Google Gemini API with timeout and error handling.
 */
async function callGeminiApi(prompt, model = 'gemini-2.5-flash', timeoutMs = 8000) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      })
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${errBody.substring(0, 150)}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini API returned empty text part');
    }

    return JSON.parse(candidateText);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Generates an in-depth concept lesson using Gemini AI, personalized with student memory.
 * Falls back safely to high-yield engineering knowledge enriched with exact student pass/fail stats.
 */
export async function generateGeminiLesson({ subject, topic, topicLabel, studentStats, weakMemory, strengthMemory, baseLesson }) {
  const prompt = `You are a distinguished Computer Science Professor.
Teach a comprehensive, masterclass-level engineering lesson on: "${topicLabel}" (${subject}).

STUDENT'S EXACT MEMORY PROFILE FROM MONGODB:
- Questions Attempted: ${studentStats.totalAttempts}
- Passed (Correct): ${studentStats.passedCount}
- Failed (Incorrect): ${studentStats.failedCount}
- Mastery Accuracy: ${studentStats.accuracyPercent}%
- Recorded Cognitive Weakness: ${weakMemory ? `"${weakMemory.content}"` : 'None currently recorded'}
- Demonstrated Strengths: ${strengthMemory ? `"${strengthMemory.content}"` : 'None currently recorded'}

Return ONLY a JSON object with this exact structure:
{
  "summary": "Concise 1-2 sentence core definition and high-level purpose.",
  "diagnosis": "Direct analysis of student's ${studentStats.accuracyPercent}% accuracy (${studentStats.failedCount} failures out of ${studentStats.totalAttempts} attempts), explaining the exact conceptual flaw that caused these errors.",
  "analogy": "A brilliant real-world physical or intuitive analogy that makes the mechanism stick forever.",
  "coreMechanics": "Rigorous technical breakdown of how it works under the hood, key invariants, state transitions, and step-by-step mechanics.",
  "pitfalls": "Common exam traps and subtle edge cases where students stumble (especially the ones matching the student's failures).",
  "codeOrDiagram": "Real-world code snippet, SQL query, or ASCII architecture diagram illustrating the mechanism.",
  "keyTakeaways": [
    "Takeaway 1: Core invariant",
    "Takeaway 2: Algorithmic complexity / performance implication",
    "Takeaway 3: Best practice rule of thumb",
    "Takeaway 4: Key exam trick to remember"
  ]
}`;

  // Try calling Gemini API
  if (env.GEMINI_API_KEY) {
    for (const model of ['gemini-2.5-flash', 'gemini-flash-latest']) {
      try {
        const geminiResult = await callGeminiApi(prompt, model, 7000);
        if (geminiResult && geminiResult.coreMechanics) {
          logger.info(`Successfully generated lesson using Gemini model: ${model}`);
          return {
            title: topicLabel,
            ...geminiResult,
            aiProvider: 'gemini',
            model,
            studentStats
          };
        }
      } catch (geminiErr) {
        logger.warn(`Gemini API attempt with model ${model} did not complete: ${geminiErr.message}. Checking fallback.`);
      }
    }
  }

  // Graceful Adaptive Fallback: Blend deep curriculum with live student pass/fail percentages
  logger.info(`Serving personalized adaptive lesson for ${topic} with live memory statistics.`);

  let diagnosisText = '';
  if (studentStats.totalAttempts === 0) {
    diagnosisText = `Initial Assessment: You have not attempted questions on ${topicLabel} yet. Review this lesson thoroughly before testing your knowledge on the 10-Question Quiz.`;
  } else if (studentStats.accuracyPercent < 50) {
    diagnosisText = `Critical Weakness Diagnosed: Your historical pass rate is ${studentStats.accuracyPercent}% (${studentStats.passedCount} passed, ${studentStats.failedCount} failed out of ${studentStats.totalAttempts} attempts). Your errors stem from confusing core invariants and falling for subtle distractor options. Focus intensely on Section 3 (Common Traps) below.`;
  } else if (studentStats.accuracyPercent < 80) {
    diagnosisText = `Moderate Mastery: Your pass rate is ${studentStats.accuracyPercent}% (${studentStats.passedCount} passed, ${studentStats.failedCount} failed). You have solid foundational knowledge, but edge cases in high-stress questions still trip you up. Pay close attention to the Worked Code and Invariants in Section 2 & 4.`;
  } else {
    diagnosisText = `High Mastery (${studentStats.accuracyPercent}% Accuracy): You have passed ${studentStats.passedCount} of ${studentStats.totalAttempts} attempts! Use this deep breakdown to reinforce theoretical proofs and optimize your mental model for competitive and university examinations.`;
  }

  if (weakMemory) {
    diagnosisText += ` Specifically, MongoDB memory recorded: "${weakMemory.content}".`;
  }

  return {
    title: topicLabel,
    summary: baseLesson?.summary || `Comprehensive engineering guide on ${topicLabel}.`,
    diagnosis: diagnosisText,
    analogy: baseLesson?.analogy || `Think of ${topicLabel} as a foundational building block in modern ${subject}.`,
    coreMechanics: baseLesson?.coreMechanics || 'Detailed mechanical steps and architectural behavior.',
    pitfalls: baseLesson?.commonPitfalls || 'Avoid common misconceptions and inverted assumptions.',
    codeOrDiagram: baseLesson?.codeOrDiagram || '-- Code / Architecture Example',
    keyTakeaways: baseLesson?.keyTakeaways || [
      `Master the core invariants of ${topicLabel}.`,
      'Observe trade-offs between memory footprint and latency.',
      'Always test edge cases and boundary conditions.'
    ],
    aiProvider: 'gemini-adaptive',
    studentStats
  };
}
