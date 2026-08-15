/* ═══════════════════════════════════════════════════════════════
   recruiterAthleteCards — accès unique à la RPC recruiter_athlete_cards.

   LE PATRON 2-TEMPS, ET POURQUOI
   Neuf surfaces recruteur affichaient des cartes d'athlètes via un
   embed PostgREST (`athletes!athlete_id(...)`) greffé sur une
   relation qu'elles possèdent déjà : favoris, pipeline, listes, vus
   récemment, tendances, calendrier, conversations, résumé de fil,
   contexte de fil. Un embed lit la table `athletes` en direct —
   c'est exactement ce que le verrou RLS doit fermer, et ça ne peut
   pas appliquer la projection Loi 25.

   D'où le 2-temps :
     1. le hook garde SA requête de relation, embed athletes retiré,
        et n'en récupère que les `athlete_id` ;
     2. il résout les cartes par lot via cette fonction.

   Une RPC, neuf appelants, une seule règle de masquage.

   ── Le piège à ne pas reproduire ──────────────────────────────
   La RPC ne renvoie AUCUNE ligne pour un athlète absent, inactif
   (status <> 'ACTIF'), ou supprimé. Un `Map.get()` rend alors
   `undefined`, et `undefined` traversé dans un template littéral
   produit la chaîne "undefined" à l'écran — la même classe de bug
   que le "null null" de usePipelineCards:99.

   Donc : TOUJOURS `?? null` explicite à la sortie du Map, et passer
   par `displayFullName()` pour le libellé. Jamais d'interpolation
   directe de first_name/last_name.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Une ligne d'évaluation telle que projetée dans l'agrégat `evaluations`.
 *  `updated_at` est indispensable : selectBestEvaluation trie dessus et
 *  retombe sur un ordre non déterministe s'il manque.
 *
 *  ALIAS DE TYPE, PAS `interface` — et c'est nécessaire, pas cosmétique :
 *  selectBestEvaluation prend `T extends EvalRow` avec
 *  `EvalRow = Record<string, unknown>`. Une `interface` n'a pas de
 *  signature d'index implicite et n'est donc PAS assignable à un Record ;
 *  un alias de type objet, si. Repasser en `interface` casse tout
 *  appelant qui trie ses évaluations. */
export type RecruiterEvalRow = {
  cote_globale: number | null;
  distinctions: unknown;
  updated_at: string | null;
};

/**
 * Miroir exact du RETURNS TABLE de recruiter_athlete_cards
 * (20260811210000).
 *
 * Les quatre champs d'identité sont nullable PAR CONTRAT, pas par
 * accident : le serveur les met à NULL quand `identity_visible` est
 * faux. Les typer `string` mentirait au compilateur et rendrait
 * invisibles précisément les endroits qu'il faut traiter.
 */
export interface RecruiterAthleteCard {
  id: string;
  /** false = identité masquée (Loi 25 OU tier FREE). Voir LockedIdentityPlaceholder. */
  identity_visible: boolean;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  numero_jersey: string | null;
  /** Âge dérivé. `date_naissance` n'est JAMAIS projetée aux recruteurs. */
  age: number | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  last_profile_validation: string | null;
  cote_globale: number | null;
  profile_completion: number | null;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | null;
  moyenne_generale: number | null;
  mentions_academiques: unknown;
  recruitment_status: string | null;
  statut_recrutement_override: string | null;
  open_to_offers: boolean | null;
  a_une_video: boolean | null;
  context: string | null;
  sport_nom: string | null;
  position_nom: string | null;
  position_abbr: string | null;
  school_id: string | null;
  school_name: string | null;
  school_region: string | null;
  school_type: string | null;
  committed_school_name: string | null;
  evaluations: RecruiterEvalRow[] | null;
}

/** Libellé affiché quand le serveur a masqué l'identité. Aligné sur
 *  l'aria-label de LockedIdentityPlaceholder pour que la carte et sa
 *  photo racontent la même chose. */
export const LOCKED_NAME_LABEL = "Identité réservée";

/**
 * Nom affichable d'une carte, sans jamais produire "null null".
 *
 * Trois cas, dans cet ordre :
 *   - carte absente (athlète inactif/supprimé) → `missingLabel`
 *   - identité masquée                        → LOCKED_NAME_LABEL
 *   - sinon                                   → "Prénom Nom" nettoyé
 *
 * Le dernier cas reste défensif : un prénom présent et un nom NULL
 * ne doit pas donner "Gabriel null".
 */
export function displayFullName(
  card: RecruiterAthleteCard | null | undefined,
  missingLabel = "Athlète inconnu",
): string {
  if (!card) return missingLabel;
  if (!card.identity_visible) return LOCKED_NAME_LABEL;
  const full = [card.first_name, card.last_name].filter(Boolean).join(" ").trim();
  return full || LOCKED_NAME_LABEL;
}

/**
 * Résout un lot d'athlètes par IDs et les indexe par id.
 *
 * Retourne une Map plutôt qu'un tableau : les appelants itèrent sur
 * LEUR relation (pipeline, favoris, fil…) et ont besoin d'un accès
 * direct, pas d'un `.find()` quadratique. La Map peut contenir moins
 * d'entrées que d'IDs demandés — voir le piège en tête de fichier.
 *
 * Court-circuite sur liste vide : `.rpc()` avec un tableau vide est
 * un aller-retour réseau pour rien.
 */
export async function fetchRecruiterAthleteCards(
  supabase: SupabaseClient,
  athleteIds: readonly string[],
): Promise<Map<string, RecruiterAthleteCard>> {
  const ids = Array.from(new Set(athleteIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase.rpc("recruiter_athlete_cards", {
    p_athlete_ids: ids,
  });

  if (error) throw error;

  const rows = (data ?? []) as RecruiterAthleteCard[];
  return new Map(rows.map((r) => [r.id, r]));
}
