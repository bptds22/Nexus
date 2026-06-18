// Wraps `next build` for the Capacitor mobile build.
//
// Why: Next 16's output:'export' parses every page in app/ — even pages we
// want to exclude via layout notFound() guards. Pages that use server-side
// dynamic APIs (searchParams, cookies-based supabase, etc.) error out
// regardless of guards. Easiest fix: physically hide those pages during the
// mobile build by renaming page.tsx -> page.tsx.disabled. The page route
// disappears from the route tree, no parse error. Restore on completion.
//
// Single source of truth for what's hidden: lib/build/mobile-excluded-routes.ts
// (descriptive) and the HIDE_PATTERNS array below (operational).

import { spawn } from 'child_process';
import { mkdirSync, renameSync, existsSync } from 'fs';
import { globSync } from 'glob';
import path from 'path';

const ROOT = process.cwd();

const HIDE_PATTERNS = [
  // Whole excluded segments
  'app/admin/**/page.tsx',
  'app/partenaire/**/page.tsx',
  // Public partner profile
  'app/partenaires/[id]/page.tsx',
  // NOTE: app/page.tsx is NOT hidden — Capacitor needs an out/index.html
  // entry point. The page's redirect('/auth') guard fires on mobile load.
  'app/tarifs/page.tsx',
  'app/a-propos/page.tsx',
  'app/comment-ca-marche/page.tsx',
  'app/pour-les-coachs/page.tsx',
  'app/pour-les-recruteurs/page.tsx',
  'app/pour-les-etudiant-athlete/page.tsx',
  'app/roadmap/page.tsx',
  'app/guide-recrutement/page.tsx',
  'app/contact/page.tsx',
  'app/communications-marketing/page.tsx',
  // Legal (replaced by PDFs via lib/legal)
  'app/confidentialite/page.tsx',
  'app/conditions/page.tsx',
  'app/collecte-donnees/page.tsx',
];

function findAllToHide() {
  const files = new Set();
  for (const pat of HIDE_PATTERNS) {
    const matches = globSync(pat, { cwd: ROOT, posix: false });
    for (const m of matches) files.add(path.join(ROOT, m));
  }
  return [...files];
}

const moved = []; // { from, to }

function hide() {
  const files = findAllToHide();
  console.log(`[mobile-build] Hiding ${files.length} pages from CAPACITOR build`);
  for (const f of files) {
    if (!existsSync(f)) continue;
    const dest = f + '.disabled';
    renameSync(f, dest);
    moved.push({ from: dest, to: f });
  }
}

let cleanedUp = false;
function restore() {
  if (cleanedUp) return;
  cleanedUp = true;
  for (const { from, to } of moved.slice().reverse()) {
    try {
      if (existsSync(from)) renameSync(from, to);
    } catch (e) {
      console.error(`[mobile-build] Failed to restore ${to}:`, e.message);
    }
  }
  console.log(`[mobile-build] Restored ${moved.length} pages`);
}

// Restore on Ctrl+C or kill so the repo is never left with .disabled files.
process.on('SIGINT', () => {
  console.log('\n[mobile-build] Interrupted (SIGINT) — restoring hidden pages...');
  restore();
  process.exit(130);
});
process.on('SIGTERM', () => {
  console.log('\n[mobile-build] Interrupted (SIGTERM) — restoring hidden pages...');
  restore();
  process.exit(143);
});

async function runBuild() {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'cross-env.cmd' : 'cross-env';
    const args = ['CAPACITOR_BUILD=true', 'next', 'build'];
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

let code = 1;
try {
  hide();
  code = await runBuild();
} catch (err) {
  console.error('[mobile-build] error:', err);
  code = 2;
} finally {
  restore();
}
process.exit(code);
