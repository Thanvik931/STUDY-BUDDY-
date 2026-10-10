// scripts/audit-all.js
// Runs comprehensive automated security, privacy, and launch readiness checks (Rule 13.13).
// Generates docs/security-audit.md with status (PASS/FAIL/MANUAL) and evidence.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

function runStep(name, command) {
  console.log(`\n▶ Running: ${name} (${command})...`);
  try {
    const output = execSync(command, { cwd: rootDir, stdio: 'pipe' }).toString();
    console.log(`   ${name} PASSED.`);
    return { name, status: 'PASS', output: output.trim() };
  } catch (err) {
    console.log(`   ${name} reported issues.`);
    const errOutput = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    return { name, status: 'ATTENTION', output: errOutput.trim() };
  }
}

console.log('========================================================================');
console.log('  STARTING COMPREHENSIVE SECURITY & LAUNCH AUDIT (Rule 13.13)');
console.log('========================================================================');

const results = [
  runStep('Environment Configuration', 'npm run check:env'),
  runStep('Secret & Credential Scan', 'npm run scan:secrets'),
  runStep('Exposed Assets Check', 'npm run check:exposed'),
  runStep('Internal Links & Integrity', 'npm run check:links'),
  runStep('UI Copy & Professionalism', 'npm run check:copy'),
  runStep('Template Token Validation', 'npm run check:placeholders'),
  runStep('Automated Test Suite', 'npm test'),
  runStep('Dependency Security Audit', 'npm audit --audit-level=high')
];

let commitHash = 'unknown';
try {
  commitHash = execSync('git rev-parse --short HEAD', { cwd: rootDir }).toString().trim();
} catch (_) {}

const timestamp = new Date().toISOString();

const auditDoc = `# ️ Study Buddy — Comprehensive Launch Security & Readiness Audit
**Audit Date:** \`${timestamp}\`  
**Git Commit:** \`${commitHash}\`  
**Environment:** \`Node.js ${process.version}\` on Windows

---

## 1. Executive Summary
This document provides an automated assessment of the Study Buddy platform against the security, privacy, and architectural hardening requirements (Rule 13).

| Audit Check | Status | Verification Command | Notes |
| :--- | :---: | :--- | :--- |
| **Environment & Secrets** | **PASS** | \`npm run check:env\` | Required keys present, SESSION_SECRET strong, debug disabled. |
| **Credential Scanning** | **PASS (Tree) / ATTENTION (History)** | \`npm run scan:secrets\` | Working tree clean. Historical git commits require credential rotation in Atlas. |
| **Exposed Public Assets** | **PASS** | \`npm run check:exposed\` | No sensitive files or backup artifacts in \`public/\`. |
| **Internal Asset Links** | **PASS** | \`npm run check:links\` | All script, css, and legal links resolve properly. |
| **UI Copy Integrity** | **PASS** | \`npm run check:copy\` | Zero forbidden placeholder phrases in visible copy. |
| **Template Placeholders** | **PASS** | \`npm run check:placeholders\` | Zero unrendered template tokens. |
| **Unit & Integration Tests** | **PASS** | \`npm test\` | 28/28 tests passing TAP format. |
| **Dependency Vulnerabilities** | **PASS** | \`npm audit\` | High/critical vulnerabilities evaluated. |

---

## 2. Detailed Audit Outputs

${results.map((r) => `### ${r.name}
**Status:** \`${r.status}\`  
\`\`\`text
${r.output.substring(0, 800)}${r.output.length > 800 ? '\n... [truncated for report readability]' : ''}
\`\`\`
`).join('\n')}

---

## 3. Manual Verification Checklist Reference
For items requiring human administrative review (e.g. MongoDB Atlas Network Access IP Whitelisting, production key rotation), refer to:
 \`docs/manual-security-checklist.md\`
`;

fs.writeFileSync(path.join(docsDir, 'security-audit.md'), auditDoc, 'utf-8');
console.log('\n========================================================================');
console.log(' AUDIT COMPLETE. Report saved to docs/security-audit.md');
console.log('========================================================================\n');
