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
] as const;

export const MOBILE_EXCLUDED_PAGES = [
  // Landing — gérée par redirect() vers /auth, pas notFound()
  '/',

  // Landings persona
  '/pour-les-coachs',
  '/pour-les-recruteurs',
  '/pour-les-etudiant-athlete',

  // Centre d'aide public — web seulement. L'aide mobile passera par un
  // sheet natif lisant le même content/aide/*, pas par une route.
  '/aide',

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
