/* ═══════════════════════════════════════════════════════════════════════════
   getCoachAthletes — LA source canonique unique de « mes athlètes » (client).

   Enveloppe mince du RPC SQL `get_coach_athletes` (migration
   20260801100000). LE périmètre « quels athlètes ce coach voit-il » est
   défini UNE SEULE FOIS, côté serveur :

     • coach            = coach_id = moi  ∪  athlètes de mes équipes
     • directeur (en +) = ∪ athlètes des écoles/clubs où je suis DIRECTEUR
     • statuts          = ACTIF (+ EN_ATTENTE si includePending) ; DESACTIVE /
                          DIPLOME / SUPPRIME toujours exclus

   L'élargissement « école » est gaté serveur sur le statut directeur réel :
   un coach ordinaire n'obtient jamais l'école, même s'il appelle ce helper.
   Aucun uid n'est transmis — le RPC lit auth.uid() → on ne peut jamais
   demander le périmètre d'un autre.

   CONTRAT (ledger) : toute surface « quels athlètes ce coach voit-il » DOIT
   passer par ici. Ne JAMAIS réécrire une query .from("athletes") parallèle
   qui redéfinit le périmètre (union coach_id/team/school + filtre statut).
   Le pattern historique — chaque surface sa propre définition — est la cause
   racine du bug « visible ici, vide là ». Cette fonction le clôt.

   Usage type dans une surface :
     const { ids, relationById, statusById } = await loadCoachAthleteScope(supabase);
     if (!ids.length) return [];                       // aucun athlète en périmètre
     const { data } = await supabase.from("athletes")
       .select("<colonnes propres à la surface>")
       .in("id", ids)                                  // périmètre canonique
       .order("last_name");
     // relationById.get(id) → 'OWNER'|'TEAM'|'SCHOOL' pour partitionner « mes »
     // statusById.get(id)   → 'ACTIF'|'EN_ATTENTE' pour le liseré « En attente »
═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CoachAthleteRelation = "OWNER" | "TEAM" | "SCHOOL";

export interface CoachAthleteScope {
  /** Les athlete_id en périmètre. Vide si le user n'a aucun athlète. */
  ids: string[];
  /** athlete_id → relation la plus forte (OWNER > TEAM > SCHOOL). */
  relationById: Map<string, CoachAthleteRelation>;
  /** athlete_id → statut ('ACTIF' | 'EN_ATTENTE') pour le badge. */
  statusById: Map<string, string>;
}

interface CoachAthleteRow {
  athlete_id: string;
  relation: CoachAthleteRelation;
  status: string;
}

/**
 * Charge le périmètre canonique d'athlètes du user courant.
 * Ne throw jamais : retombe sur un périmètre vide en cas d'erreur RPC.
 *
 * @param includePending inclure les EN_ATTENTE (défaut true — le coach gère
 *   ses athlètes en attente de consentement dans toutes ses surfaces ; le
 *   côté recruteur reste protégé par SA propre RLS, jamais ce chemin).
 */
export async function loadCoachAthleteScope(
  supabase: SupabaseClient,
  opts: { includePending?: boolean } = {},
): Promise<CoachAthleteScope> {
  const includePending = opts.includePending ?? true;
  const { data, error } = await supabase.rpc("get_coach_athletes", {
    p_include_pending: includePending,
  });
  const empty: CoachAthleteScope = {
    ids: [],
    relationById: new Map(),
    statusById: new Map(),
  };
  if (error || !data) return empty;

  const rows = data as CoachAthleteRow[];
  const ids: string[] = [];
  const relationById = new Map<string, CoachAthleteRelation>();
  const statusById = new Map<string, string>();
  for (const r of rows) {
    ids.push(r.athlete_id);
    relationById.set(r.athlete_id, r.relation);
    statusById.set(r.athlete_id, r.status);
  }
  return { ids, relationById, statusById };
}

/** Convenience : juste le compte du périmètre (surfaces « count »). */
export async function loadCoachAthleteCount(
  supabase: SupabaseClient,
  opts: { includePending?: boolean } = {},
): Promise<number> {
  const { ids } = await loadCoachAthleteScope(supabase, opts);
  return ids.length;
}
