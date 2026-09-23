/* ═══════════════════════════════════════════════════════════════
   Comptes athlètes — LA définition partagée par /admin/athletes et
   /admin/dashboard.

   Un compte athlète = un compte de rôle ATHLETE, avec ou sans fiche :
   - fiche + compte, onboarding terminé   → « complete »
   - fiche + compte, onboarding en cours  → « commencee »
   - compte sans aucune fiche             → RPC admin_comptes_athletes_sans_fiche()
   Une fiche SANS compte (semée par un coach, ou compte supprimé) n'est pas
   une inscription : comptée à part, jamais dans le total. Idem pour une fiche
   rattachée à un compte d'un AUTRE rôle (ex. une fiche vitrine sur un compte
   ADMIN) : visible dans la liste, comptée à part, hors total.

   Pourquoi un module : le tableau de bord comptait `athletes` (les fiches)
   pendant que /admin/athletes comptait les comptes — deux chiffres pour la
   même carte « Athlètes ». Les deux écrans passent désormais par ces
   fonctions ; aucun ne recompte à sa manière.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type InscriptionFiche = "complete" | "commencee" | "sans_compte" | "compte_non_athlete";

/** Colonnes minimales d'une fiche pour la classer. */
/** L'embed `compte` à demander sur `athletes` — role compris : il décide. */
export const EMBED_COMPTE = "compte:user_id(onboarding_complete, created_at, role)";

export const SELECT_INSCRIPTION = `user_id, ${EMBED_COMPTE}`;

type CompteEmbed = { onboarding_complete?: boolean | null; created_at?: string | null; role?: string | null } | null;

const compteDe = (fiche: { compte?: unknown }): CompteEmbed =>
  (Array.isArray(fiche.compte) ? fiche.compte[0] : fiche.compte) as CompteEmbed;

export function inscriptionDeFiche(fiche: { user_id?: unknown; compte?: unknown }): InscriptionFiche {
  if (!fiche.user_id) return "sans_compte";
  const compte = compteDe(fiche);
  // Un compte d'un autre rôle n'est pas une inscription d'athlète. Rôle
  // inconnu (embed absent) → on garde l'ancien classement plutôt que
  // d'exclure en silence.
  if (compte?.role && compte.role !== "ATHLETE") return "compte_non_athlete";
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
  /** Hors total — fiches rattachées à un compte d'un autre rôle (ADMIN…). */
  compteNonAthlete: number;
}

export function repartitionComptesAthletes(
  inscriptions: Iterable<InscriptionFiche | undefined>,
  nbSansFiche: number,
): RepartitionComptes {
  let complete = 0, commencee = 0, sansCompte = 0, compteNonAthlete = 0;
  for (const i of inscriptions) {
    if (i === "complete") complete++;
    else if (i === "commencee") commencee++;
    else if (i === "compte_non_athlete") compteNonAthlete++;
    else sansCompte++;
  }
  return { complete, commencee, sansFiche: nbSansFiche, sansCompte, compteNonAthlete,
           comptes: complete + commencee + nbSansFiche };
}

/** Date de création de chaque COMPTE compté dans le total — même périmètre
 *  que `comptes` : fiches avec compte (users.created_at, identique à
 *  auth.users.created_at à 0,15 s près, vérifié en prod) + comptes sans fiche
 *  (inscrit_le = auth.users.created_at). Les fiches sans compte n'y sont pas :
 *  ce ne sont pas des inscriptions. */
export function datesCreationComptes(
  fiches: { user_id?: unknown; compte?: unknown }[],
  sansFiche: { inscrit_le?: string | null }[],
): string[] {
  const dates: string[] = [];
  for (const f of fiches) {
    // Même périmètre que le total : seules les fiches complete / commencee.
    const i = inscriptionDeFiche(f);
    if (i !== "complete" && i !== "commencee") continue;
    const d = compteDe(f)?.created_at;
    if (d) dates.push(d);
  }
  for (const c of sansFiche) if (c.inscrit_le) dates.push(c.inscrit_le);
  return dates;
}

/** Pour les écrans qui n'ont besoin que des chiffres (tableau de bord). */
export async function chargerRepartitionComptesAthletes(
  supabase: SupabaseClient,
): Promise<{ repartition: RepartitionComptes | null; datesCreation: string[]; erreur: string | null }> {
  const [fiches, sansFiche] = await Promise.all([
    supabase.from("athletes").select(SELECT_INSCRIPTION),
    supabase.rpc("admin_comptes_athletes_sans_fiche"),
  ]);
  const erreur = fiches.error?.message ?? sansFiche.error?.message ?? null;
  if (erreur) return { repartition: null, datesCreation: [], erreur };
  const lignesFiches = (fiches.data ?? []) as { user_id?: unknown; compte?: unknown }[];
  const lignesSansFiche = (sansFiche.data ?? []) as { inscrit_le?: string | null }[];
  return {
    repartition: repartitionComptesAthletes(lignesFiches.map(inscriptionDeFiche), lignesSansFiche.length),
    datesCreation: datesCreationComptes(lignesFiches, lignesSansFiche),
    erreur: null,
  };
}
