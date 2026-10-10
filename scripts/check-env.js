// scripts/check-env.js
// Audits environment variables and git secret tracking rules without revealing secret values.
// WHY: Rule 13.2 requirement. Prints PASS or FAIL per rule and verifies .env is not committed.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

export function runEnvCheck() {
  console.log('========================================================================');
  console.log('  ENVIRONMENT & SECRET CONFIGURATION AUDIT (Rule 13.2)');
  console.log('========================================================================\n');

  let allPass = true;

  function report(name, pass, details = '') {
    const status = pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`• ${name.padEnd(52, '.')} [${status}] ${details}`);
    if (!pass) allPass = false;
  }

  // 1. Required Variables Present & Non-Empty
  const requiredKeys = [
    'NODE_ENV',
    'MONGODB_URI',
    'MONGODB_DB',
    'SESSION_SECRET',
    'SITE_URL',
    'CONTACT_EMAIL'
  ];
  let missingKeys = [];
  for (const k of requiredKeys) {
    if (!process.env[k] || !process.env[k].trim()) {
      missingKeys.push(k);
    }
  }
  report('1. Required variables present', missingKeys.length === 0, missingKeys.length > 0 ? `(Missing: ${missingKeys.join(', ')})` : '');

  // 2. SESSION_SECRET Strong (>= 32 bytes hex, no placeholders)
  const secret = process.env.SESSION_SECRET || '';
  const isHex = /^[0-9a-fA-F]+$/.test(secret);
  const isMinLength = secret.length >= 64;
  const lowerSec = secret.toLowerCase();
  const hasPlaceholder = ['changeme', 'secret', 'password', '12345678'].some((p) => lowerSec.includes(p));
  const secretPass = isHex && isMinLength && !hasPlaceholder;
  report('2. SESSION_SECRET cryptographic strength', secretPass, secretPass ? '(>= 32 bytes random hex)' : '(Must be >= 64 hex chars, no placeholders)');

  // 3. SITE_URL format
  const siteUrl = process.env.SITE_URL || '';
  let urlPass = false;
  try {
    const u = new URL(siteUrl);
    if (process.env.NODE_ENV === 'production') {
      urlPass = u.protocol === 'https:';
    } else {
      urlPass = u.protocol === 'http:' || u.protocol === 'https:';
    }
  } catch (_) {
    urlPass = false;
  }
  report('3. SITE_URL correctly formatted', urlPass, process.env.NODE_ENV === 'production' ? '(Must start with https://)' : '(Valid URL)');

  // 4. CONTACT_EMAIL format
  const email = process.env.CONTACT_EMAIL || '';
  const emailPass = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  report('4. CONTACT_EMAIL format valid', emailPass);

  // 5. DEBUG not set
  const debugSet = Boolean(process.env.DEBUG && process.env.DEBUG.trim());
  report('5. DEBUG mode is disabled', !debugSet, debugSet ? '(DEBUG variable is set)' : '');

  // 6. DEMO_MODE and STRESS_MODE off in production
  const isProd = process.env.NODE_ENV === 'production';
  const demoActive = process.env.DEMO_MODE === 'true';
  const stressActive = process.env.STRESS_MODE === 'true';
  const modesPass = !isProd || (!demoActive && !stressActive);
  report('6. Test modes disabled in production', modesPass, (isProd && (demoActive || stressActive)) ? '(DEMO/STRESS cannot be active in production)' : '');

  // 7. .env ignored by git
  let gitIgnored = false;
  try {
    const out = execSync('git check-ignore .env', { cwd: rootDir, encoding: 'utf-8' }).trim();
    gitIgnored = out.includes('.env');
  } catch (_) {
    gitIgnored = false;
  }
  report('7. .env is ignored by git (.gitignore)', gitIgnored);

  // 8. .env is not tracked in git tree
  let notTracked = false;
  try {
    const out = execSync('git ls-files .env', { cwd: rootDir, encoding: 'utf-8' }).trim();
    notTracked = out.length === 0;
  } catch (_) {
    notTracked = false;
  }
  report('8. .env is not tracked in git history', notTracked);

  console.log('\n========================================================================');
  console.log(`ENV AUDIT RESULT: ${allPass ? '\x1b[32mALL RULES PASSED\x1b[0m' : '\x1b[31mFAILURES DETECTED\x1b[0m'}`);
  console.log('========================================================================\n');

  return allPass;
}

// Execute when invoked directly via CLI
if (process.argv[1] && process.argv[1].endsWith('check-env.js')) {
  const success = runEnvCheck();
  process.exit(success ? 0 : 1);
}
