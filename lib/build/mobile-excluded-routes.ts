/**
 * Registry des routes exclues du build mobile (output: 'export' avec
 * CAPACITOR_BUILD=true).
 *
 * Ce fichier est descriptif — il sert de source vérité pour le scope mobile.
 * Les exclusions effectives sont implémentées via :
 *   - `notFound()` guard dans app/admin/layout.tsx + app/partenaire/layout.tsx
 *     (couvre tous les enfants — admin/* et partenaire/* segments complets)
 *   - `notFound()` guard en tête de chaque page marketing/légale individuelle
 *   - `redirect('/auth')` guard en tête de app/page.tsx (root — sinon le bundle
 *     mobile n'aurait pas de point d'entrée valide)
 *   - `generateStaticParams() => []` sur les routes [id] (segments dynamiques
 *     non-exportés au build mobile)
 *   - HIDE_PATTERNS dans scripts/build-mobile.mjs, qui DÉPLACE physiquement les
 *     fichiers avant `next build`. C'est le seul mécanisme qui vaille pour les
 *     ROUTES API dynamiques (app/api/**\/[param]/**\/route.ts) : elles n'ont ni
 *     layout où poser un notFound(), ni page où poser generateStaticParams,
 *     et output:'export' les refuse telles quelles. Ajouté le 2026-08-26 après
 *     que app/api/admin/partners/[id]/resend ait cassé le build six jours durant.
 *     Aucune garde runtime n'est nécessaire pour elles : un export statique
 *     n'embarque aucune route API — il n'y a rien à atteindre sur l'appareil.
 *
 * Les guards utilisent `process.env.CAPACITOR_BUILD === 'true'` (server) ou
 * `process.env.NEXT_PUBLIC_CAPACITOR_BUILD === 'true'` (client). En web,
 * ces variables sont indéfinies/'false' → le guard est no-op.
 *
 * Catégories :
 * 1. Marketing public : landing, tarifs, "pour les X", contenus éditoriaux
 * 2. Légales : remplacées par des PDFs (voir lib/legal/index.ts)
 * 3. Admin : gestion plateforme (rôle ADMIN, web-only)
 * 4. Portail partenaire : B2B desktop (rôle PARTNER, web-only)
 * 5. Profil public partenaire : vitrine non-critique mobile
 */

export const MOBILE_EXCLUDED_SEGMENTS = [
  '/admin',
  '/partenaire',
  '/parent',   // Portal parental (Lot 1a) — web only. Exclusion effective via
               // le guard notFound() dans app/parent/layout.tsx.
] as const;

export const MOBILE_EXCLUDED_DYNAMIC_ROUTES = [
  '/partenaires', // /partenaires/[id] profil public
  // /join/[code] — atterrissage d'un lien de code d'équipe. WEB SEULEMENT, par
  // conception : la page détecte l'appareil et propose les liens vers l'App
  // Store / Google Play, précisément parce qu'elle ne peut pas ouvrir
  // l'application (aucun lien universel n'est configuré, cf. capacitor.config).
  // Sans cette exclusion, output:'export' échoue — la route est dynamique et
  // n'a pas de generateStaticParams(), qu'elle ne peut pas avoir : les codes
  // sont créés à l'exécution et ne sont pas énumérables à la compilation.
  '/join',
  // /i/[jeton] — lien d'invitation Ambassadeur (2026-09-22). WEB SEULEMENT par
  // décision BP (pas de liens universels) : il mène à l'inscription web.
  // Masqué par HIDE_PATTERNS, gardé par notFound() en tête de la page.
  '/i',
] as const;

export const MOBILE_EXCLUDED_PAGES = [
  // Landing — gérée par redirect() vers /auth, pas notFound()
  '/',

  // Landings persona
  '/pour-les-coachs',
  '/pour-les-recruteurs',
  '/pour-les-etudiant-athlete',
  '/pour-les-parents',

  // Centre d'aide public — web seulement. L'aide mobile passera par un
  // sheet natif lisant le même content/aide/*, pas par une route.
  '/aide',

  // Lien de la bio Instagram (2026-09-18) — redirige vers le bon store selon
  // le User-Agent. WEB SEULEMENT : dynamique (headers()), et sans objet dans
  // l'application. Masquée au build par HIDE_PATTERNS, gardée par notFound()
  // en tête de app/app/page.tsx.
  '/app',

  // Lien LCAP « Ne plus recevoir ces courriels » (2026-09-21). WEB SEULEMENT :
  // dynamique (searchParams), et un lien de courriel s'ouvre dans le
  // navigateur. Masquée par HIDE_PATTERNS, gardée par notFound() en tête de
  // app/desabonnement/page.tsx.
  '/desabonnement',

  // Pages produit/marketing
  '/tarifs',
  '/a-propos',
  '/comment-ca-marche',
  '/roadmap',
  '/guide-recrutement',
  '/contact',
  '/communications-marketing',

  // Pages légales — remplacées par PDFs (lib/legal/index.ts)
  '/confidentialite',
  '/conditions',
  '/collecte-donnees',

  // Routes dev/test — accès web URL-only (noindex), jamais bundlées mobile.
  // Exclusion effective via le guard notFound() en tête de chaque page.
  '/page-test',
  '/team-test',
  '/wall-test',
  '/recherche-test',
  '/recherche-mobile-test',
  // Ajoutees 2026-08-24 : elles etaient masquees au BUILD par
  // HIDE_PATTERNS ('app/(dev)/**/page.tsx') mais absentes d'ici. Le groupe
  // de route (dev) n'apparait pas dans l'URL, donc chaque feuille doit etre
  // listee nommement. Les deux listes avaient deja diverge une fois (/join).
  '/editeur-test',
  '/equipe-editeur-test',
] as const;

/**
 * Helper : une route donnée doit-elle être exclue du build mobile ?
 * Utilisable côté outillage (eslint custom rule, scripts d'audit, etc.).
 * N'est PAS utilisé au runtime — les guards sont câblés directement dans
 * les pages/layouts via process.env.CAPACITOR_BUILD.
 */
export function isMobileExcluded(pathname: string): boolean {
  if ((MOBILE_EXCLUDED_PAGES as readonly string[]).includes(pathname)) return true;

  for (const segment of MOBILE_EXCLUDED_SEGMENTS) {
    if (pathname === segment || pathname.startsWith(`${segment}/`)) return true;
  }

  for (const dynRoute of MOBILE_EXCLUDED_DYNAMIC_ROUTES) {
    if (pathname.startsWith(`${dynRoute}/`)) return true;
  }

  return false;
}
