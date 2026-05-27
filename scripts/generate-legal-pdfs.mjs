// Generates A4 PDFs of the 3 legal pages from a running dev server,
// to be uploaded to Supabase Storage for mobile consumption.
//
// Usage:
//   1. `npm run dev` in another terminal (must be reachable at localhost:3000)
//   2. `node scripts/generate-legal-pdfs.mjs`
//
// Output: assets/legal/{confidentialite,conditions,collecte-donnees}.pdf

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const PAGES = [
  { url: 'http://localhost:3000/confidentialite', name: 'confidentialite.pdf' },
  { url: 'http://localhost:3000/conditions', name: 'conditions.pdf' },
  { url: 'http://localhost:3000/collecte-donnees', name: 'collecte-donnees.pdf' },
];

const OUTPUT_DIR = 'assets/legal';
mkdirSync(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

for (const { url, name } of PAGES) {
  console.log(`Generating ${name}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.emulateMedia({ media: 'print' });
  // Hide the heavy PlaybookBackground SVG and dark canvas so the PDF stays
  // small (text + minimal layout only).
  await page.addStyleTag({
    content: `
      [class*="PlaybookBackground"], canvas, svg[aria-hidden="true"] { display: none !important; }
      body { background: #fff !important; color: #111 !important; }
      .hero-playbook { background: #fff !important; }
      * { color: #111 !important; box-shadow: none !important; }
    `,
  });
  await page.waitForTimeout(1500);
  await page.pdf({
    path: join(OUTPUT_DIR, name),
    format: 'A4',
    printBackground: false,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
  });
  console.log(`OK ${name}`);
}

await browser.close();
console.log('Done.');
