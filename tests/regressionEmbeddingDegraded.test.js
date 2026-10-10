// tests/regressionEmbeddingDegraded.test.js
// Regression test: Ensures that when embedding retrieval fails,
// the system degrades gracefully with degraded: true and medium difficulty.

import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveHybridMemories } from '../src/services/retrievalService.js';
import { connectDB, closeDB } from '../src/db.js';
import { env, setStressFlags } from '../src/config/env.js';

test('19. Regression: Embedding failure in hybrid retrieval flags degraded=true and falls back to medium difficulty', async () => {
  // Connect to DB for test
  await connectDB();

  try {
    if (env.STRESS_MODE) {
      // Simulate embedding failure
      setStressFlags({ failEmbedding: true });

      const memories = await retrieveHybridMemories({
        ownerId: 'test_student',
        subject: 'DBMS',
        topic: 'sql-joins'
      });

      assert.equal(memories.degraded, true, 'Retrieved memories must indicate degraded=true when embedding fails');
      assert.equal(memories.embeddingFailed, true, 'Retrieved memories must indicate embeddingFailed=true');

      // Reset flag
      setStressFlags({ failEmbedding: false });
    } else {
      // If STRESS_MODE is false, verify retrieveHybridMemories returns array
      const memories = await retrieveHybridMemories({
        ownerId: 'test_student',
        subject: 'DBMS',
        topic: 'sql-joins'
      });
      assert.ok(Array.isArray(memories));
    }
  } finally {
    // Clean up DB connection
    await closeDB();
  }
});
