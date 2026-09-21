/* ═══════════════════════════════════════════════════════════════
   invitation — transport du jeton d'invitation, de /i/[jeton] jusqu'à
   l'attribution au consentement.

   PARCOURS (web seulement, décision BP 2026-09-21) :
     1. /i/[jeton] résout le lien et MÉMORISE le jeton (localStorage, 30 j) ;
     2. la recrue crée son compte ;
     3. au CONSENTEMENT — succès du signup par courriel (app/auth) ou
        validation de /consentements (Google / Apple) — tenterAttribution()
        appelle ambassadeur_lier_invitation.

   POURQUOI localStorage ET PAS sessionStorage (le choix de /join) : la
   recrue peut cliquer le lien, revenir le soir dans un autre onglet, et
   s'inscrire. 30 jours, puis le jeton est oublié.

   LE JETON N'EST JAMAIS AFFICHÉ. Il ne quitte le navigateur que vers la
   fonction d'attribution.

   SILENCE : l'attribution ne bloque JAMAIS une inscription — pas d'erreur
   affichée, délai borné, toute exception avalée (tracée en console).

   OUBLI SUR RÉPONSE DÉFINITIVE SEULEMENT. `consentement_requis` et
   `non_connecte` gardent le jeton : le compte n'a pas encore consenti, un
   passage ultérieur à /consentements retentera. Tout autre motif (attribuée,
   déjà attribuée, soi-même, compte trop ancien, non-athlète, jeton invalide)
   l'efface : retenter ne changerait rien, et un second compte créé dans le
   même navigateur ne doit pas hériter du jeton.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export const INVITATION_STORAGE_KEY = "nexus_invitation";
const DUREE_MS = 30 * 24 * 60 * 60 * 1000;
const DELAI_MAX_MS = 2500;
const JETON_RE = /^[0-9a-f]{64}$/;

interface Memorise { jeton: string; expire: number }

export function jetonPlausible(jeton: string | null | undefined): jeton is string {
  return typeof jeton === "string" && JETON_RE.test(jeton);
}

/** Mémorise un jeton déjà résolu comme valide. No-op sans stockage. */
export function memoriserInvitation(jeton: string): void {
  if (!jetonPlausible(jeton)) return;
  try {
    const v: Memorise = { jeton, expire: Date.now() + DUREE_MS };
    localStorage.setItem(INVITATION_STORAGE_KEY, JSON.stringify(v));
  } catch { /* navigation privée, quota : l'invitation est perdue, pas l'inscription */ }
}

/** Le jeton mémorisé s'il est encore frais, sinon null (et il est oublié). */
export function lireInvitation(): string | null {
  try {
    const brut = localStorage.getItem(INVITATION_STORAGE_KEY);
    if (!brut) return null;
    const v = JSON.parse(brut) as Partial<Memorise>;
    if (!jetonPlausible(v.jeton) || typeof v.expire !== "number" || v.expire < Date.now()) {
      localStorage.removeItem(INVITATION_STORAGE_KEY);
      return null;
    }
    return v.jeton;
  } catch {
    return null;
  }
}

export function oublierInvitation(): void {
  try { localStorage.removeItem(INVITATION_STORAGE_KEY); } catch { /* ignoré */ }
}

const MOTIFS_A_RETENTER = new Set(["consentement_requis", "non_connecte"]);

/** Tente d'attribuer le compte connecté au parrain du jeton mémorisé.
 *  Ne lève jamais, ne bloque pas plus de DELAI_MAX_MS. Rend le motif (ou
 *  null si rien n'a été tenté / réponse absente) — pour les journaux et les
 *  tests, jamais pour l'affichage. */
export async function tenterAttribution(supabase: SupabaseClient): Promise<string | null> {
  const jeton = lireInvitation();
  if (!jeton) return null;
  try {
    const appel = supabase
      .rpc("ambassadeur_lier_invitation", { p_jeton: jeton })
      .then(({ data, error }) => {
        if (error) {
          console.warn("[invitation] lier_invitation :", error.message);
          return null;
        }
        const motif = (data as { motif?: string } | null)?.motif ?? null;
        if (motif && !MOTIFS_A_RETENTER.has(motif)) oublierInvitation();
        return motif;
      });
    const delai = new Promise<null>((ok) => setTimeout(() => ok(null), DELAI_MAX_MS));
    return await Promise.race([appel, delai]);
  } catch (e) {
    console.warn("[invitation] attribution abandonnée :", e instanceof Error ? e.message : e);
    return null;
  }
}
