/* ═══════════════════════════════════════════════════════════════
   sacOnboarding — le sac localStorage « nexus_user » de l'onboarding.

   Ce sac est un état de PARCOURS (l'assistant d'onboarding coach /
   recruteur s'en sert d'une étape à l'autre), pas un profil. Il a pourtant
   longtemps nourri la barre latérale recruteur — qui retombait sur une
   persona de démo (« Pierre Dufour — CÉGEP Garneau ») quand il manquait, ou
   montrait le compte PRÉCÉDENT quand il était périmé (retour BP 2026-09-28).

   Règle : la barre latérale lit le profil réel de la session
   (useCurrentUser) ; le sac est PURGÉ dès qu'il n'appartient pas à la
   session (autre adresse), à la déconnexion, et une fois l'onboarding
   terminé.
═══════════════════════════════════════════════════════════════ */

export const CLE_SAC_ONBOARDING = "nexus_user";

/** Le sac doit-il partir ? (pur, testable) */
export function sacPerime(
  brut: string | null,
  session: { email: string | null | undefined; onboardingComplete?: boolean | null },
): boolean {
  if (!brut) return false;
  if (session.onboardingComplete === true) return true;
  try {
    const sac = JSON.parse(brut) as { email?: unknown };
    const a = typeof sac.email === "string" ? sac.email.trim().toLowerCase() : "";
    const b = (session.email ?? "").trim().toLowerCase();
    // Sans adresse de part ou d'autre, on ne peut pas prouver qu'il est à la session.
    return !a || !b || a !== b;
  } catch {
    return true; // illisible : inutilisable, donc périmé
  }
}

/** Sans session : purge inconditionnelle (déconnexion). */
export function purgerSacOnboarding(session?: { email: string | null | undefined; onboardingComplete?: boolean | null }): void {
  try {
    if (!session || sacPerime(localStorage.getItem(CLE_SAC_ONBOARDING), session)) {
      localStorage.removeItem(CLE_SAC_ONBOARDING);
    }
  } catch { /* privé / quota / SSR */ }
}
