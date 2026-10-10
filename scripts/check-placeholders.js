// scripts/check-placeholders.js
// Audits HTML and client templates for unrendered {{TOKEN}} placeholders (Rule 13.11).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

console.log('========================================================================');
console.log('  TEMPLATE TOKEN AUDIT (Rule 13.11)');
console.log('========================================================================\n');

let unrenderedTokens = 0;
const TOKEN_REGEX = /\{\{([A-Z0-9_]+)\}\}/g;

const htmlFiles = fs.readdirSync(publicDir).filter((f) => f.endsWith('.html'));

htmlFiles.forEach((file) => {
  const content = fs.readFileSync(path.join(publicDir, file), 'utf-8');
  let match;
  while ((match = TOKEN_REGEX.exec(content)) !== null) {
    console.log(` [FLAG] ${file} contains raw unrendered token: ${match[0]}`);
    unrenderedTokens++;
  }
});

console.log('========================================================================');
if (unrenderedTokens === 0) {
  console.log('TOKEN AUDIT: ALL CHECKS PASSED (Zero raw unrendered {{TOKENS}})');
  console.log('========================================================================\n');
  process.exit(0);
} else {
  console.log(`TOKEN AUDIT: ${unrenderedTokens} unrendered token(s) found`);
  console.log('========================================================================\n');
  process.exit(1);
}
