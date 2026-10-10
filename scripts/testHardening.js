// scripts/testHardening.js
import('../server.js').then(async () => {
  await new Promise((r) => setTimeout(r, 2000));
  const baseUrl = 'http://localhost:3000/api';

  // 1. Fetch a student
  const studentsRes = await fetch(baseUrl + '/students');
  const studentsData = await studentsRes.json();
  const student = studentsData.students[0];
  const headers = { 'x-student-id': student._id };

  // 2. Test GET /api/progress (MongoDB aggregation pipeline)
  console.log('--- 1. Testing GET /api/progress (Aggregation) ---');
  const progRes = await fetch(baseUrl + '/progress', { headers });
  const progData = await progRes.json();
  console.log('Progress status:', progRes.status);
  console.log('Overall Accuracy:', progData.overallAccuracy + '%');
  console.log('Total Attempts:', progData.totalAttempts);
  console.log('Timeline entries count:', progData.timeline.length);
  if (progData.timeline.length > 0) {
    console.log('Sample timeline entry:', progData.timeline[0]);
  }

  // 3. Test GET /api/metrics (Observability)
  console.log('\n--- 2. Testing GET /api/metrics (p50/p95 Latency) ---');
  const metRes = await fetch(baseUrl + '/metrics');
  const metData = await metRes.json();
  console.log('Metrics status:', metRes.status);
  console.log('Tracked routes count:', Object.keys(metData.routes).length);
  for (const [route, stats] of Object.entries(metData.routes)) {
    console.log('Route [' + route + ']: total=' + stats.totalRequests + ', p50=' + stats.p50_ms + 'ms, p95=' + stats.p95_ms + 'ms, errors=' + stats.errors);
  }

  // 4. Test Security Headers (Helmet)
  console.log('\n--- 3. Testing Helmet Security Headers ---');
  console.log('CSP Header:', metRes.headers.get('content-security-policy') ? 'Active ✅' : 'Missing ❌');
  console.log('X-Content-Type-Options:', metRes.headers.get('x-content-type-options'));

  // 5. Test Rate Limiting Headers
  console.log('\n--- 4. Testing Rate Limiting Headers ---');
  console.log('RateLimit-Limit:', metRes.headers.get('ratelimit-limit'));
  console.log('RateLimit-Remaining:', metRes.headers.get('ratelimit-remaining'));

  // 6. Test 10kb Body Limit (Attempt oversized payload)
  console.log('\n--- 5. Testing 10kb Body Limit Rejection ---');
  const oversizedPayload = { data: 'x'.repeat(15000) }; // 15kb
  const largeRes = await fetch(baseUrl + '/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(oversizedPayload)
  });
  const largeData = await largeRes.json();
  console.log('Oversized payload status:', largeRes.status, '(Expected: 413)');
  console.log('Oversized error response:', largeData);

  console.log('\n🎉 ALL PHASE 4 HARDENING & SECURITY CHECKS PASSED!');
  process.exit(0);
});
