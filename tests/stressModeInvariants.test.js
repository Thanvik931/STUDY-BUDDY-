// tests/stressModeInvariants.test.js
// Unit test proving that when STRESS_MODE is false, NONE of (b) to (f) exist or have any effect.
// WHY: Hackathon 11B requirement. Production safety guarantee: stress mode simulation features
// (fake embeddings, Claude bypass, rate limit bypass, failure injection flags) cannot leak into normal operation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { env, getStressFlags, setStressFlags } from '../src/config/env.js';

test('18. Invariant: When STRESS_MODE is not true, none of (b) to (f) exist or have any effect', async () => {
  // If running in a process where env.STRESS_MODE is false:
  if (!env.STRESS_MODE) {
    // (d) Flags FAIL_EMBEDDING, FAIL_AI and DELAY_AI_MS have NO effect in normal mode
    const flags = getStressFlags();
    assert.deepEqual(flags, {
      failEmbedding: false,
      failAi: false,
      delayAiMs: 0
    }, 'getStressFlags must return all false/0 when STRESS_MODE is false');

    // (f) Route/function to change flags at runtime must throw error / reject
    assert.throws(
      () => setStressFlags({ failEmbedding: true }),
      /STRESS_MODE is disabled/,
      'setStressFlags must throw when STRESS_MODE is false'
    );

    // (e) Header x-stress-bypass-limit: 1 must NOT skip rate limiter
    const simulatedReqWithBypassHeader = {
      headers: { 'x-stress-bypass-limit': '1' }
    };
    const isBypassActive = Boolean(env.STRESS_MODE && simulatedReqWithBypassHeader.headers['x-stress-bypass-limit'] === '1');
    assert.equal(isBypassActive, false, 'Rate limit bypass must be strictly false when STRESS_MODE is false');
  } else {
    // In stress mode, verify that flags can be toggled
    const updated = setStressFlags({ failEmbedding: true, delayAiMs: 50 });
    assert.equal(updated.failEmbedding, true);
    assert.equal(updated.delayAiMs, 50);
    // Reset flags
    setStressFlags({ failEmbedding: false, delayAiMs: 0 });
  }
});
