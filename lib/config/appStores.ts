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
