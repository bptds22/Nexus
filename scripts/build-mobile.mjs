// Wraps `next build` for the Capacitor mobile build.
//
// Why: Next 16's output:'export' parses every page in app/ — even pages we
// want to exclude via layout notFound() guards. Pages that use server-side
// dynamic APIs (searchParams, cookies-based supabase, etc.) error out
// regardless of guards. Easiest fix: physically hide those pages during the
// mobile build by renaming page.tsx -> page.tsx.disabled. The page route
// disappears from the route tree, no parse error. Restore on completion.
//
// ⚠ DEUX LISTES, PAS UNE. Ce commentaire affirmait une « single source of
// truth » — c'etait FAUX, et les deux listes avaient deja diverge (/join etait
// dans l'une, absent de l'autre, et le build mobile echouait).
//
//   · HIDE_PATTERNS, ci-dessous — ce que le BUILD masque physiquement. Ce
//     script ne lit RIEN d'autre : il n'importe pas mobile-excluded-routes.ts.
//     Une route absente d'ici sera parsee par output:'export', point final.
//   · lib/build/mobile-excluded-routes.ts — ce que le RUNTIME refuse, via les
//     gardes notFound() des layouts. Sans effet sur le build.
//
// Les deux sont COMPLEMENTAIRES et doivent etre tenues a jour ENSEMBLE :
// masquer au build sans bloquer au runtime laisse une route atteignable ;
// bloquer au runtime sans masquer au build casse `next build` en export.

import { spawn } from 'child_process';
import { mkdirSync, renameSync, existsSync } from 'fs';
import { globSync } from 'glob';
import path from 'path';

const ROOT = process.cwd();

const HIDE_PATTERNS = [
  // Whole excluded segments
  'app/admin/**/page.tsx',
  'app/partenaire/**/page.tsx',
  'app/parent/**/page.tsx',   // Portal parental (Lot 1a) — web only.
  // Groupe (dev) : 7 pages de banc d'essai (editeur-test, wall-test, page-test,
  // team-test, recherche-test, recherche-mobile-test, equipe-editeur-test).
  // Elles partaient dans le bundle iOS — un groupe de route entre parentheses
  // reste une route, et aucun motif ne les couvrait.
  // ⚠ PARENTHESES ECHAPPEES, meme raison que les crochets plus bas : glob les
  // lit comme un groupe d'alternance (extglob). Les deux formes ont ete
  // verifiees a 7 fichiers avant d'ecrire cette ligne — ne pas la modifier
  // sans re-tester le compte, un motif inerte ne dit rien.
  'app/\\(dev\\)/**/page.tsx',
  // ⚠ CROCHETS ECHAPPES — glob lit `[id]` comme une CLASSE DE CARACTERES, pas
  // comme un nom de dossier. 'app/partenaires/[id]/page.tsx' matchait ZERO
  // fichier (il aurait matche app/partenaires/i/page.tsx ou …/d/…). Le motif
  // etait donc inerte depuis toujours ; ca ne se voyait pas parce que cette
  // page-la porte un generateStaticParams et n'avait pas besoin d'etre masquee.
  // Toute route dynamique ajoutee ici DOIT echapper ses crochets.
  // Public partner profile
  'app/partenaires/\\[id\\]/page.tsx',
  // /join/[code] — atterrissage d'un lien de code d'equipe. WEB SEULEMENT :
  // la page detecte l'appareil et propose les liens vers les magasins,
  // precisement parce qu'elle ne peut pas ouvrir l'application. Route dynamique
  // SANS generateStaticParams — et elle ne peut pas en avoir, les codes sont
  // crees a l'execution. Sans ce masquage, output:'export' echoue.
  'app/join/\\[code\\]/page.tsx',
  // NOTE: app/page.tsx is NOT hidden — Capacitor needs an out/index.html
  // entry point. The page's redirect('/auth') guard fires on mobile load.
  // Centre d'aide public (chantier 5). WEB SEULEMENT pour l'instant :
  // la page importe MarketingNav + Footer, du decor marketing qui n'a
  // rien a faire dans l'application. L'aide arrivera sur mobile par un
  // sheet natif relisant le meme content/aide/*, sur le modele de
  // components/legal/LegalSheetMobile.tsx — sans ajouter de route.
  // Pas de crochets dans le chemin : rien a echapper ici.
  // Le layout.tsx voisin reste en place — un layout sans page ne cree
  // aucune route (meme montage que /tarifs, /a-propos, etc.).
  'app/aide/page.tsx',
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
  // Route handler GET dynamique (OAuth web callback) : incompatible avec
  // output:export (cookies + searchParams → "force-static non configuré").
  // Inutile sur device (login social NATIF, pas de callback web). Les autres
  // route.ts sous app/api/* sont des POST → ignorés par l'export, pas besoin
  // de les masquer.
  'app/auth/callback/route.ts',
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
    // Le build mobile DOIT inliner le domaine déployé (pas le localhost:3000
    // de .env.local) : NEXT_PUBLIC_APP_URL est bakée dans le bundle et sert de
    // base aux fetch Stripe mobile (getApiBase) — sinon checkout/portail
    // partent vers le localhost du téléphone (injoignable). Le dev web normal
    // (next dev / next build hors ce script) garde .env.local/localhost.
    // Surchargeable via l'env (CI/staging) ; défaut = prod.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexussports.ca';
    // Client IDs Google (login social natif) : bakés dans le bundle mobile.
    // Les client IDs OAuth sont PUBLICS (exposés côté client) → un fallback
    // hardcodé est OK et rend le build mobile indépendant de .env.local (vide).
    // Priorité gardée à l'env shell/CI s'il est défini (override staging/test).
    const googleWebClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
      || '1041412568525-qh01d95vmrpoq26g7du0hld7qnbmd15j.apps.googleusercontent.com';
    const googleIosClientId = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID
      || '1041412568525-dtrprae2620qffucjtrh70tn829b2gsa.apps.googleusercontent.com';
    const args = [
      'CAPACITOR_BUILD=true',
      `NEXT_PUBLIC_APP_URL=${appUrl}`,
      `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=${googleWebClientId}`,
      `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID=${googleIosClientId}`,
      'next', 'build',
    ];
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
