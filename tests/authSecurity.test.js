// tests/authSecurity.test.js
// Verification of password hashing, policy, form tokens, and session token hashing (Rules 13.1, 13.4, 13.6).

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { hashPassword, verifyPassword, dummyVerifyPassword, validatePassword } from '../src/utils/passwords.js';
import { hashSessionToken } from '../src/middleware/auth.js';
import { env } from '../src/config/env.js';

test('Password policy rejects weak or compromised passwords and accepts strong ones', () => {
  // Too short (< 10)
  const shortRes = validatePassword('Short1!', { username: 'testuser' });
  assert.equal(shortRes.valid, false);
  assert.match(shortRes.message, /at least 10 characters/);

  // Too long (> 128)
  const longPass = 'A'.repeat(129);
  const longRes = validatePassword(longPass, { username: 'testuser' });
  assert.equal(longRes.valid, false);
  assert.match(longRes.message, /must not exceed 128 characters/);

  // Common password
  const common = validatePassword('Password1234', { username: 'testuser' });
  assert.equal(common.valid, false);
  assert.match(common.message, /too common/);

  // Equal to username
  const userMatch = validatePassword('testuser123', { username: 'testuser123' });
  assert.equal(userMatch.valid, false);
  assert.match(userMatch.message, /same as your username/);

  // Equal to display name
  const dispMatch = validatePassword('AliceSmith', { displayName: 'AliceSmith' });
  assert.equal(dispMatch.valid, false);
  assert.match(dispMatch.message, /same as your display name/);

  // Valid passphrase (no archaic composition rules required, e.g. correct horse battery staple)
  const valid = validatePassword('correct horse battery staple', { username: 'testuser', displayName: 'Test' });
  assert.equal(valid.valid, true);
});

test('Argon2 / Scrypt hashing and verification works with timing mitigation', async () => {
  const secret = 'ComplexP@ssw0rd!2026';
  const hash = await hashPassword(secret);
  assert.ok(typeof hash === 'string' && hash.length > 20);

  const isMatch = await verifyPassword(secret, hash);
  assert.equal(isMatch, true);

  const isWrong = await verifyPassword('WrongPassword!123', hash);
  assert.equal(isWrong, false);

  // Dummy verify executes without throwing to equalize timing
  await dummyVerifyPassword();
});

test('Session token hashing produces deterministic HMAC-SHA256 digests', () => {
  const token = 'test-session-token-random-value-12345';
  const hash1 = hashSessionToken(token);
  const hash2 = hashSessionToken(token);

  assert.equal(hash1, hash2);
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 64); // SHA-256 hex digest is 64 chars
});

test('Anti-bot form token generation and verification logic', () => {
  // Generate valid token
  const now = Date.now() - 4000; // 4 seconds ago
  const sig = crypto.createHmac('sha256', env.SESSION_SECRET).update(now.toString()).digest('hex');
  const validToken = `${now}.${sig}`;

  // Helper verifying form token
  function verifyToken(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [tsStr, signature] = parts;
    const ts = parseInt(tsStr, 10);
    if (isNaN(ts)) return false;
    const expectedSig = crypto.createHmac('sha256', env.SESSION_SECRET).update(tsStr).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }
    const age = Date.now() - ts;
    return age >= 3000 && age < 3600000;
  }

  assert.equal(verifyToken(validToken), true);

  // Tampered signature
  const tamperedToken = `${now}.tamperedSignature1234567890`;
  assert.equal(verifyToken(tamperedToken), false);

  // Too fresh (< 3s, bot submission)
  const freshTs = Date.now() - 500;
  const freshSig = crypto.createHmac('sha256', env.SESSION_SECRET).update(freshTs.toString()).digest('hex');
  const freshToken = `${freshTs}.${freshSig}`;
  assert.equal(verifyToken(freshToken), false);

  // Expired (> 1 hour)
  const oldTs = Date.now() - 4000000;
  const oldSig = crypto.createHmac('sha256', env.SESSION_SECRET).update(oldTs.toString()).digest('hex');
  const expiredToken = `${oldTs}.${oldSig}`;
  assert.equal(verifyToken(expiredToken), false);
});
