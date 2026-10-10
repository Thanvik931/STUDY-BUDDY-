// src/services/embeddingService.js
// Generates numerical vector embeddings for memory text and search queries.
// WHY: We maintain an in-memory LRU cache of 500 entries (keyed by simple text hash)
// as an optimization to avoid redundant external network calls for identical queries.

import { env, getStressFlags } from '../config/env.js';

// Simple in-memory LRU cache (capped at 500 entries)
class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    // Refresh position to mark as recently used
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}

const embeddingCache = new LRUCache(500);

/**
 * Generates a deterministic fake vector derived from a 32-bit hash of the text.
 * Note: Fake vectors carry no meaning, so the stress test measures backend and database behavior, not retrieval quality.
 */
function generateDeterministicFakeVector(text, dimensions = 1536) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  const vector = new Array(dimensions).fill(0);
  for (let j = 0; j < dimensions; j++) {
    vector[j] = Math.sin(hash + j);
  }
  // Normalize vector to unit length
  let sumSq = 0;
  for (let k = 0; k < dimensions; k++) {
    sumSq += vector[k] * vector[k];
  }
  const magnitude = Math.sqrt(sumSq) || 1.0;
  return vector.map((val) => Number((val / magnitude).toFixed(6)));
}

/**
 * Creates a deterministic, normalized unit vector for local testing or offline operation.
 */
function generateLocalVector(text, dimensions = 1536) {
  const vector = new Array(dimensions).fill(0);
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const index = (charCode * 31 + i) % dimensions;
    vector[index] += 1.0;
  }
  // Calculate Euclidean norm
  let sumSq = 0;
  for (let j = 0; j < dimensions; j++) {
    sumSq += vector[j] * vector[j];
  }
  const magnitude = Math.sqrt(sumSq) || 1.0;
  // Normalize vector to unit length
  return vector.map((val) => val / magnitude);
}

/**
 * Generates an embedding vector for the given text.
 * Checks the in-memory cache first, then calls the configured provider or fallback.
 */
export async function getEmbedding(text) {
  // STRESS_MODE Branch:
  // (c) returns a deterministic fake vector derived from a hash of the text (no paid API call)
  // (d) honors failEmbedding runtime flag
  if (env.STRESS_MODE) {
    const flags = getStressFlags();
    if (flags.failEmbedding) {
      throw new Error('Simulated embedding failure (failEmbedding=true in STRESS_MODE)');
    }
    return generateDeterministicFakeVector(text, env.EMBEDDING_DIMENSIONS);
  }

  // Normal Production Path:
  // INVARIANT: When STRESS_MODE is false, failEmbedding has NO effect!
  const cacheKey = text.trim().toLowerCase();
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let vector;

  // If external provider is configured and not local
  if (env.EMBEDDING_PROVIDER === 'openai' && env.EMBEDDING_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.EMBEDDING_API_KEY}`
        },
        body: JSON.stringify({
          model: env.EMBEDDING_MODEL || 'text-embedding-3-small',
          input: text
        }),
        signal: AbortSignal.timeout(8000) // 8 second timeout as required by spec
      });
      if (response.ok) {
        const json = await response.json();
        vector = json.data[0].embedding;
      }
    } catch (err) {
      console.warn('Embedding API call failed, falling back to local vector:', err.message);
    }
  }

  // Fallback to deterministic normalized local vector
  if (!vector) {
    vector = generateLocalVector(text, env.EMBEDDING_DIMENSIONS);
  }

  embeddingCache.set(cacheKey, vector);
  return vector;
}
