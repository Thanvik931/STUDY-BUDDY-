// scripts/copy-vendor.js
// Copies self-hosted vendor files (Chart.js) to public/vendor/ for zero third-party CDN dependency.
// Runs on postinstall to ensure public/vendor/chart.umd.js is always available.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const srcChart = path.join(rootDir, 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
const vendorDir = path.join(rootDir, 'public', 'vendor');
const destChart = path.join(vendorDir, 'chart.umd.js');

try {
  if (fs.existsSync(srcChart)) {
    if (!fs.existsSync(vendorDir)) {
      fs.mkdirSync(vendorDir, { recursive: true });
    }
    fs.copyFileSync(srcChart, destChart);
    console.log(' Self-hosted vendor assets copied: public/vendor/chart.umd.js');
  } else {
    console.warn('️ Chart.js dist file not found in node_modules.');
  }
} catch (err) {
  console.error(' Failed to copy vendor assets:', err.message);
}
