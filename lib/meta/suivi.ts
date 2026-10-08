/* ═══════════════════════════════════════════════════════════════
   Envoi d'un événement de conversion Meta — navigateur + serveur, même
   event_id (Meta déduplique les deux en UN événement).

   Ne bloque JAMAIS l'appelant : aucune promesse rendue, tout est dans un
   try/catch, l'appel serveur part en keepalive et ses erreurs sont
   avalées. Un échec Meta ne doit pas se voir dans une inscription.
═══════════════════════════════════════════════════════════════ */

import { Capacitor } from "@capacitor/core";
import { lireConsentement } from "./consentement";
import {
  META_PIXEL_ID, ROLES_META, urlSansIdentifiant, type EvenementMeta, type RoleMeta, type LEAD_DEMO,
} from "./regles";

type Fbq = (...args: unknown[]) => void;
declare global {
  interface Window { fbq?: Fbq }
}

/** Web seulement : ni le build Capacitor, ni une WebView native. */
export function estWebNavigateur(): boolean {
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") return false;
  try { return !Capacitor.isNativePlatform(); } catch { return true; }
}

export function mesureAutorisee(): boolean {
  return Boolean(META_PIXEL_ID) && estWebNavigateur() && lireConsentement() === "granted";
}

function nouvelEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Repli v4 (contextes non sécurisés) — la route exige la forme v4.
  const h = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  h[6] = (h[6] & 0x0f) | 0x40;
  h[8] = (h[8] & 0x3f) | 0x80;
  const s = h.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/**
 * @param preuve  CompleteRegistration : rien (le serveur relit la session).
 *                Lead : l'id de l'inscription démo, que le serveur vérifie
 *                en base et ne transmet PAS à Meta.
 */
export function envoyerEvenementMeta(
  evenement: EvenementMeta,
  contentName: RoleMeta | typeof LEAD_DEMO,
  preuve?: { demoId?: string },
): void {
  try {
    if (!mesureAutorisee()) return;
    // Ceinture : la liste fermée des rôles fait foi aussi à l'exécution.
    if (evenement === "CompleteRegistration" && !(ROLES_META as readonly string[]).includes(contentName)) return;
    const eventId = nouvelEventId();

    // Navigateur — seulement si l'URL courante ne porte aucun identifiant
    // (le pixel l'envoie avec l'événement). Sinon le serveur porte seul.
    if (window.fbq && urlSansIdentifiant(location.href)) {
      window.fbq("track", evenement, { content_name: contentName }, { eventID: eventId });
    }

    void fetch("/api/meta/evenement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      credentials: "same-origin",
      body: JSON.stringify({ evenement, eventId, contentName, url: location.href, ...preuve }),
    }).catch(() => { /* jamais visible */ });
  } catch (e) {
    console.warn("[meta] événement non envoyé:", e instanceof Error ? e.message : String(e));
  }
}
