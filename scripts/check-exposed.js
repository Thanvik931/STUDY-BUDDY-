// scripts/check-exposed.js
// Verifies public/ directory contains NO sensitive, backup, or server files (Rule 13.7).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

const FORBIDDEN_EXTENSIONS = ['.env', '.git', '.pem', '.key', '.bak', '.log', '.sql', '.sh', '.py'];
const FORBIDDEN_NAMES = ['.ds_store', 'thumbs.db', 'server.js', 'package.json'];

console.log('========================================================================');
console.log('  EXPOSED PUBLIC ASSETS AUDIT (Rule 13.7)');
console.log('========================================================================\n');

let violations = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const fullPath = path.join(dir, ent.name);
    const lowerName = ent.name.toLowerCase();

    if (ent.isDirectory()) {
      if (lowerName === '.git' || lowerName === 'node_modules') {
        console.log(`❌ [FAIL] Exposed directory in public: ${ent.name}`);
        violations++;
      } else {
        walk(fullPath);
      }
    } else if (ent.isFile()) {
      if (FORBIDDEN_NAMES.includes(lowerName) || FORBIDDEN_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
        console.log(`❌ [FAIL] Forbidden file exposed in public: ${ent.name}`);
        violations++;
      }
    }
  }
}

if (fs.existsSync(publicDir)) {
  walk(publicDir);
}

if (violations === 0) {
  console.log('• 1. No secret or server files in public/............. [PASS]');
  console.log('• 2. No backup or OS files (.DS_Store, .bak).......... [PASS]');
  console.log('\n========================================================================');
  console.log('EXPOSED FILES AUDIT: ALL CHECKS PASSED');
  console.log('========================================================================\n');
  process.exit(0);
} else {
  console.log(`\n❌ Total violations found: ${violations}`);
  process.exit(1);
}
