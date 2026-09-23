/* ═══════════════════════════════════════════════════════════════
   Comptes athlètes — LA définition partagée par /admin/athletes et
   /admin/dashboard.

   Un compte athlète = un compte de rôle ATHLETE, avec ou sans fiche :
   - fiche + compte, onboarding terminé   → « complete »
   - fiche + compte, onboarding en cours  → « commencee »
   - compte sans aucune fiche             → RPC admin_comptes_athletes_sans_fiche()
   Une fiche SANS compte (semée par un coach, ou compte supprimé) n'est pas
   une inscription : comptée à part, jamais dans le total.

   Pourquoi un module : le tableau de bord comptait `athletes` (les fiches)
   pendant que /admin/athletes comptait les comptes — deux chiffres pour la
   même carte « Athlètes ». Les deux écrans passent désormais par ces
   fonctions ; aucun ne recompte à sa manière.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type InscriptionFiche = "complete" | "commencee" | "sans_compte";

/** Colonnes minimales d'une fiche pour la classer. */
export const SELECT_INSCRIPTION = "user_id, compte:user_id(onboarding_complete)";

type CompteEmbed = { onboarding_complete?: boolean | null } | null;

export function inscriptionDeFiche(fiche: { user_id?: unknown; compte?: unknown }): InscriptionFiche {
  if (!fiche.user_id) return "sans_compte";
  const compte = (Array.isArray(fiche.compte) ? fiche.compte[0] : fiche.compte) as CompteEmbed;
  return compte?.onboarding_complete === true ? "complete" : "commencee";
}

export interface RepartitionComptes {
  /** Le total affiché : complete + commencee + sansFiche. */
  comptes: number;
  complete: number;
  commencee: number;
  sansFiche: number;
  /** Hors total — fiches sans compte. */
  sansCompte: number;
}

export function repartitionComptesAthletes(
  inscriptions: Iterable<InscriptionFiche | undefined>,
  nbSansFiche: number,
): RepartitionComptes {
  let complete = 0, commencee = 0, sansCompte = 0;
  for (const i of inscriptions) {
    if (i === "complete") complete++;
    else if (i === "commencee") commencee++;
    else sansCompte++;
  }
  return { complete, commencee, sansFiche: nbSansFiche, sansCompte, comptes: complete + commencee + nbSansFiche };
}

/** Pour les écrans qui n'ont besoin que des chiffres (tableau de bord). */
export async function chargerRepartitionComptesAthletes(
  supabase: SupabaseClient,
): Promise<{ repartition: RepartitionComptes | null; erreur: string | null }> {
  const [fiches, sansFiche] = await Promise.all([
    supabase.from("athletes").select(SELECT_INSCRIPTION),
    supabase.rpc("admin_comptes_athletes_sans_fiche"),
  ]);
  const erreur = fiches.error?.message ?? sansFiche.error?.message ?? null;
  if (erreur) return { repartition: null, erreur };
  return {
    repartition: repartitionComptesAthletes(
      ((fiches.data ?? []) as { user_id?: unknown; compte?: unknown }[]).map(inscriptionDeFiche),
      ((sansFiche.data ?? []) as unknown[]).length,
    ),
    erreur: null,
  };
}
