// src/services/retrievalService.js
// Hybrid memory retrieval combining Atlas Vector Search and exact topic matching.
// WHY: Vector Search catches conceptually related memories across topics, while
// exact topic lookup catches brand-new memories that Vector Search has not finished indexing yet.

import { getDB } from '../db.js';
import { getEmbedding } from './embeddingService.js';
import { calculateRecencyScore, computeMemoryScore } from '../logic/scoring.js';
import { buildOwnerFilter } from '../logic/filters.js';

export async function retrieveHybridMemories({ ownerId, subject, topic }) {
  const db = getDB();
  const now = new Date();
  const queryText = `${subject} ${topic}`;

  // 1. Generate query embedding (utilizes LRU cache in embeddingService)
  let queryEmbedding = null;
  let embeddingFailed = false;
  try {
    queryEmbedding = await getEmbedding(queryText);
  } catch (err) {
    console.warn('Embedding generation failed during retrieval, proceeding with exact match only:', err.message);
    embeddingFailed = true;
  }

  // 2. Run both searches in parallel with Promise.all
  const vectorSearchPromise = (async () => {
    if (!queryEmbedding) return [];
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: 'memory_vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 50,
            limit: 5,
            filter: {
              ownerId: ownerId,
              status: 'active'
            }
          }
        },
        {
          $project: {
            ownerId: 1,
            type: 1,
            subject: 1,
            topic: 1,
            content: 1,
            source: 1,
            strength: 1,
            status: 1,
            private: 1,
            updatedAt: 1,
            createdAt: 1,
            vectorScore: { $meta: 'vectorSearchScore' }
          }
        }
      ];
      return await db.collection('memories').aggregate(pipeline).toArray();
    } catch (err) {
      console.warn('Atlas $vectorSearch query failed, falling back to exact topic matching:', err.message);
      return [];
    }
  })();

  const exactSearchPromise = (async () => {
    try {
      return await db.collection('memories').find(
        buildOwnerFilter(ownerId, {
          status: 'active',
          subject,
          topic
        }),
        { projection: { embedding: 0 } }
      ).limit(5).toArray();
    } catch (err) {
      console.warn('Exact memory lookup failed:', err.message);
      return [];
    }
  })();

  const [vectorResults, exactResults] = await Promise.all([
    vectorSearchPromise,
    exactSearchPromise
  ]);

  // 3. Merge and de-duplicate by _id
  const memoryMap = new Map();

  for (const doc of vectorResults) {
    const idStr = doc._id.toString();
    memoryMap.set(idStr, {
      ...doc,
      vectorScore: typeof doc.vectorScore === 'number' ? doc.vectorScore : 0.8,
      matchedBy: ['vector']
    });
  }

  for (const doc of exactResults) {
    const idStr = doc._id.toString();
    if (memoryMap.has(idStr)) {
      const existing = memoryMap.get(idStr);
      existing.matchedBy.push('topic');
      existing.exactMatch = true;
    } else {
      memoryMap.set(idStr, {
        ...doc,
        vectorScore: 0.0,
        exactMatch: true,
        matchedBy: ['topic']
      });
    }
  }

  // 4. Score each memory: final = 0.5 * relevance + 0.3 * strength + 0.2 * recency
  const scoredMemories = [];

  for (const [idStr, mem] of memoryMap.entries()) {
    // Relevance is 1 for exact topic match, or vectorScore
    const relevance = mem.exactMatch ? 1.0 : (mem.vectorScore || 0.5);
    const strength = typeof mem.strength === 'number' ? mem.strength : 0.5;
    const recency = calculateRecencyScore(mem.updatedAt || mem.createdAt || now, now);

    const finalScore = computeMemoryScore({ relevance, strength, recency });

    scoredMemories.push({
      _id: mem._id,
      type: mem.type,
      subject: mem.subject,
      topic: mem.topic,
      content: mem.content,
      source: mem.source,
      status: mem.status,
      private: Boolean(mem.private),
      matchedBy: mem.matchedBy,
      scores: {
        relevance: Number(relevance.toFixed(3)),
        strength: Number(strength.toFixed(3)),
        recency: Number(recency.toFixed(3)),
        final: finalScore
      }
    });
  }

  // 5. Rank by final score descending and pick top 3
  scoredMemories.sort((a, b) => b.scores.final - a.scores.final);
  const topMemories = scoredMemories.slice(0, 3);

  // 6. Asynchronously update lastUsedAt on the memories used
  if (topMemories.length > 0) {
    const usedIds = topMemories.map((m) => m._id);
    db.collection('memories').updateMany(
      { _id: { $in: usedIds } },
      { $set: { lastUsedAt: now } }
    ).catch((err) => console.warn('Failed to update lastUsedAt on memories:', err.message));
  }

  topMemories.embeddingFailed = embeddingFailed;
  topMemories.degraded = embeddingFailed;
  return topMemories;
}
