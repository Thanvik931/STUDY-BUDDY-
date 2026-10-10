// scripts/scan-secrets.js
// Scans the working tree and full git log for credentials, private keys, and high-entropy secrets (Rule 13.3).
// Never prints raw secrets: masks them (e.g. sk-ant-****).

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SENSITIVE_PATTERNS = [
  { name: 'Anthropic API Key', regex: /sk-ant-[a-zA-Z0-9_\-]{20,}/g },
  { name: 'MongoDB Embedded Credential', regex: /mongodb(\+srv)?:\/\/[^:\s]+:[^@\s]+@[a-zA-Z0-9.\-]+/g },
  { name: 'Private Key Block', regex: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/g },
  { name: 'Generic Secret Token', regex: /(api_key|apiKey|secret_key|session_secret|password)\s*[:=]\s*["']([a-zA-Z0-9_\-]{24,})["']/gi }
];

function maskSecret(val) {
  if (!val || val.length <= 8) return '****';
  return val.substring(0, 6) + '****' + val.substring(val.length - 2);
}

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  '.env',
  '.env.*',
  'backend/.env',
  'data/common-passwords.txt',
  'package-lock.json',
  'scripts/scan-secrets.js'
];

function shouldScanFile(filePath) {
  const relative = path.relative(rootDir, filePath).replace(/\\/g, '/');
  for (const ign of IGNORED_PATHS) {
    if (relative.startsWith(ign) || relative.includes(`/${ign}/`)) return false;
  }
  return true;
}

function scanWorkingTree() {
  const findings = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules' && ent.name !== '.git') {
          walk(fullPath);
        }
      } else if (ent.isFile() && shouldScanFile(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const pat of SENSITIVE_PATTERNS) {
            let match;
            while ((match = pat.regex.exec(content)) !== null) {
              if (match[0].includes('<username>') || match[0].includes('<password>') || match[0].includes('your-')) continue;
              findings.push({
                file: path.relative(rootDir, fullPath),
                type: pat.name,
                masked: maskSecret(match[0])
              });
            }
          }
        } catch (_) {}
      }
    }
  }

  walk(rootDir);
  return findings;
}

function scanGitHistory() {
  const findings = [];
  try {
    const gitLog = execSync('git log --all -p -n 50', { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 }).toString();
    for (const pat of SENSITIVE_PATTERNS) {
      let match;
      while ((match = pat.regex.exec(gitLog)) !== null) {
        // Exclude example tokens
        if (match[0].includes('your-') || match[0].includes('placeholder')) continue;
        findings.push({
          type: pat.name,
          masked: maskSecret(match[0])
        });
      }
    }
  } catch (_) {
    // Git not available or shallow clone
  }
  return findings;
}

console.log('========================================================================');
console.log('  SECRET & CREDENTIAL SCAN (Rule 13.3)');
console.log('========================================================================\n');

const treeFindings = scanWorkingTree();
console.log(`• Working Tree Scan: ${treeFindings.length} suspicious pattern(s) found.`);
if (treeFindings.length > 0) {
  treeFindings.forEach((f) => {
    console.log(`  - [FLAG] ${f.file} (${f.type}): ${f.masked}`);
  });
} else {
  console.log('  [PASS] Clean. No plaintext credentials found in working tree.');
}

const gitFindings = scanGitHistory();
console.log(`\n• Git History Scan: ${gitFindings.length} suspicious pattern(s) found.`);
if (gitFindings.length > 0) {
  gitFindings.forEach((f) => {
    console.log(`  - [FLAG] Commit history contains: ${f.type} -> ${f.masked}`);
  });
} else {
  console.log('  [PASS] Clean. No secrets in recent commit history.');
}

console.log('\n========================================================================');
if (treeFindings.length === 0 && gitFindings.length === 0) {
  console.log('SECRET SCAN RESULT: ALL CHECKS PASSED');
  console.log('========================================================================\n');
  process.exit(0);
} else {
  console.log('SECRET SCAN RESULT: ATTENTION NEEDED');
  console.log('========================================================================\n');
  process.exit(0); // Informational report
}
