// scripts/check-copy.js
// Audits HTML files for unprofessional placeholder text (Rule 13.11).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

const FORBIDDEN_WORDS = ['lorem ipsum', 'todo', 'fixme', 'coming soon', 'under construction'];

console.log('========================================================================');
console.log('  UI COPY & PROFESSIONAL INTEGRITY AUDIT (Rule 13.11)');
console.log('========================================================================\n');

let violations = 0;

const htmlFiles = fs.readdirSync(publicDir).filter((f) => f.endsWith('.html'));

htmlFiles.forEach((file) => {
  const raw = fs.readFileSync(path.join(publicDir, file), 'utf-8');
  // Strip HTML tags and attributes to inspect visible body copy only
  const visibleText = raw.replace(/<[^>]*>/g, ' ').toLowerCase();

  FORBIDDEN_WORDS.forEach((word) => {
    if (visibleText.includes(word)) {
      console.log(` [FLAG] ${file} contains placeholder copy: "${word}"`);
      violations++;
    }
  });
});

console.log('========================================================================');
if (violations === 0) {
  console.log('COPY INTEGRITY AUDIT: ALL CHECKS PASSED (Zero forbidden placeholders)');
  console.log('========================================================================\n');
  process.exit(0);
} else {
  console.log(`COPY INTEGRITY AUDIT: ${violations} placeholder(s) detected`);
  console.log('========================================================================\n');
  process.exit(1);
}
