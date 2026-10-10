// src/services/memoryService.js
// Orchestrates memory updates, topic_stats counters, and lifecycle transitions.
// WHY: Business operations coordinate MongoDB reads/writes while keeping
// core cognitive rules isolated as pure functions in src/logic/memoryRules.js.

import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import {
  calculateExpiryDate,
  generateStableEmbeddingText,
  buildTopicStatsUpdate,
  evaluateMemoryRules
} from '../logic/memoryRules.js';
import { buildOwnerFilter } from '../logic/filters.js';
import { getEmbedding } from './embeddingService.js';

export async function processAnswerMemoryRules({ ownerId, subject, topic, isCorrect, specificIssue = '' }) {
  const db = getDB();
  const now = new Date();

  // STEP 1: Atomically update topic_stats counters
  const statsFilter = buildOwnerFilter(ownerId, { subject, topic });
  const statsUpdate = buildTopicStatsUpdate(isCorrect, now);

  const statsResult = await db.collection('topic_stats').findOneAndUpdate(
    statsFilter,
    statsUpdate,
    { upsert: true, returnDocument: 'after' }
  );

  const updatedStats = statsResult;

  // STEP 2: Fetch current active memories for this topic
  const activeMemories = await db.collection('memories').find(
    buildOwnerFilter(ownerId, { status: 'active', subject, topic })
  ).toArray();

  const activeWeakness = activeMemories.find((m) => m.type === 'weakness') || null;
  const activeStrength = activeMemories.find((m) => m.type === 'strength') || null;

  // STEP 3: Run pure memory rules
  const decision = evaluateMemoryRules({
    isCorrect,
    topicStats: updatedStats,
    activeWeakness,
    activeStrength
  });

  const actionsTaken = [];

  // RULE A or CONFLICT: Create or strengthen weakness
  if (decision.createWeakness) {
    // Concurrency Rule: Compute embedding ONLY when no active memory exists yet
    // WHY: Embeddings are stable representations of topic concepts; computing only
    // on initial creation saves compute latency and external API roundtrips.
    let embedding = null;
    if (!activeWeakness) {
      const embeddingText = generateStableEmbeddingText(subject, topic, 'weakness', specificIssue);
      try {
        embedding = await getEmbedding(embeddingText);
      } catch (embErr) {
        console.warn('Embedding service unavailable when creating weakness memory, using fallback zero vector:', embErr.message);
        embedding = new Array(env.EMBEDDING_DIMENSIONS).fill(0);
      }
    }

    const weaknessFilter = {
      ownerId,
      subject,
      topic,
      type: 'weakness',
      status: 'active'
    };
    const newStrength = decision.weaknessStrength;
    const newExpiresAt = calculateExpiryDate('weakness', false, now);

    const weaknessUpdateDoc = {
      $set: {
        strength: newStrength,
        updatedAt: now,
        expiresAt: newExpiresAt
      },
      $inc: {
        'evidence.wrong': 1,
        'evidence.attempts': 1
      },
      $setOnInsert: {
        ownerId,
        subject,
        topic,
        type: 'weakness',
        content: `${subject} ${topic}: student struggles with ${topic}`,
        source: 'quiz_attempt',
        status: 'active',
        private: false,
        createdAt: now,
        lastUsedAt: null,
        supersededBy: null,
        ...(embedding ? { embedding } : {})
      }
    };

    // Concurrency Rule: Single updateOne with upsert on { ownerId, subject, topic, type, status: 'active' }.
    // If MongoDB returns duplicate key error (code 11000) due to simultaneous requests racing, retry ONCE as plain update.
    try {
      const res = await db.collection('memories').updateOne(weaknessFilter, weaknessUpdateDoc, { upsert: true });
      if (res.upsertedCount > 0) {
        actionsTaken.push('created_new_weakness');
      } else {
        actionsTaken.push('strengthened_existing_weakness');
      }
    } catch (err) {
      if (err.code === 11000) {
        console.warn('Concurrency race detected on weakness creation (code 11000). Retrying ONCE as a plain update...');
        await db.collection('memories').updateOne(weaknessFilter, weaknessUpdateDoc);
        actionsTaken.push('strengthened_existing_weakness');
      } else {
        throw err;
      }
    }

    // If conflict: supersede existing strength memory
    if (decision.supersedeStrength && activeStrength) {
      await db.collection('memories').updateOne(
        buildOwnerFilter(ownerId, { _id: activeStrength._id }),
        {
          $set: {
            status: 'superseded',
            updatedAt: now,
            expiresAt: calculateExpiryDate('strength', true, now) // now + 7 days
          }
        }
      );
      actionsTaken.push('superseded_strength_due_to_conflict');
    }
  }

  // RULE B: Create strength memory and supersede active weakness
  if (decision.createStrength) {
    // Concurrency Rule: Compute embedding ONLY when no active memory exists yet
    let embedding = null;
    if (!activeStrength) {
      const embeddingText = generateStableEmbeddingText(subject, topic, 'strength');
      try {
        embedding = await getEmbedding(embeddingText);
      } catch (embErr) {
        console.warn('Embedding service unavailable when creating strength memory, using fallback zero vector:', embErr.message);
        embedding = new Array(env.EMBEDDING_DIMENSIONS).fill(0);
      }
    }

    const strengthFilter = {
      ownerId,
      subject,
      topic,
      type: 'strength',
      status: 'active'
    };
    const strengthExpiresAt = calculateExpiryDate('strength', false, now);

    const strengthUpdateDoc = {
      $set: {
        strength: 1.0,
        updatedAt: now,
        expiresAt: strengthExpiresAt
      },
      $inc: {
        'evidence.attempts': 1
      },
      $setOnInsert: {
        ownerId,
        subject,
        topic,
        type: 'strength',
        content: `${subject} ${topic}: student has demonstrated consistent mastery`,
        source: 'quiz_attempt',
        'evidence.wrong': 0,
        status: 'active',
        private: false,
        createdAt: now,
        lastUsedAt: null,
        supersededBy: null,
        ...(embedding ? { embedding } : {})
      }
    };

    // Concurrency Rule: Single updateOne with upsert. Retry ONCE on code 11000 as plain update.
    try {
      const res = await db.collection('memories').updateOne(strengthFilter, strengthUpdateDoc, { upsert: true });
      if (res.upsertedCount > 0) {
        actionsTaken.push('created_strength_memory');
      } else {
        actionsTaken.push('strengthened_existing_strength');
      }
    } catch (err) {
      if (err.code === 11000) {
        console.warn('Concurrency race detected on strength creation (code 11000). Retrying ONCE as a plain update...');
        await db.collection('memories').updateOne(strengthFilter, strengthUpdateDoc);
        actionsTaken.push('strengthened_existing_strength');
      } else {
        throw err;
      }
    }

    // Supersede active weakness
    if (decision.supersedeWeakness && activeWeakness) {
      await db.collection('memories').updateOne(
        buildOwnerFilter(ownerId, { _id: activeWeakness._id }),
        {
          $set: {
            status: 'superseded',
            updatedAt: now,
            expiresAt: calculateExpiryDate('weakness', true, now) // now + 7 days
          }
        }
      );
      actionsTaken.push('superseded_weakness');
    }

    // Reset wrongSinceReset counter in topic_stats
    if (decision.resetWrongSinceReset) {
      await db.collection('topic_stats').updateOne(
        statsFilter,
        { $set: { wrongSinceReset: 0 } }
      );
    }
  }

  return {
    updatedStats,
    actionsTaken
  };
}

export async function correctMemory({ ownerId, memoryId, studentCorrectionText }) {
  const db = getDB();
  const now = new Date();

  let targetId;
  try {
    targetId = new ObjectId(memoryId);
  } catch (err) {
    throw new Error('Invalid memory ID format');
  }

  const oldMemory = await db.collection('memories').findOne(
    buildOwnerFilter(ownerId, { _id: targetId, status: 'active' })
  );

  if (!oldMemory) {
    return null;
  }

  // Create new strength memory with source "student_correction"
  const embeddingText = generateStableEmbeddingText(oldMemory.subject, oldMemory.topic, 'strength');
  let embedding;
  try {
    embedding = await getEmbedding(embeddingText);
  } catch (embErr) {
    console.warn('Embedding service unavailable when correcting memory, using fallback zero vector:', embErr.message);
    embedding = new Array(env.EMBEDDING_DIMENSIONS).fill(0);
  }
  const expiresAt = calculateExpiryDate('strength', false, now);

  const newStrengthDoc = {
    ownerId,
    type: 'strength',
    subject: oldMemory.subject,
    topic: oldMemory.topic,
    content: studentCorrectionText.slice(0, 300),
    source: 'student_correction',
    strength: 1.0,
    evidence: { wrong: 0, attempts: 1 },
    embedding,
    status: 'active',
    private: false,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    expiresAt,
    supersededBy: null
  };

  const insertResult = await db.collection('memories').insertOne(newStrengthDoc);
  const newMemoryId = insertResult.insertedId;

  // Mark old memory as superseded
  await db.collection('memories').updateOne(
    buildOwnerFilter(ownerId, { _id: targetId }),
    {
      $set: {
        status: 'superseded',
        supersededBy: newMemoryId,
        updatedAt: now,
        expiresAt: calculateExpiryDate(oldMemory.type, true, now)
      }
    }
  );

  // Reset wrongSinceReset in topic_stats
  await db.collection('topic_stats').updateOne(
    buildOwnerFilter(ownerId, { subject: oldMemory.subject, topic: oldMemory.topic }),
    { $set: { wrongSinceReset: 0 } }
  );

  return {
    supersededId: oldMemory._id,
    newMemoryId,
    newMemory: newStrengthDoc
  };
}

export async function deleteMemory({ ownerId, memoryId }) {
  const db = getDB();

  let targetId;
  try {
    targetId = new ObjectId(memoryId);
  } catch (err) {
    throw new Error('Invalid memory ID format');
  }

  // Strict hard delete in application logic
  const result = await db.collection('memories').deleteOne(
    buildOwnerFilter(ownerId, { _id: targetId })
  );

  return result.deletedCount > 0;
}

export async function getMemoriesList({ ownerId, skip = 0, limit = 20 }) {
  const db = getDB();
  const safeLimit = Math.min(Math.max(1, limit), 50); // Cap at max 50

  const filter = buildOwnerFilter(ownerId);
  const total = await db.collection('memories').countDocuments(filter);

  // Exclude heavy embedding vectors from list responses for performance
  const memories = await db.collection('memories')
    .find(filter, { projection: { embedding: 0 } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .toArray();

  return {
    memories,
    total,
    skip,
    limit: safeLimit
  };
}
