/* ═══════════════════════════════════════════════════════════════
   appStores — liens de téléchargement + détection d'appareil.

   ÉTAT RÉEL DE LA DISTRIBUTION (à tenir à jour ici, un seul endroit) :
     • iOS      — PUBLIÉ, id6785596805.
     • Android  — PUBLIÉ, package ca.nexussports.app (même id que
                  capacitor.config.ts et android/app/google-services.json).

   Il existe deux autres copies de ces URLs dans le dépôt :
     • supabase/functions/send-invitation/email.ts — IRRÉDUCTIBLE : la edge
       function tourne sous Deno et ne peut pas importer d'ici. Ses constantes
       pointent déjà les deux fiches.
     • lib/carte/contact.ts — carte de visite ; le badge Play y était masqué
       tant que la fiche n'existait pas, il est réactivé.
═══════════════════════════════════════════════════════════════ */

export const APP_STORE_URL = "https://apps.apple.com/ca/app/nexus/id6785596805";

/** Le type garde `| null` VOLONTAIREMENT, alors que la valeur est désormais
 *  renseignée : les appelants conservent leur branche de repli, et un
 *  éventuel retrait de la fiche Play redevient un changement d'une ligne ici
 *  au lieu d'un correctif dans chaque écran. */
export const PLAY_STORE_URL: string | null =
  "https://play.google.com/store/apps/details?id=ca.nexussports.app";

export type DeviceKind = "ios" | "android" | "desktop";

/* ── Liens AVEC ATTRIBUTION (page /app) ─────────────────────────────
   Ce qui compte, ce sont les INSTALLATIONS par source, pas les clics : les
   deux consoles savent les rapporter si le lien porte la campagne.
     • App Store Connect → App Analytics > Sources : `pt` (identifiant
       FOURNISSEUR du compte) + `ct` (jeton de campagne) + `mt=8`.
       Sans `pt`, `ct` est ignoré — d'où le lien NU tant que le jeton
       fournisseur n'est pas renseigné ci-dessous.
     • Play Console → Acquisition : `referrer` URL-encodé porteur de
       utm_source / utm_medium.
   Seule la source `instagram-bio` est marquée aujourd'hui ; les autres
   visites repartent vers les liens nus. */

/** Identifiant fournisseur App Store Connect (`pt`). À renseigner — BP le
 *  fournit. Tant qu'il est null, le lien App Store part sans campagne. */
export const APP_STORE_PROVIDER_TOKEN: string | null = null;

const CAMPAGNES = {
  "instagram-bio": { ct: "instagram-bio", utmSource: "instagram", utmMedium: "bio" },
} as const;

type SourceCampagne = keyof typeof CAMPAGNES;
const aCampagne = (s: string): s is SourceCampagne => s in CAMPAGNES;

/** Lien App Store pour une source de visite. */
export function lienAppStore(source: string): string {
  if (!aCampagne(source) || !APP_STORE_PROVIDER_TOKEN) return APP_STORE_URL;
  const q = new URLSearchParams({ pt: APP_STORE_PROVIDER_TOKEN, ct: CAMPAGNES[source].ct, mt: "8" });
  return `${APP_STORE_URL}?${q}`;
}

/** Referrer Play (déjà URL-encodé une fois, comme l'attend la Play Console). */
function referrerPlay(source: string): string | null {
  if (!aCampagne(source)) return null;
  const c = CAMPAGNES[source];
  return encodeURIComponent(`utm_source=${c.utmSource}&utm_medium=${c.utmMedium}`);
}

/** Lien Play Store (https) pour une source de visite. */
export function lienPlayStore(source: string): string {
  const base = PLAY_STORE_URL ?? APP_STORE_URL;
  const r = PLAY_STORE_URL ? referrerPlay(source) : null;
  return r ? `${base}&referrer=${r}` : base;
}

/**
 * URL d'INTENTION Android, pour les navigateurs intégrés (Instagram,
 * Facebook) : elle demande explicitement l'application Play Store au lieu
 * de charger la fiche web DANS la vue d'Instagram. `S.browser_fallback_url`
 * renvoie vers la fiche https si l'intention n'aboutit pas.
 * Null si la fiche Play n'existe pas (voir PLAY_STORE_URL).
 */
export function intentionPlayStore(source: string): string | null {
  if (!PLAY_STORE_URL) return null;
  const id = new URL(PLAY_STORE_URL).searchParams.get("id");
  if (!id) return null;
  const r = referrerPlay(source);
  const chemin = `details?id=${id}${r ? `&referrer=${r}` : ""}`;
  return `intent://${chemin}#Intent;scheme=market;package=com.android.vending;` +
    `S.browser_fallback_url=${encodeURIComponent(lienPlayStore(source))};end`;
}

/**
 * L'URL du magasin pour une plateforme NATIVE, avec surcharge distante
 * facultative.
 *
 * POURQUOI LE CODE FAIT FOI. L'argument pour piloter l'URL depuis la base
 * n'est pas nul — un binaire bloqué par le force-update est par définition
 * ancien, donc porteur de l'URL de son époque, et le distant permettrait de
 * la corriger après coup. Mais un identifiant App Store ne bouge pas, et une
 * URL erronée en base enverrait TOUT LE MONDE dans le vide, y compris ceux
 * qu'on cherchait à dépanner. D'où l'ordre choisi : les constantes
 * ci-dessus par défaut, la surcharge seulement si elle existe. On garde le
 * levier sans en faire une dépendance.
 *
 * Le repli Android sur l'App Store n'est pas un oubli : `PLAY_STORE_URL`
 * garde son type `| null` pour que le retrait de la fiche Play reste un
 * changement d'une ligne ici. Tant qu'elle est renseignée, ce repli est
 * inatteignable.
 */
export function storeUrlPour(
  plateforme: "ios" | "android",
  surcharge?: string | null,
): string {
  if (surcharge) return surcharge;
  return plateforme === "ios" ? APP_STORE_URL : (PLAY_STORE_URL ?? APP_STORE_URL);
}

/** Famille d'appareil déduite du user-agent.
 *
 *  iPadOS 13+ se déclare « Macintosh » et ne se distingue d'un vrai Mac que
 *  par la présence du tactile — d'où le test maxTouchPoints. Sans lui, un iPad
 *  se verrait proposer le signup web au lieu de l'App Store.
 *
 *  Retourne "desktop" côté serveur (pas de navigator) : le rendu initial est
 *  donc toujours le même des deux côtés, et l'affinage se fait au montage. */
export function detectDevice(): DeviceKind {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  const isTouchMac = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  return isTouchMac ? "ios" : "desktop";
}
