/* ═══════════════════════════════════════════════════════════════
   Évaluation PARTENAIRE (lot W2) — lecture et écriture.

   Ce n'est PAS une évaluation de coach, et rien ici ne doit pouvoir
   s'y confondre :
   - table à part (partner_evaluations) — jamais `evaluations`, jamais
     athletes.cote_globale_entraineur ;
   - signée par l'ORGANISATION (organization_name), jamais par une
     personne ; jamais de check bleu à côté ;
   - affichée SOUS l'évaluation du coach, dans sa propre section, et
     elle y reste même quand le coach a évalué.

   Tout passe par trois RPC (aucun accès direct à la table) :
   - evaluations_partenaires_athlete : la lecture, arbitrée serveur ;
   - partenaire_evaluation_contexte  : le bouton « Évaluer » (portail
     partenaire) et la grille que l'écriture figera ;
   - partenaire_evaluer_athlete      : l'écriture, gardée par
     partenaire_peut_evaluer() + is_partner_eligible_athlete().
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { EVALUATION_TRAIT_FIELDS } from "@/lib/evaluations/selectEvaluation";

export type CritereColonne = (typeof EVALUATION_TRAIT_FIELDS)[number];

export interface EvaluationPartenaire {
  id: string;
  /** Nom de l'organisation partenaire — le SEUL nom affiché. */
  organisation: string;
  coteGlobale: number;
  /** Critères notés seulement (colonne DB → note). Vide = mode simple. */
  criteres: Partial<Record<CritereColonne, number>>;
  grilleId: string | null;
  updatedAt: string;
  /** Vrai pour le partenaire qui l'a saisie (portail partenaire). */
  estLaMienne: boolean;
}

/** Diffusé après un enregistrement : les sections affichées se rechargent. */
export const EVENEMENT_EVALUATION_PARTENAIRE = "nx-evaluation-partenaire";

type Ligne = Record<string, unknown> & {
  id: string; organisation: string; cote_globale: number | string;
  grille_id: string | null; updated_at: string; est_la_mienne: boolean;
};

export async function chargerEvaluationsPartenaires(
  supabase: SupabaseClient,
  athleteId: string,
): Promise<EvaluationPartenaire[]> {
  const { data, error } = await supabase.rpc("evaluations_partenaires_athlete", { p_athlete_id: athleteId });
  if (error) throw error;
  return ((data ?? []) as Ligne[]).map((r) => {
    const criteres: Partial<Record<CritereColonne, number>> = {};
    for (const c of EVALUATION_TRAIT_FIELDS) {
      const v = Number(r[c]);
      if (r[c] != null && v > 0) criteres[c] = v;
    }
    return {
      id: r.id,
      organisation: r.organisation,
      coteGlobale: Number(r.cote_globale),
      criteres,
      grilleId: r.grille_id,
      updatedAt: r.updated_at,
      estLaMienne: !!r.est_la_mienne,
    };
  });
}

export interface ContexteEvaluation {
  peutEvaluer: boolean;
  grilleId: string | null;
}

export async function chargerContexteEvaluation(
  supabase: SupabaseClient,
  athleteId: string,
): Promise<ContexteEvaluation> {
  const { data, error } = await supabase.rpc("partenaire_evaluation_contexte", { p_athlete_id: athleteId });
  if (error) throw error;
  const r = (data as { peut_evaluer: boolean; grille_id: string | null }[] | null)?.[0];
  return { peutEvaluer: !!r?.peut_evaluer, grilleId: r?.grille_id ?? null };
}

/** Le serveur recalcule la cote quand un critère est noté (le détaillé
 *  gagne, comme chez le coach) ; `coteGlobale` ne compte qu'en mode simple. */
export async function enregistrerEvaluationPartenaire(
  supabase: SupabaseClient,
  athleteId: string,
  coteGlobale: number | null,
  criteres: Partial<Record<CritereColonne, number>>,
): Promise<void> {
  const { error } = await supabase.rpc("partenaire_evaluer_athlete", {
    p_athlete_id: athleteId,
    p_cote_globale: coteGlobale,
    p_traits: criteres,
  });
  if (error) throw error;
}

/** Moyenne des critères notés, arrondie au dixième — miroir du serveur. */
export function moyenneCriteres(criteres: Partial<Record<CritereColonne, number>>): number | null {
  const v = Object.values(criteres).filter((n): n is number => typeof n === "number" && n > 0);
  if (v.length === 0) return null;
  return Math.round((v.reduce((s, n) => s + n, 0) / v.length) * 10) / 10;
}
