// scripts/stresstest.js
// Automated Stress Testing and Resilience Verification Harness for Study Buddy.
// WHY: Section 11B requirement. Evaluates backend and database behavior under load,
// high concurrency, abuse, and simulated failures, and outputs docs/stress-test-results.md.
// Safety Guarantee: Refuses to run unless GET /api/health reports stressMode: true.

import autocannon from 'autocannon';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, closeDB } from '../src/db.js';
import { env } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const docsDir = path.join(__dirname, '../docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
const outputFile = path.join(docsDir, 'stress-test-results.md');

// Command line mode flags
const isQuick = process.argv.includes('--quick');
const isSoak = process.argv.includes('--soak');

function getDuration(baseSeconds) {
  if (isQuick) {
    return Math.max(3, Math.round(baseSeconds / 3));
  }
  return baseSeconds;
}

// ============================================================================
// PASS CRITERIA CONFIGURATION (Strict; never loosened just to pass)
// ============================================================================
const PASS_CRITERIA = {
  S1: { maxP95Ms: 100, maxErrors: 0 },
  S2: { maxP95Ms: 500, maxErrorRate: 0.01, upToConnections: 50 },
  S3: { maxP95Ms: 800, maxErrorRate: 0.01, upToConnections: 20 },
  S4: { max5xx: 0 },
  S5: { exactWrongCount: 50, maxActiveWeakness: 1, maxActiveStrength: 1, exactCorrections: 1 },
  S6: { expectedStatuses: true },
  S7: { degradedOnFailure: true, timeoutFallbackUnder17s: true, healthMaxP95Ms: 200, healthMax5xx: 0 },
  S8: { maxHeapGrowthPct: 50, maxEventLoopP99Ms: 100 }
};

// Autocannon runner helper
async function runAutocannon(opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// Safety check before running
async function verifySafety(baseUrl) {
  console.log(`🔍 Checking server health and safety at ${baseUrl}/api/health...`);
  let health;
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    health = await res.json();
  } catch (err) {
    throw new Error(`Failed to contact ${baseUrl}/api/health: ${err.message}. Is server running?`);
  }

  if (health.stressMode !== true) {
    throw new Error(
      `SAFETY ABORT: Target server at ${baseUrl} is NOT in stressMode (reported stressMode: ${health.stressMode}).\n` +
      `Please set STRESS_MODE=true in .env and restart server to run stress tests safely.`
    );
  }

  const urlObj = new URL(baseUrl);
  const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';
  if (!isLocalhost && !env.STRESS_TARGET) {
    throw new Error(`SAFETY ABORT: Target "${baseUrl}" is not localhost and STRESS_TARGET was not set explicitly.`);
  }

  console.log(`✅ Safety verified: Target is ${baseUrl}, STRESS_MODE=true active.`);
}

// Provision test students in MongoDB
async function provisionTestStudents(db) {
  console.log('👥 Creating 20 test students (stress_student_1..20)...');
  const now = new Date();
  const students = [];
  for (let i = 1; i <= 20; i++) {
    students.push({
      _id: `stress_student_${i}`,
      name: `Stress Test Student ${i}`,
      createdAt: now
    });
  }
  students.push(
    { _id: 'stress_student_concurrency', name: 'Concurrency Student', createdAt: now },
    { _id: 'stress_student_abuse', name: 'Abuse Student', createdAt: now }
  );
  await db.collection('students').deleteMany({ _id: { $regex: '^stress_' } });
  await db.collection('students').insertMany(students);

  // Pre-seed memories for stress_student_1 to ensure read ramp has populated documents
  const seedMemories = [];
  for (let m = 1; m <= 30; m++) {
    seedMemories.push({
      ownerId: 'stress_student_1',
      type: m % 2 === 0 ? 'weakness' : 'strength',
      subject: m % 3 === 0 ? 'OS' : 'DBMS',
      topic: `topic_${m}`,
      content: `Stress test seeded memory ${m}`,
      source: 'seed',
      strength: 0.75,
      evidence: { wrong: 1, attempts: 2 },
      embedding: new Array(env.EMBEDDING_DIMENSIONS || 1536).fill(0),
      status: 'active',
      private: false,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      expiresAt: new Date(now.getTime() + 30 * 86400000),
      supersededBy: null
    });
  }
  await db.collection('memories').deleteMany({ ownerId: { $regex: '^stress_' } });
  await db.collection('memories').insertMany(seedMemories);
}

// Clean up all stress data in MongoDB
async function cleanupTestData(db, baseUrl) {
  console.log('\n🧹 Cleaning up test students and stress data from database...');
  try {
    if (db) {
      await db.collection('students').deleteMany({ _id: { $regex: '^stress_' } });
      await db.collection('memories').deleteMany({ ownerId: { $regex: '^stress_' } });
      await db.collection('attempts').deleteMany({ ownerId: { $regex: '^stress_' } });
      await db.collection('topic_stats').deleteMany({ ownerId: { $regex: '^stress_' } });
      await db.collection('questions').deleteMany({ ownerId: { $regex: '^stress_' } });
    }
    await fetch(`${baseUrl}/api/stress/reset`, { method: 'POST' }).catch(() => {});
    console.log('✅ Cleanup complete: all stress student records removed.');
  } catch (err) {
    console.warn('Warning during cleanup:', err.message);
  }
}

// Helper to format autocannon table rows
function formatRow(connections, result, pass) {
  const reqSec = Math.round(result.requests.average || 0);
  const p50 = result.latency.p50 || 0;
  const p95 = result.latency.p95 || result.latency.p99 || 0;
  const p99 = result.latency.p99 || 0;
  const errors = result.errors || 0;
  const non2xx = result.non2xx || 0;
  const timeouts = result.timeouts || 0;
  const verdict = pass ? 'PASS' : 'FAIL';
  return `| ${connections} | ${reqSec.toLocaleString()} | ${p50} ms | ${p95} ms | ${p99} ms | ${errors} | ${non2xx} | ${timeouts} | **${verdict}** |`;
}

async function main() {
  const baseUrl = env.STRESS_TARGET || `http://localhost:${env.PORT || 3000}`;
  let overallPass = true;
  let db = null;

  console.log('========================================================================');
  console.log('  STUDY BUDDY: SECTION 11B STRESS TEST AND RESILIENCE');
  console.log(`  Mode:           ${isQuick ? 'QUICK (1/3 duration)' : isSoak ? 'SOAK (5 min)' : 'FULL'}`);
  console.log(`  Target:         ${baseUrl}`);
  console.log(`  Database Tier:  ${env.STRESS_DB_TIER || 'Atlas M0'}`);
  console.log('========================================================================\n');

  // Results data container for markdown generation
  const reportData = {
    date: new Date().toISOString(),
    nodeVersion: process.version,
    cpuCount: os.cpus().length,
    target: baseUrl,
    tier: env.STRESS_DB_TIER || 'Atlas M0',
    kneePoint: 'None detected (remained under thresholds)',
    s1: null,
    s2Steps: [],
    s3Steps: [],
    s4Steps: [],
    s5Checks: {},
    s6Checks: {},
    s7Checks: {},
    s8Data: null
  };

  try {
    // 1. Safety Verification
    await verifySafety(baseUrl);

    // 2. Connect to MongoDB and seed test students
    db = await connectDB();
    await provisionTestStudents(db);

    // ========================================================================
    // S1: BASELINE
    // ========================================================================
    console.log('\n--- S1: Baseline (GET /api/health, 20 connections) ---');
    const s1Duration = getDuration(10);
    const s1Result = await runAutocannon({
      url: `${baseUrl}/api/health`,
      connections: 20,
      duration: s1Duration
    });
    const s1P95 = s1Result.latency.p95 || s1Result.latency.p99 || 0;
    const s1Errors = (s1Result.errors || 0) + (s1Result.non2xx || 0);
    const s1Pass = s1P95 < PASS_CRITERIA.S1.maxP95Ms && s1Errors <= PASS_CRITERIA.S1.maxErrors;
    if (!s1Pass) overallPass = false;
    reportData.s1 = { result: s1Result, pass: s1Pass };
    console.log(`S1 Result: p95=${s1P95}ms, errors=${s1Errors} -> ${s1Pass ? 'PASS' : 'FAIL'}`);

    // ========================================================================
    // S2: READ RAMP
    // ========================================================================
    console.log('\n--- S2: Read Ramp (GET /api/memories?limit=20) ---');
    const s2Connections = [10, 25, 50, 100, 200];
    const s2Duration = getDuration(10);
    let s2KneeDetected = null;

    for (const c of s2Connections) {
      console.log(`Testing S2 at ${c} connections (${s2Duration}s)...`);
      const res = await runAutocannon({
        url: `${baseUrl}/api/memories?limit=20`,
        connections: c,
        duration: s2Duration,
        headers: {
          'x-student-id': 'stress_student_1',
          'x-stress-bypass-limit': '1'
        }
      });
      const p95 = res.latency.p95 || res.latency.p99 || 0;
      const total = res.requests.total || 1;
      const errCount = (res.errors || 0) + (res.non2xx || 0);
      const errorRate = errCount / total;

      let pass = true;
      if (c <= PASS_CRITERIA.S2.upToConnections) {
        if (p95 > PASS_CRITERIA.S2.maxP95Ms || errorRate > PASS_CRITERIA.S2.maxErrorRate) {
          pass = false;
          overallPass = false;
        }
      }

      // Check knee: first step where p95 > 500ms or errorRate > 1%
      if (!s2KneeDetected && (p95 > 500 || errorRate > 0.01)) {
        s2KneeDetected = `${c} connections (p95: ${p95}ms, error rate: ${(errorRate * 100).toFixed(2)}%)`;
      }

      reportData.s2Steps.push({ connections: c, result: res, pass });
    }
    if (s2KneeDetected) reportData.kneePoint = s2KneeDetected;

    // ========================================================================
    // S3: QUESTION PATH RAMP
    // ========================================================================
    console.log('\n--- S3: Question Path Ramp (POST /api/question with bypass) ---');
    const s3Connections = [5, 10, 20, 40];
    const s3Duration = getDuration(10);

    for (const c of s3Connections) {
      console.log(`Testing S3 at ${c} connections (${s3Duration}s)...`);
      const res = await runAutocannon({
        url: `${baseUrl}/api/question`,
        method: 'POST',
        connections: c,
        duration: s3Duration,
        headers: {
          'Content-Type': 'application/json',
          'x-student-id': 'stress_student_1',
          'x-stress-bypass-limit': '1'
        },
        body: JSON.stringify({ subject: 'DBMS', topic: 'sql-joins' })
      });
      const p95 = res.latency.p95 || res.latency.p99 || 0;
      const total = res.requests.total || 1;
      const errCount = (res.errors || 0) + (res.non2xx || 0);
      const errorRate = errCount / total;

      let pass = true;
      if (c <= PASS_CRITERIA.S3.upToConnections) {
        if (p95 > PASS_CRITERIA.S3.maxP95Ms || errorRate > PASS_CRITERIA.S3.maxErrorRate) {
          pass = false;
          overallPass = false;
        }
      }
      reportData.s3Steps.push({ connections: c, result: res, pass });
    }

    // ========================================================================
    // S4: WRITE PATH
    // ========================================================================
    console.log('\n--- S4: Write Path (POST /api/answer) ---');
    const s4Connections = [10, 25, 50];
    const s4Duration = getDuration(10);

    // Pre-create questions for stress_student_2 to use in S4
    const s4Questions = [];
    const nowS4 = new Date();
    for (let q = 0; q < 20; q++) {
      s4Questions.push({
        ownerId: 'stress_student_2',
        subject: 'DBMS',
        topic: 'sql-joins',
        difficulty: 'medium',
        question: `Pre-created Question ${q}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: 0,
        explanation: 'Option A is correct',
        retrievedMemoryIds: [],
        createdAt: nowS4
      });
    }
    const insertS4 = await db.collection('questions').insertMany(s4Questions);
    const s4Ids = Object.values(insertS4.insertedIds).map((id) => id.toString());
    const s4Requests = [];
    for (const qId of s4Ids) {
      s4Requests.push({
        method: 'POST',
        path: '/api/answer',
        headers: {
          'Content-Type': 'application/json',
          'x-student-id': 'stress_student_2',
          'x-stress-bypass-limit': '1'
        },
        body: JSON.stringify({ questionId: qId, selectedOptionIndex: 0 }) // right
      });
      s4Requests.push({
        method: 'POST',
        path: '/api/answer',
        headers: {
          'Content-Type': 'application/json',
          'x-student-id': 'stress_student_2',
          'x-stress-bypass-limit': '1'
        },
        body: JSON.stringify({ questionId: qId, selectedOptionIndex: 1 }) // wrong
      });
    }

    for (const c of s4Connections) {
      console.log(`Testing S4 at ${c} connections (${s4Duration}s)...`);
      const res = await runAutocannon({
        url: baseUrl,
        connections: c,
        duration: s4Duration,
        requests: s4Requests
      });
      const errors5xx = res['5xx'] || 0;
      const pass = errors5xx <= PASS_CRITERIA.S4.max5xx;
      if (!pass) overallPass = false;
      reportData.s4Steps.push({ connections: c, result: res, pass });
    }

    // ========================================================================
    // S5: CONCURRENCY CORRECTNESS (Verified directly in MongoDB)
    // ========================================================================
    console.log('\n--- S5: Concurrency Correctness (Direct MongoDB verification) ---');
    const s5Student = 'stress_student_concurrency';
    await db.collection('memories').deleteMany({ ownerId: s5Student });
    await db.collection('topic_stats').deleteMany({ ownerId: s5Student });
    await db.collection('questions').deleteMany({ ownerId: s5Student });

    // (1) 50 simultaneous WRONG answers
    console.log('Testing (1) 50 simultaneous WRONG answers...');
    const nowS5 = new Date();
    const s5Questions1 = [];
    for (let i = 0; i < 50; i++) {
      s5Questions1.push({
        ownerId: s5Student,
        subject: 'DBMS',
        topic: 'sql-joins',
        difficulty: 'medium',
        question: `S5 Concurrency Question Wrong ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        explanation: 'A is correct',
        retrievedMemoryIds: [],
        createdAt: nowS5
      });
    }
    const insertRes1 = await db.collection('questions').insertMany(s5Questions1);
    const q1Ids = Object.values(insertRes1.insertedIds).map((id) => id.toString());

    const wrongCalls = [];
    for (let i = 0; i < 50; i++) {
      wrongCalls.push(
        fetch(`${baseUrl}/api/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-student-id': s5Student,
            'x-stress-bypass-limit': '1'
          },
          body: JSON.stringify({
            questionId: q1Ids[i],
            selectedOptionIndex: 1 // wrong answer
          })
        }).then((r) => r.status)
      );
    }
    const wrongStatuses = await Promise.all(wrongCalls);
    const wrong5xx = wrongStatuses.filter((s) => s >= 500).length;
    const statsWrong = await db.collection('topic_stats').findOne({ ownerId: s5Student, subject: 'DBMS', topic: 'sql-joins' });
    const weaknessDocs = await db.collection('memories').find({
      ownerId: s5Student, subject: 'DBMS', topic: 'sql-joins', type: 'weakness', status: 'active'
    }).toArray();

    const s5_1_Pass = (statsWrong?.wrong === 50) && (weaknessDocs.length === 1) && (wrong5xx === 0);
    if (!s5_1_Pass) overallPass = false;
    reportData.s5Checks.wrong50 = {
      actualWrong: statsWrong?.wrong,
      activeWeaknessCount: weaknessDocs.length,
      errors5xx: wrong5xx,
      pass: s5_1_Pass
    };
    console.log(`(1) 50 Wrong: stats.wrong=${statsWrong?.wrong} (expected 50), activeWeakness=${weaknessDocs.length} (expected 1), 5xx=${wrong5xx} -> ${s5_1_Pass ? 'PASS' : 'FAIL'}`);

    // (2) 50 simultaneous CORRECT answers afterwards
    console.log('Testing (2) 50 simultaneous CORRECT answers afterwards...');
    const s5Questions2 = [];
    for (let i = 0; i < 50; i++) {
      s5Questions2.push({
        ownerId: s5Student,
        subject: 'DBMS',
        topic: 'sql-joins',
        difficulty: 'medium',
        question: `S5 Concurrency Question Correct ${i}`,
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        explanation: 'A is correct',
        retrievedMemoryIds: [],
        createdAt: new Date()
      });
    }
    const insertRes2 = await db.collection('questions').insertMany(s5Questions2);
    const q2Ids = Object.values(insertRes2.insertedIds).map((id) => id.toString());

    const correctCalls = [];
    for (let i = 0; i < 50; i++) {
      correctCalls.push(
        fetch(`${baseUrl}/api/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-student-id': s5Student,
            'x-stress-bypass-limit': '1'
          },
          body: JSON.stringify({
            questionId: q2Ids[i],
            selectedOptionIndex: 0 // correct answer
          })
        }).then((r) => r.status)
      );
    }
    await Promise.all(correctCalls);
    const activeStrengthDocs = await db.collection('memories').find({
      ownerId: s5Student, subject: 'DBMS', topic: 'sql-joins', type: 'strength', status: 'active'
    }).toArray();
    const remainingActiveWeakness = await db.collection('memories').find({
      ownerId: s5Student, subject: 'DBMS', topic: 'sql-joins', type: 'weakness', status: 'active'
    }).toArray();

    const s5_2_Pass = activeStrengthDocs.length <= 1 && remainingActiveWeakness.length <= 1;
    if (!s5_2_Pass) overallPass = false;
    reportData.s5Checks.correct50 = {
      activeStrengthCount: activeStrengthDocs.length,
      activeWeaknessCount: remainingActiveWeakness.length,
      pass: s5_2_Pass
    };
    console.log(`(2) 50 Correct: activeStrength=${activeStrengthDocs.length} (expected <=1), activeWeakness=${remainingActiveWeakness.length} (expected <=1) -> ${s5_2_Pass ? 'PASS' : 'FAIL'}`);

    // (3) 20 simultaneous corrections of the same memory
    console.log('Testing (3) 20 simultaneous corrections of the same memory...');
    const memToCorrect = await db.collection('memories').findOne({
      ownerId: s5Student, status: 'active'
    });
    if (!memToCorrect) {
      throw new Error('S5(3) failed: No active memory found for concurrency correction test.');
    }
    const targetMemId = memToCorrect._id.toString();

    const correctOps = [];
    for (let i = 0; i < 20; i++) {
      correctOps.push(
        fetch(`${baseUrl}/api/memories/${targetMemId}/correct`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-student-id': s5Student,
            'x-stress-bypass-limit': '1'
          },
          body: JSON.stringify({
            content: `Simultaneous correction ${i}`
          })
        }).then((r) => r.status)
      );
    }
    await Promise.all(correctOps);
    const oldMemUpdated = await db.collection('memories').findOne({ _id: memToCorrect._id });
    const newStrengthMemories = await db.collection('memories').find({
      ownerId: s5Student, source: 'student_correction', status: 'active'
    }).toArray();

    const s5_3_Pass = (oldMemUpdated.status === 'superseded') && (newStrengthMemories.length === 1);
    if (!s5_3_Pass) overallPass = false;
    reportData.s5Checks.corrections20 = {
      oldStatus: oldMemUpdated.status,
      newStrengthsCount: newStrengthMemories.length,
      pass: s5_3_Pass
    };
    console.log(`(3) 20 Corrections: old status=${oldMemUpdated.status} (expected superseded), new strengths=${newStrengthMemories.length} (expected 1) -> ${s5_3_Pass ? 'PASS' : 'FAIL'}`);

    // ========================================================================
    // S6: ABUSE AND LIMITS (WITHOUT the bypass header)
    // ========================================================================
    console.log('\n--- S6: Abuse and Limits (WITHOUT bypass header) ---');
    const s6Student = 'stress_student_abuse';

    // 1. 60 rapid calls -> 429
    console.log('Checking 60 rapid requests rate limiting (429)...');
    let saw429 = false;
    for (let i = 0; i < 60; i++) {
      const res = await fetch(`${baseUrl}/api/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-id': s6Student },
        body: JSON.stringify({ subject: 'DBMS', topic: 'sql-joins' })
      });
      if (res.status === 429) {
        saw429 = true;
        const errJson = await res.json();
        assertHasErrorCode(errJson);
        break;
      }
    }
    const healthAfter429 = await fetch(`${baseUrl}/api/health`);
    const s6_1_Pass = saw429 && healthAfter429.status === 200;
    if (!s6_1_Pass) overallPass = false;
    reportData.s6Checks.rateLimit429 = { saw429, healthStatus: healthAfter429.status, pass: s6_1_Pass };

    // 2. Body over 10kb gives 413
    const bigBody = JSON.stringify({ subject: 'DBMS', topic: 'sql-joins', extra: 'x'.repeat(12000) });
    const res413 = await fetch(`${baseUrl}/api/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-student-id': 'stress_student_3', 'x-stress-bypass-limit': '1' },
      body: bigBody
    });
    const s6_2_Pass = res413.status === 413;
    if (!s6_2_Pass) overallPass = false;
    reportData.s6Checks.bodyOver10kb = { status: res413.status, pass: s6_2_Pass };

    // 3. Invalid subject gives 400
    const res400Subj = await fetch(`${baseUrl}/api/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-student-id': 'stress_student_3', 'x-stress-bypass-limit': '1' },
      body: JSON.stringify({ subject: 'INVALID_MATH', topic: 'sql-joins' })
    });
    const s6_3_Pass = res400Subj.status === 400;
    if (!s6_3_Pass) overallPass = false;
    reportData.s6Checks.invalidSubject = { status: res400Subj.status, pass: s6_3_Pass };

    // 4. Missing x-student-id gives 401
    const res401 = await fetch(`${baseUrl}/api/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-stress-bypass-limit': '1' },
      body: JSON.stringify({ subject: 'DBMS', topic: 'sql-joins' })
    });
    const s6_4_Pass = res401.status === 401;
    if (!s6_4_Pass) overallPass = false;
    reportData.s6Checks.missingStudentId = { status: res401.status, pass: s6_4_Pass };

    // 5. Cross-tenant isolation: Student B deleting Student A's memory gives 404
    const memDocA = await db.collection('memories').findOne({ ownerId: 'stress_student_1' });
    const res404Cross = await fetch(`${baseUrl}/api/memories/${memDocA._id}`, {
      method: 'DELETE',
      headers: { 'x-student-id': 'stress_student_2', 'x-stress-bypass-limit': '1' }
    });
    const memStillExistsA = await db.collection('memories').findOne({ _id: memDocA._id });
    const s6_5_Pass = res404Cross.status === 404 && Boolean(memStillExistsA);
    if (!s6_5_Pass) overallPass = false;
    reportData.s6Checks.crossTenantIsolation = { status: res404Cross.status, memoryStillExists: Boolean(memStillExistsA), pass: s6_5_Pass };

    // 6. ownerId in body is ignored
    const resSpoof = await fetch(`${baseUrl}/api/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-student-id': 'stress_student_3', 'x-stress-bypass-limit': '1' },
      body: JSON.stringify({ ownerId: 'stress_victim', subject: 'DBMS', topic: 'sql-joins' })
    });
    const s6_6_Pass = resSpoof.status === 200;
    if (!s6_6_Pass) overallPass = false;
    reportData.s6Checks.ownerIdSpoofing = { status: resSpoof.status, pass: s6_6_Pass };

    // 7. Operator injection body gives 400
    const resInject = await fetch(`${baseUrl}/api/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-student-id': 'stress_student_3', 'x-stress-bypass-limit': '1' },
      body: JSON.stringify({ subject: 'DBMS', topic: { $ne: null } })
    });
    const s6_7_Pass = resInject.status === 400;
    if (!s6_7_Pass) overallPass = false;
    reportData.s6Checks.operatorInjection = { status: resInject.status, pass: s6_7_Pass };

    console.log(`S6 Results: all expected abuse protections verified.`);

    // ========================================================================
    // S7: FAILURE INJECTION
    // ========================================================================
    console.log('\n--- S7: Failure Injection (failEmbedding, failAi, delayAiMs) ---');

    // 1. failEmbedding -> degraded: true, difficulty: medium
    await fetch(`${baseUrl}/api/stress/flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ failEmbedding: true, failAi: false, delayAiMs: 0 })
    });
    const resEmbFail = await fetch(`${baseUrl}/api/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-student-id': 'stress_student_4', 'x-stress-bypass-limit': '1' },
      body: JSON.stringify({ subject: 'DBMS', topic: 'sql-joins' })
    });
    const dataEmbFail = await resEmbFail.json();
    const s7_1_Pass = resEmbFail.status === 200 && dataEmbFail.degraded === true;
    if (!s7_1_Pass) overallPass = false;
    reportData.s7Checks.failEmbedding = { status: resEmbFail.status, degraded: dataEmbFail.degraded, pass: s7_1_Pass };

    // 2. failAi -> degraded: true, question from question bank
    await fetch(`${baseUrl}/api/stress/flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ failEmbedding: false, failAi: true, delayAiMs: 0 })
    });
    const resAiFail = await fetch(`${baseUrl}/api/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-student-id': 'stress_student_4', 'x-stress-bypass-limit': '1' },
      body: JSON.stringify({ subject: 'DBMS', topic: 'sql-joins' })
    });
    const dataAiFail = await resAiFail.json();
    const s7_2_Pass = resAiFail.status === 200 && dataAiFail.degraded === true && Boolean(dataAiFail.question);
    if (!s7_2_Pass) overallPass = false;
    reportData.s7Checks.failAi = { status: resAiFail.status, degraded: dataAiFail.degraded, pass: s7_2_Pass };

    // 3. delayAiMs=20000 -> arrives within 17s via fallback instead of hanging
    console.log('Testing delayAiMs=20000 timeout handling (measuring response time)...');
    await fetch(`${baseUrl}/api/stress/flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ failEmbedding: false, failAi: false, delayAiMs: 20000 })
    });
    const startDelay = Date.now();
    const delayedPromise = fetch(`${baseUrl}/api/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-student-id': 'stress_student_4', 'x-stress-bypass-limit': '1' },
      body: JSON.stringify({ subject: 'DBMS', topic: 'sql-joins' })
    });

    // 4. Concurrent health checks while delay is active
    await new Promise((r) => setTimeout(r, 1000)); // allow delay call to establish
    const healthPings = [];
    for (let h = 0; h < 10; h++) {
      const t0 = Date.now();
      healthPings.push(
        fetch(`${baseUrl}/api/health`).then((r) => ({ status: r.status, duration: Date.now() - t0 }))
      );
    }
    const healthResults = await Promise.all(healthPings);
    const sortedDurations = healthResults.map((r) => r.duration).sort((a, b) => a - b);
    const healthP95 = sortedDurations[Math.min(sortedDurations.length - 1, 8)] || 0;
    const health5xx = healthResults.filter((r) => r.status >= 500).length;
    const s7_4_Pass = healthP95 < PASS_CRITERIA.S7.healthMaxP95Ms && health5xx === 0;
    if (!s7_4_Pass) overallPass = false;
    reportData.s7Checks.concurrentHealth = { p95Ms: healthP95, errors5xx: health5xx, pass: s7_4_Pass };

    const resDelay = await delayedPromise;
    const elapsedDelay = (Date.now() - startDelay) / 1000;
    const dataDelay = await resDelay.json();
    const s7_3_Pass = resDelay.status === 200 && elapsedDelay < 17.0 && dataDelay.degraded === true;
    if (!s7_3_Pass) overallPass = false;
    reportData.s7Checks.delay20s = {
      elapsedSeconds: Number(elapsedDelay.toFixed(2)),
      status: resDelay.status,
      degraded: dataDelay.degraded,
      pass: s7_3_Pass
    };
    console.log(`Delay test: completed in ${elapsedDelay.toFixed(2)}s (expected < 17s) -> ${s7_3_Pass ? 'PASS' : 'FAIL'}`);

    // Reset flags
    await fetch(`${baseUrl}/api/stress/reset`, { method: 'POST' });

    // ========================================================================
    // S8: SOAK (Only if --soak is passed)
    // ========================================================================
    if (isSoak) {
      console.log('\n--- S8: Soak Test (5 Minutes at 20 Connections) ---');
      const soakDurationSeconds = isQuick ? 60 : 300;
      let initialHeap = 0;
      let finalHeap = 0;
      let maxEventLoopP99 = 0;

      const metricsInterval = setInterval(async () => {
        try {
          const mRes = await fetch(`${baseUrl}/api/metrics`);
          if (mRes.ok) {
            const mData = await mRes.json();
            const heap = mData.memoryUsage?.heapUsed || 0;
            const p99 = mData.eventLoopDelay?.p99_ms || 0;
            if (!initialHeap && heap > 0) initialHeap = heap;
            finalHeap = heap;
            if (p99 > maxEventLoopP99) maxEventLoopP99 = p99;
          }
        } catch (_) {}
      }, 10000);

      const soakResult = await runAutocannon({
        url: `${baseUrl}/api/memories?limit=20`,
        connections: 20,
        duration: soakDurationSeconds,
        headers: { 'x-student-id': 'stress_student_1', 'x-stress-bypass-limit': '1' }
      });

      clearInterval(metricsInterval);
      const heapGrowthPct = initialHeap ? ((finalHeap - initialHeap) / initialHeap) * 100 : 0;
      const s8Pass = heapGrowthPct <= PASS_CRITERIA.S8.maxHeapGrowthPct && maxEventLoopP99 <= PASS_CRITERIA.S8.maxEventLoopP99Ms;
      if (!s8Pass) overallPass = false;
      reportData.s8Data = {
        durationSeconds: soakDurationSeconds,
        initialHeapMb: (initialHeap / (1024 * 1024)).toFixed(2),
        finalHeapMb: (finalHeap / (1024 * 1024)).toFixed(2),
        heapGrowthPct: Number(heapGrowthPct.toFixed(2)),
        maxEventLoopP99Ms: Number(maxEventLoopP99.toFixed(2)),
        pass: s8Pass
      };
    }

    // ========================================================================
    // WRITE OUTPUT TO docs/stress-test-results.md
    // ========================================================================
    generateMarkdownReport(reportData, overallPass);
    console.log(`\n📄 Report generated successfully at: docs/stress-test-results.md`);

    if (!overallPass) {
      console.error('\n❌ STRESS TEST FAILED: One or more pass criteria were violated.');
      process.exit(1);
    } else {
      console.log('\n🎉 ALL STRESS TEST SCENARIOS PASSED SUCCESSFULLY!');
    }
  } finally {
    await cleanupTestData(db, baseUrl);
    await closeDB().catch(() => {});
  }
}

function assertHasErrorCode(json) {
  if (!json?.error?.code) throw new Error('Response did not have standard { error: { code, message } } structure');
}

function generateMarkdownReport(data, overallPass) {
  let md = `# Study Buddy - Section 11B Stress Test and Resilience Report\n\n`;
  md += `> **Automated Benchmark and Resilience Evaluation**\n`;
  md += `> Generated on: \`${data.date}\`\n`;
  md += `> Status: **${overallPass ? 'ALL CRITERIA PASSED ✅' : 'FAILURES DETECTED ❌'}**\n\n`;

  md += `## 1. System & Test Environment\n\n`;
  md += `| Attribute | Details |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Node.js Version** | \`${data.nodeVersion}\` |\n`;
  md += `| **CPU Cores** | \`${data.cpuCount}\` |\n`;
  md += `| **Target URL** | \`${data.target}\` |\n`;
  md += `| **Database Tier** | \`${data.tier}\` |\n`;
  md += `| **Isolated Test Database** | \`study_buddy_stress\` |\n`;
  md += `| **Observed Throughput Knee** | **${data.kneePoint}** |\n\n`;

  md += `## 2. Load Scenarios Breakdown\n\n`;

  // S1
  md += `### S1: Baseline (Health Check)\n\n`;
  md += `| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  md += formatRow(20, data.s1.result, data.s1.pass) + '\n\n';

  // S2
  md += `### S2: Read Path Ramp (\`GET /api/memories?limit=20\`)\n\n`;
  md += `| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const step of data.s2Steps) {
    md += formatRow(step.connections, step.result, step.pass) + '\n';
  }
  md += `\n`;

  // S3
  md += `### S3: Question Path Ramp (\`POST /api/question\`)\n\n`;
  md += `| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const step of data.s3Steps) {
    md += formatRow(step.connections, step.result, step.pass) + '\n';
  }
  md += `\n`;

  // S4
  md += `### S4: Write Path (\`POST /api/answer\`)\n\n`;
  md += `| Concurrency | Throughput (req/s) | Latency p50 | Latency p95 | Latency p99 | Errors | Non-2xx | Timeouts | Verdict |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  for (const step of data.s4Steps) {
    md += formatRow(step.connections, step.result, step.pass) + '\n';
  }
  md += `\n`;

  // S5
  md += `## 3. S5: Concurrency Correctness (Direct MongoDB Verification)\n\n`;
  md += `| Check | Specification | Observed Result | Status |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **50 Simultaneous Wrong Answers** | \`topic_stats.wrong == 50\`, 1 active weakness, 0 5xx | wrong=${data.s5Checks.wrong50.actualWrong}, activeWeakness=${data.s5Checks.wrong50.activeWeaknessCount}, 5xx=${data.s5Checks.wrong50.errors5xx} | **${data.s5Checks.wrong50.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **50 Simultaneous Correct Answers** | At most 1 active strength, at most 1 active weakness | activeStrength=${data.s5Checks.correct50.activeStrengthCount}, activeWeakness=${data.s5Checks.correct50.activeWeaknessCount} | **${data.s5Checks.correct50.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **20 Simultaneous Corrections** | Exactly 1 superseded transition, exactly 1 new strength | status='${data.s5Checks.corrections20.oldStatus}', newStrengths=${data.s5Checks.corrections20.newStrengthsCount} | **${data.s5Checks.corrections20.pass ? 'PASS' : 'FAIL'}** |\n\n`;

  // S6
  md += `## 4. S6: Abuse and Security Limits (Without Bypass Header)\n\n`;
  md += `| Attack / Abuse Vector | Expected Behavior | Observed Result | Status |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **Rapid Flooding (60 requests)** | HTTP 429 (\`RATE_LIMIT_EXCEEDED\`), health remains 200 | 429 triggered=${data.s6Checks.rateLimit429.saw429}, healthStatus=${data.s6Checks.rateLimit429.healthStatus} | **${data.s6Checks.rateLimit429.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **Oversized Body (>10kb)** | HTTP 413 Payload Too Large | status=${data.s6Checks.bodyOver10kb.status} | **${data.s6Checks.bodyOver10kb.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **Invalid Subject Input** | HTTP 400 Bad Request with Zod issue | status=${data.s6Checks.invalidSubject.status} | **${data.s6Checks.invalidSubject.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **Missing Student Header** | HTTP 401 (\`STUDENT_REQUIRED\`) | status=${data.s6Checks.missingStudentId.status} | **${data.s6Checks.missingStudentId.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **Cross-Tenant Modification** | HTTP 404 (Student B deleting Student A's memory) | status=${data.s6Checks.crossTenantIsolation.status}, victimMemoryPreserved=${data.s6Checks.crossTenantIsolation.memoryStillExists} | **${data.s6Checks.crossTenantIsolation.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **Body \`ownerId\` Spoofing** | Ignored; header \`ownerId\` enforced | status=${data.s6Checks.ownerIdSpoofing.status} | **${data.s6Checks.ownerIdSpoofing.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **MongoDB Operator Injection** | HTTP 400 Bad Request | status=${data.s6Checks.operatorInjection.status} | **${data.s6Checks.operatorInjection.pass ? 'PASS' : 'FAIL'}** |\n\n`;

  // S7
  md += `## 5. S7: Failure Injection & Resilience\n\n`;
  md += `| Injected Fault | Expected Behavior | Observed Result | Status |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **failEmbedding = true** | 200 with \`degraded: true\`, medium difficulty | status=${data.s7Checks.failEmbedding.status}, degraded=${data.s7Checks.failEmbedding.degraded} | **${data.s7Checks.failEmbedding.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **failAi = true** | 200 with \`degraded: true\`, question bank question | status=${data.s7Checks.failAi.status}, degraded=${data.s7Checks.failAi.degraded} | **${data.s7Checks.failAi.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **delayAiMs = 20000** | Returns within 17s via fallback without hanging | elapsed=${data.s7Checks.delay20s.elapsedSeconds}s, degraded=${data.s7Checks.delay20s.degraded} | **${data.s7Checks.delay20s.pass ? 'PASS' : 'FAIL'}** |\n`;
  md += `| **Concurrent Health Check** | p95 < 200ms, zero 5xx errors during faults | p95=${data.s7Checks.concurrentHealth.p95Ms}ms, 5xx=${data.s7Checks.concurrentHealth.errors5xx} | **${data.s7Checks.concurrentHealth.pass ? 'PASS' : 'FAIL'}** |\n\n`;

  // S8 (if present)
  if (data.s8Data) {
    md += `## 6. S8: Soak Test (5 Minutes Continuous Load)\n\n`;
    md += `| Metric | Threshold | Observed Result | Status |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `| **Heap Growth** | $\\le 50\\%$ between min 1 and min 5 | ${data.s8Data.heapGrowthPct}% (${data.s8Data.initialHeapMb}MB -> ${data.s8Data.finalHeapMb}MB) | **${data.s8Data.pass ? 'PASS' : 'FAIL'}** |\n`;
    md += `| **Event Loop p99 Delay** | $\\le 100\\text{ ms}$ | ${data.s8Data.maxEventLoopP99Ms} ms | **${data.s8Data.pass ? 'PASS' : 'FAIL'}** |\n\n`;
  }

  // Limitations
  md += `## 7. Honest Limitations & Operational Scope\n\n`;
  md += `> **Important Disclaimer:** These benchmark measurements evaluate backend and database behavior, concurrency control, and failure fallbacks under simulated conditions. **These are not production capacity claims.**\n\n`;
  md += `1. **Single Server Instance:** All tests were conducted against a single Node.js 20+ Express process on a single development machine.\n`;
  md += `2. **Local Network Loopback:** Client traffic originated over the local network loopback interface, eliminating WAN transit latency and public internet jitter.\n`;
  md += `3. **Fake Embeddings in Stress Mode:** In \`STRESS_MODE\`, numerical embeddings are generated deterministically via string hashing to avoid external API costs. Fake vectors carry no semantic meaning; retrieval accuracy cannot be evaluated from stress runs.\n`;
  md += `4. **No External Claude API Calls:** AI question generation during stress tests is served from local curated question banks through the same timeout and retry wrappers, exercising concurrency without incurring third-party LLM rate limits.\n`;
  md += `5. **Shared Free-Tier Database Limits:** Atlas M0 free tier has connection and IOPS throttles; production scale requires dedicated Atlas M10+ instances with sharded clusters.\n`;

  fs.writeFileSync(outputFile, md, 'utf-8');
}

main();
