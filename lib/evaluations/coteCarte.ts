/* ═══════════════════════════════════════════════════════════════
   La cote AFFICHÉE sur la carte du joueur — coach d'abord, sinon
   partenaire (demande BP du 2026-10-16). Partagé web et appli.

   Règle, une seule pour toutes les cartes (recherche grille et ligne,
   favoris, fiche, aperçu) :
   - le coach a évalué → sa cote, comme avant ; rien du partenaire ;
   - sinon, une évaluation partenaire lisible → sa cote, TOUJOURS avec
     « Évaluation {organisation} » : jamais d'étoiles partenaire seules,
     qu'on prendrait pour la note d'un coach ;
   - sinon → rien (0 : la carte garde ses étoiles vides, pas de libellé).

   Plusieurs partenaires : LA PLUS RÉCENTE (updated_at, puis l'identifiant
   à date égale) — règle confirmée par BP le 2026-10-16, la même que
   recruiter_search_athletes au filtre « 4+ étoiles » et au tri. Une carte
   ne peut pas afficher une cote et un tri en désaccord. Changer de règle =
   changer `retenirCotePartenaire` ET le LATERAL de la recherche, ensemble.

   Visibilité : rien de nouveau. Les cotes viennent de
   cotes_partenaires_athletes(), qui délègue athlète par athlète à
   evaluations_partenaires_athlete() (W2) — la lecture que la fiche fait
   déjà. Un athlète refusé par W2 n'a pas de ligne : pas de cote. Loi 25
   (2026-10-16) : sans opt-in partenaire ACTIF, W2 ne rend rien (sauf à
   l'admin) — un retrait efface la cote de toutes les cartes, aussitôt.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { idsUniques, lireTout } from "@/lib/supabase/lireTout";

export interface CotePartenaire {
  /** Identifiant de l'évaluation partenaire. */
  id: string;
  athleteId: string;
  /** Nom de l'ORGANISATION — jamais celui d'une personne. */
  organisation: string;
  cote: number;
  updatedAt: string;
}

export interface CoteCarte {
  valeur: number;
  /** Non nul = la cote vient d'un partenaire : la carte DOIT afficher
   *  `libelleCotePartenaire(organisation)` à côté des étoiles. */
  organisation: string | null;
}

/** Repli si une ligne arrivait sans nom d'organisation (jamais vu : la colonne est NOT NULL). */
export const ORGANISATION_INCONNUE = "Partenaire";

/** Le libellé collé aux étoiles d'une cote partenaire. */
export function libelleCotePartenaire(organisation: string): string {
  return `Évaluation ${organisation}`;
}

/** Parmi les évaluations partenaires d'UN athlète, celle que la carte affiche :
 *  la plus récente (à égalité de date, l'identifiant départage, pour un rendu stable). */
export function retenirCotePartenaire(evals: readonly CotePartenaire[] | null | undefined): CotePartenaire | null {
  let retenue: CotePartenaire | null = null;
  for (const e of evals ?? []) {
    if (!(e.cote > 0)) continue;
    if (!retenue || e.updatedAt > retenue.updatedAt || (e.updatedAt === retenue.updatedAt && e.id > retenue.id)) {
      retenue = e;
    }
  }
  return retenue;
}

/** Coach d'abord, sinon partenaire avec son organisation, sinon rien. */
export function coteCarte(
  coteCoach: number | null | undefined,
  partenaire: { cote: number | null | undefined; organisation: string | null | undefined } | null | undefined,
): CoteCarte {
  if (typeof coteCoach === "number" && coteCoach > 0) return { valeur: coteCoach, organisation: null };
  const c = partenaire?.cote;
  if (typeof c === "number" && c > 0) {
    return { valeur: c, organisation: partenaire?.organisation || ORGANISATION_INCONNUE };
  }
  return { valeur: 0, organisation: null };
}

/** Raccourci : coach, sinon la partenaire retenue parmi `evals`. */
export function coteCarteDepuisEvaluations(
  coteCoach: number | null | undefined,
  evals: readonly CotePartenaire[] | null | undefined,
): CoteCarte {
  const p = retenirCotePartenaire(evals);
  return coteCarte(coteCoach, p ? { cote: p.cote, organisation: p.organisation } : null);
}

type Ligne = { id: string; athlete_id: string; organisation: string | null; cote_globale: number | string; updated_at: string };

/** Les évaluations partenaires lisibles d'un lot d'athlètes, groupées par athlète.
 *  Toutes les pages (lireTout) : jamais « les 1000 premières ». */
export async function chargerCotesPartenaires(
  supabase: SupabaseClient,
  athleteIds: Iterable<string | null | undefined>,
): Promise<Map<string, CotePartenaire[]>> {
  const ids = idsUniques(athleteIds).sort();
  const parAthlete = new Map<string, CotePartenaire[]>();
  if (ids.length === 0) return parAthlete;
  const lignes = await lireTout<Ligne>((de, a) => supabase
    .rpc("cotes_partenaires_athletes", { p_athlete_ids: ids }, { count: "exact" })
    .select("id, athlete_id, organisation, cote_globale, updated_at")
    .order("id")
    .range(de, a));
  for (const r of lignes) {
    const c: CotePartenaire = {
      id: r.id,
      athleteId: r.athlete_id,
      organisation: r.organisation || ORGANISATION_INCONNUE,
      cote: Number(r.cote_globale),
      updatedAt: r.updated_at,
    };
    const l = parAthlete.get(c.athleteId);
    if (l) l.push(c); else parAthlete.set(c.athleteId, [c]);
  }
  return parAthlete;
}
