/* ═══════════════════════════════════════════════════════════════
   Consentement aux témoins de mesure — côté navigateur.

   Double stockage voulu : localStorage (choix de l'utilisateur, lu par
   le client) + cookie nexus_consent (le SEUL que voit le serveur — la
   route /api/meta/evenement et /auth/callback le relisent avant tout
   envoi à Meta). Le cookie fait foi : en cas de désaccord, il gagne.

   Durée : 6 mois, après quoi on redemande.
═══════════════════════════════════════════════════════════════ */

import { CONSENT_COOKIE, CONSENT_STORAGE_KEY, type ConsentValue } from "./regles";

const SIX_MOIS_S = 60 * 60 * 24 * 182;
export const EVT_CHANGEMENT = "nx-consent-change";
export const EVT_OUVRIR = "nx-consent-open";

function lireCookie(nom: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${nom}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function lireConsentement(): ConsentValue | null {
  const c = lireCookie(CONSENT_COOKIE);
  if (c === "granted" || c === "denied") return c;
  // Cookie expiré ou effacé : le localStorage seul ne suffit pas à
  // autoriser un envoi serveur, donc on redemande.
  return null;
}

export function ecrireConsentement(v: ConsentValue): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${v}; Max-Age=${SIX_MOIS_S}; Path=/; SameSite=Lax${secure}`;
  try { localStorage.setItem(CONSENT_STORAGE_KEY, v); } catch { /* navigation privée */ }

  if (v === "denied") effacerTemoinsMeta();
  window.dispatchEvent(new CustomEvent(EVT_CHANGEMENT, { detail: v }));
}

/** Retire _fbp / _fbc, sur l'hôte et sur le domaine parent. */
export function effacerTemoinsMeta(): void {
  const hote = location.hostname;
  const parent = hote.split(".").slice(-2).join(".");
  for (const nom of ["_fbp", "_fbc"]) {
    document.cookie = `${nom}=; Max-Age=0; Path=/`;
    document.cookie = `${nom}=; Max-Age=0; Path=/; Domain=${hote}`;
    document.cookie = `${nom}=; Max-Age=0; Path=/; Domain=.${parent}`;
  }
}

/** Rouvre le bandeau (lien « Gérer les témoins » du pied de page). */
export function ouvrirGestionTemoins(): void {
  window.dispatchEvent(new Event(EVT_OUVRIR));
}
