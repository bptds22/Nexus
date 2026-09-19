/* ═══════════════════════════════════════════════════════════════
   /app — classification d'une visite, À PARTIR DU SEUL User-Agent.

   Logique PURE (aucun import de Next ni de Supabase) : elle tourne côté
   serveur dans app/app/page.tsx et se teste sous node --test.

   TROIS QUESTIONS, TROIS RÉPONSES INDÉPENDANTES
     plateforme — ios | android | desktop. Ce que le serveur PEUT savoir.
                  L'iPad récent se déclare « Macintosh » : ici il sort
                  `desktop`. La page le rattrape au montage avec
                  detectDevice() (lib/config/appStores.ts), qui voit le
                  tactile. Le compteur, lui, l'a déjà compté en desktop —
                  sous-estimation connue et assumée d'iOS.
     robot      — un robot de PRÉVISUALISATION (aperçu de lien). Il ne doit
                  JAMAIS être redirigé : sinon l'aperçu montrerait la fiche
                  App Store au lieu de notre carte Open Graph. Il n'est pas
                  compté non plus.
     integre    — le navigateur INTÉGRÉ d'Instagram ou de Facebook. Une
                  redirection 30x vers un store y est fragile (la fiche web
                  s'ouvre DANS la vue d'Instagram au lieu de l'application) :
                  on sert la page, qui tente l'ouverture et garde un gros
                  bouton si elle échoue.
   ═══════════════════════════════════════════════════════════════ */

export type Plateforme = "ios" | "android" | "desktop";

export type Visite = {
  plateforme: Plateforme;
  robot: boolean;
  integre: boolean;
};

/** Robots d'aperçu et d'indexation, NOMMÉS un par un. `facebookexternalhit`
 *  couvre aussi Instagram, Messenger et l'aperçu iMessage (qui s'annonce
 *  comme lui).
 *  Pas de motif générique `bot` : il attraperait des téléphones Android de
 *  marque Cubot (« CUBOT P40 »), traités en robots donc jamais redirigés. */
const ROBOTS =
  /facebookexternalhit|facebot|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|skypeuripreview|pinterestbot|embedly|redditbot|applebot|googlebot|google-inspectiontool|bingbot|duckduckbot|yandexbot|baiduspider|crawler|spider/i;

/** Navigateurs intégrés Meta : Instagram, Facebook (FBAN/FBAV), Messenger. */
const INTEGRES = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|MessengerForiOS/i;

export function classerVisite(userAgent: string | null | undefined): Visite {
  const ua = userAgent ?? "";
  const robot = ROBOTS.test(ua);
  const integre = !robot && INTEGRES.test(ua);

  // Android avant iOS : certains UA Android mentionnent « like iPhone »
  // dans des chaînes de compatibilité ; l'inverse n'existe pas.
  let plateforme: Plateforme = "desktop";
  if (!robot) {
    if (/Android/i.test(ua)) plateforme = "android";
    else if (/iPhone|iPod|iPad/.test(ua)) plateforme = "ios";
  }
  return { plateforme, robot, integre };
}

/* ── Source ────────────────────────────────────────────────────────
   Liste FERMÉE, miroir de la contrainte CHECK de app_redirect_counts :
   un paramètre d'URL libre ne doit pas pouvoir créer des lignes à volonté. */

export const SOURCES = ["instagram-bio", "direct", "autre"] as const;
export type Source = (typeof SOURCES)[number];

/** `?s=ig` → instagram-bio ; absent → direct ; toute autre valeur → autre. */
export function sourceDepuisParam(s: string | string[] | null | undefined): Source {
  const v = Array.isArray(s) ? s[0] : s;
  if (v === undefined || v === null || v === "") return "direct";
  return v === "ig" ? "instagram-bio" : "autre";
}
