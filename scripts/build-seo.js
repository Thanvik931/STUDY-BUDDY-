// scripts/build-seo.js
// Generates public/robots.txt and public/sitemap.xml (Rule 13.9).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

const siteUrl = env.SITE_URL.replace(/\/$/, '');

// Generate robots.txt
const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`;
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf-8');
console.log(' Generated public/robots.txt');

// Generate sitemap.xml
const now = new Date().toISOString().split('T')[0];
const pages = [
  { path: '/', priority: '1.0' },
  { path: '/privacy.html', priority: '0.5' },
  { path: '/terms.html', priority: '0.5' }
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>
    <loc>${siteUrl}${p.path}</loc>
    <lastmod>${now}</lastmod>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf-8');
console.log(' Generated public/sitemap.xml');
