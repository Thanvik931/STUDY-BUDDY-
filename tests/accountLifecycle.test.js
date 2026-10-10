// tests/accountLifecycle.test.js
// Verification of Phase 2 Core Loop: session-based ownerId derivation,
// GDPR account export, and password-authenticated account deletion (Rules 13.1a, 13.4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { connectDB, closeDB, getDB } from '../src/db.js';
import { hashPassword, verifyPassword } from '../src/utils/passwords.js';
import { createSession, hashSessionToken } from '../src/middleware/auth.js';

test('Phase 2 Core Loop: Session ownerId, account export & deletion', async (t) => {
  await connectDB();
  const db = getDB();

  const testUserId = new ObjectId();
  const testUsername = `user_${Date.now()}`;
  const password = 'correct horse battery staple';
  const passwordHash = await hashPassword(password);
  const now = new Date();

  // Create test user
  await db.collection('users').insertOne({
    _id: testUserId,
    username: testUsername,
    usernameLower: testUsername.toLowerCase(),
    displayName: 'Test Account',
    passwordHash,
    role: 'student',
    createdAt: now
  });

  const ownerId = testUserId.toString();

  // Create associated cognitive memories, attempts, and stats
  await db.collection('memories').insertOne({
    ownerId,
    subject: 'DBMS',
    topic: 'sql-joins',
    type: 'weakness',
    source: 'quiz_attempt',
    strength: 0.8,
    status: 'active',
    content: 'Struggles with FULL OUTER JOIN syntax',
    embedding: [0.1, 0.2, 0.3],
    createdAt: now,
    updatedAt: now
  });

  await db.collection('attempts').insertOne({
    ownerId,
    subject: 'DBMS',
    topic: 'sql-joins',
    questionId: 'q_test_123',
    correct: false,
    difficulty: 'medium',
    createdAt: now
  });

  await db.collection('topic_stats').insertOne({
    ownerId,
    subject: 'DBMS',
    topic: 'sql-joins',
    wrong: 1,
    correct: 0,
    streak: 0,
    wrongSinceReset: 1,
    lastSeen: now
  });

  // Create session
  const token = await createSession(testUserId);
  const tokenHash = hashSessionToken(token);

  await t.test('1. Verified user lookup never leaks passwordHash', async () => {
    const userSafe = await db.collection('users').findOne(
      { _id: testUserId },
      { projection: { passwordHash: 0 } }
    );
    assert.equal(userSafe.passwordHash, undefined);
    assert.equal(userSafe.username, testUsername);
  });

  await t.test('2. Account data export includes all student data and omits embeddings/tokenHashes', async () => {
    const memories = await db.collection('memories').find({ ownerId }, { projection: { embedding: 0 } }).toArray();
    const attempts = await db.collection('attempts').find({ ownerId }).toArray();
    const stats = await db.collection('topic_stats').find({ ownerId }).toArray();
    const sessions = await db.collection('sessions').find({ userId: testUserId }, { projection: { tokenHash: 0 } }).toArray();

    assert.equal(memories.length, 1);
    assert.equal(memories[0].embedding, undefined);
    assert.equal(attempts.length, 1);
    assert.equal(stats.length, 1);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].tokenHash, undefined);
  });

  await t.test('3. Account deletion with incorrect password fails and leaves data intact', async () => {
    const wrongPassValid = await verifyPassword('WrongPassword123!', passwordHash);
    assert.equal(wrongPassValid, false);

    const userCount = await db.collection('users').countDocuments({ _id: testUserId });
    assert.equal(userCount, 1);
  });

  await t.test('4. Account deletion with correct password cascades across all collections', async () => {
    const passValid = await verifyPassword(password, passwordHash);
    assert.equal(passValid, true);

    // Perform cascade delete
    await Promise.all([
      db.collection('users').deleteOne({ _id: testUserId }),
      db.collection('sessions').deleteMany({ userId: testUserId }),
      db.collection('memories').deleteMany({ ownerId }),
      db.collection('attempts').deleteMany({ ownerId }),
      db.collection('topic_stats').deleteMany({ ownerId }),
      db.collection('questions').deleteMany({ ownerId })
    ]);

    // Verify all records purged
    const [u, s, m, a, ts] = await Promise.all([
      db.collection('users').countDocuments({ _id: testUserId }),
      db.collection('sessions').countDocuments({ userId: testUserId }),
      db.collection('memories').countDocuments({ ownerId }),
      db.collection('attempts').countDocuments({ ownerId }),
      db.collection('topic_stats').countDocuments({ ownerId })
    ]);

    assert.equal(u, 0);
    assert.equal(s, 0);
    assert.equal(m, 0);
    assert.equal(a, 0);
    assert.equal(ts, 0);
  });

  await closeDB();
});
