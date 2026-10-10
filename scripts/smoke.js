// scripts/smoke.js
// Automated smoke test running against the live server.
// WHY: Section 11 requirement. Tests the complete lifecycle across all endpoints in order,
// printing clear PASS / FAIL statuses for judges and CI/CD pipelines.

const BASE_URL = 'http://localhost:3000/api';

async function runSmokeTests() {
  console.log('========================================================================');
  console.log('  STUDY BUDDY: END-TO-END SMOKE TEST SUITE');
  console.log(`  Target: ${BASE_URL} | Timestamp: ${new Date().toISOString()}`);
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    process.stdout.write(`• Checking ${name.padEnd(45, '.')} `);
    try {
      await fn();
      console.log('[\x1b[32mPASS\x1b[0m]');
      passed++;
    } catch (err) {
      console.log('[\x1b[31mFAIL\x1b[0m]');
      console.log(`  -> Error: ${err.message}`);
      failed++;
    }
  }

  let studentId = '';
  let questionId = '';
  let memoryId = '';

  // 1. GET /api/health
  await check('1. Health check (GET /api/health)', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok' || data.mongo !== 'ok') throw new Error('MongoDB ping was not ok');
  });

  // 2. POST /api/students
  await check('2. Create student (POST /api/students)', async () => {
    const res = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Test Student' })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    studentId = data.student._id;
    if (!studentId.startsWith('stu_')) throw new Error('Invalid student ID format');
  });

  const studentHeaders = {
    'Content-Type': 'application/json',
    'x-student-id': studentId
  };

  // 3. POST /api/session/start
  await check('3. Start session (POST /api/session/start)', async () => {
    const res = await fetch(`${BASE_URL}/session/start`, {
      method: 'POST',
      headers: studentHeaders
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.opener) throw new Error('Missing session opener');
  });

  // 4. POST /api/question
  await check('4. Fetch question (POST /api/question)', async () => {
    const res = await fetch(`${BASE_URL}/question`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ subject: 'DBMS', topic: 'sql-joins' })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    questionId = data.questionId;
    if (!questionId) throw new Error('Missing questionId');
    if (data.correctIndex !== undefined) throw new Error('Security flaw: correctIndex leaked in response');
  });

  // 5. POST /api/answer (Submit wrong answer 1)
  await check('5. Submit answer 1 (POST /api/answer)', async () => {
    const res = await fetch(`${BASE_URL}/answer`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ questionId, selectedOptionIndex: 3 })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (typeof data.correct !== 'boolean') throw new Error('Missing correctness evaluation');
  });

  // Submit wrong answer 2 to trigger Rule A weakness memory
  await check('6. Submit answer 2 - Rule A Trigger (POST /api/answer)', async () => {
    const qRes = await fetch(`${BASE_URL}/question`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ subject: 'DBMS', topic: 'sql-joins' })
    });
    const qData = await qRes.json();

    const res = await fetch(`${BASE_URL}/answer`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ questionId: qData.questionId, selectedOptionIndex: 3 })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.memoryActions.includes('created_new_weakness')) {
      throw new Error('Rule A did not create weakness memory on 2nd wrong answer');
    }
  });

  // 7. GET /api/memories
  await check('7. Inspect memories (GET /api/memories)', async () => {
    const res = await fetch(`${BASE_URL}/memories`, {
      headers: studentHeaders
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.total === 0) throw new Error('No memories found in MongoDB');
    memoryId = data.memories[0]._id;
  });

  // 8. POST /api/memories/:id/correct
  await check('8. Correct memory (POST /api/memories/:id/correct)', async () => {
    const res = await fetch(`${BASE_URL}/memories/${memoryId}/correct`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ content: 'Student mastered SQL joins concepts' })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.result.newMemoryId) throw new Error('New strength memory was not returned');
  });

  // 9. DELETE /api/memories/:id
  await check('9. Delete memory (DELETE /api/memories/:id)', async () => {
    const res = await fetch(`${BASE_URL}/memories/${memoryId}`, {
      method: 'DELETE',
      headers: studentHeaders
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
  });

  // 10. GET /api/progress
  await check('10. Progress aggregation (GET /api/progress)', async () => {
    const res = await fetch(`${BASE_URL}/progress`, {
      headers: studentHeaders
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.totalAttempts === undefined) throw new Error('Missing totalAttempts in aggregation');
  });

  // 11. GET /api/metrics
  await check('11. Observability metrics (GET /api/metrics)', async () => {
    const res = await fetch(`${BASE_URL}/metrics`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.routes) throw new Error('Missing routes in metrics response');
  });

  // 12. POST /api/demo/seed
  await check('12. Seed demo profiles (POST /api/demo/seed)', async () => {
    const res = await fetch(`${BASE_URL}/demo/seed`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.day5.memories !== 6) throw new Error('Expected 6 seeded memories for Day 5');
  });

  // 13. POST /api/demo/expiring-memory (120s TTL)
  await check('13. TTL expiring memory (POST /api/demo/expiring-memory)', async () => {
    const res = await fetch(`${BASE_URL}/demo/expiring-memory`, {
      method: 'POST',
      headers: studentHeaders
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.secondsRemaining !== 120) throw new Error('Expected 120 seconds TTL');
  });

  console.log('\n========================================================================');
  console.log(`SMOKE TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// If run directly via command line
if (process.argv[1]?.endsWith('smoke.js')) {
  runSmokeTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal smoke test error:', err);
      process.exit(1);
    });
}
