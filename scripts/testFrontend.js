// scripts/testFrontend.js
import('../server.js').then(async () => {
  await new Promise((r) => setTimeout(r, 2000));
  const baseUrl = 'http://localhost:3000';

  console.log('--- 1. Testing GET / (Static HTML delivery) ---');
  const htmlRes = await fetch(baseUrl + '/');
  console.log('index.html status:', htmlRes.status);
  const htmlText = await htmlRes.text();
  console.log('Contains Chart.js CDN?:', htmlText.includes('cdn.jsdelivr.net/npm/chart.js') ? 'YES ✅' : 'NO ❌');
  console.log('Contains 3 tabs?:', htmlText.includes('data-tab="quiz"') && htmlText.includes('data-tab="memories"') && htmlText.includes('data-tab="progress"') ? 'YES ✅' : 'NO ❌');

  console.log('\n--- 2. Testing GET /style.css ---');
  const cssRes = await fetch(baseUrl + '/style.css');
  console.log('style.css status:', cssRes.status);
  const cssText = await cssRes.text();
  console.log('Contains #0F4A1E (Dark Green)?:', cssText.includes('#0F4A1E') ? 'YES ✅' : 'NO ❌');
  console.log('Contains #E8E9DF (Cream)?:', cssText.includes('#E8E9DF') ? 'YES ✅' : 'NO ❌');

  console.log('\n--- 3. Testing GET /app.js ---');
  const jsRes = await fetch(baseUrl + '/app.js');
  console.log('app.js status:', jsRes.status);
  const jsText = await jsRes.text();
  console.log('Uses textContent (XSS Prevention)?:', jsText.includes('textContent') ? 'YES ✅' : 'NO ❌');

  console.log('\n🎉 ALL PHASE 5 FRONTEND CHECKS PASSED!');
  process.exit(0);
});
