// scripts/check-links.js
// Validates that all internal links and asset references in public/ resolve correctly (Rule 13.7).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

console.log('========================================================================');
console.log('  INTERNAL LINK & ASSET INTEGRITY AUDIT (Rule 13.7)');
console.log('========================================================================\n');

let issues = 0;

function checkHtmlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relFile = path.relative(publicDir, filePath);

  // Match src="..." and href="..."
  const assetRegex = /(src|href)=["']([^"':#]+)["']/g;
  let match;

  while ((match = assetRegex.exec(content)) !== null) {
    const rawRef = match[2];
    if (rawRef.startsWith('http://') || rawRef.startsWith('https://') || rawRef.startsWith('mailto:') || rawRef.startsWith('data:')) {
      continue;
    }

    // Resolve path
    const resolved = rawRef.startsWith('/')
      ? path.join(publicDir, rawRef.substring(1))
      : path.join(path.dirname(filePath), rawRef);

    if (!fs.existsSync(resolved)) {
      console.log(`❌ [BROKEN] ${relFile} references missing file: ${rawRef}`);
      issues++;
    } else {
      console.log(`• Asset resolved: ${rawRef} -> OK`);
    }
  }
}

const htmlFiles = fs.readdirSync(publicDir).filter((f) => f.endsWith('.html'));
htmlFiles.forEach((f) => checkHtmlFile(path.join(publicDir, f)));

console.log('\n========================================================================');
if (issues === 0) {
  console.log('LINK & ASSET AUDIT: ALL CHECKS PASSED');
  console.log('========================================================================\n');
  process.exit(0);
} else {
  console.log(`LINK & ASSET AUDIT: ${issues} broken link(s) found`);
  console.log('========================================================================\n');
  process.exit(1);
}
