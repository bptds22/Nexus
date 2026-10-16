/* ═══════════════════════════════════════════════════════════════
   pipelineVues — les deux lectures du pipeline recruteur par QUELQU'UN
   D'AUTRE que le recruteur propriétaire (Lot 2a des frontières,
   docs/pipeline-recruteur-frontieres.md).

   La RLS PostgreSQL filtre des lignes, jamais des colonnes : tant que
   le coach et l'admin cégep lisaient `recruiter_pipeline` en direct,
   ils recevaient la ligne ENTIÈRE — `next_action_note`, `visit_at`,
   `flagged` compris, décidés privés au recruteur le 2026-09-17. Ces
   deux lectures passent donc par des RPC SECURITY DEFINER qui ne
   projettent que des colonnes publiques.

   Pourquoi des helpers plutôt que `supabase.rpc(...)` à chaque écran :
   sans types générés, `.rpc()` rend des lignes `any`. Les écrans qui
   lisaient `.select("…")` étaient typés par la chaîne de sélection ;
   la bascule leur retirait ce typage en silence (`ignoreBuildErrors`
   dans next.config masque l'erreur au build). Le type vit ici, une
   fois, en miroir exact du RETURNS TABLE.

   ⚠ Ne pas y ajouter de colonne privée : c'est précisément ce que ces
   RPC existent pour ne pas rendre.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { dossiersParUnite, type DossierUnite } from "@/lib/cegep/dossiersUnite";
import { lireTout } from "@/lib/supabase/lireTout";

/** Miroir de `coach_pipeline_for_my_athletes` — quatre colonnes, pas une de plus. */
export interface CoachPipelineRow {
  athlete_id: string;
  recruiter_id: string;
  stage: string;
  updated_at: string | null;
}

/**
 * Pipeline des athlètes du coach connecté, tous recruteurs confondus.
 * Périmètre serveur : athlètes dont il est `coach_id`, plus
 * `get_coach_athletes(true)` (équipes coachées ; toute l'école pour un
 * directeur). `athleteIds` et `stages` ne font que RESTREINDRE ce périmètre.
 * Correctif 2026-10-16 : TOUTES les lignes (lireTout — la RPC rend des lignes,
 * coupées à 1000 sans le dire) et une erreur est LEVÉE : un indicateur à 0
 * affirmait « aucun placement » alors qu'on n'en savait rien. L'écran
 * l'affiche, avec « Réessayer ».
 */
export async function lireCoachPipeline(
  supabase: SupabaseClient,
  opts: { athleteIds?: readonly string[]; stages?: readonly string[] } = {},
): Promise<CoachPipelineRow[]> {
  return lireTout<CoachPipelineRow>((de, a) => supabase
    .rpc("coach_pipeline_for_my_athletes", {
      p_athlete_ids: opts.athleteIds ?? null,
      p_stages: opts.stages ?? null,
    }, { count: "exact" })
    .order("athlete_id").order("recruiter_id")
    .range(de, a));
}

/** Variante qui ne lève jamais (liste vide, erreur journalisée) — pour les
 *  surfaces pas encore passées à l'affichage d'erreur (fiche athlète,
 *  réputation, mobile : lot mobile à venir). Les lignes sont complètes. */
export async function fetchCoachPipeline(
  supabase: SupabaseClient,
  opts: { athleteIds?: readonly string[]; stages?: readonly string[] } = {},
): Promise<CoachPipelineRow[]> {
  try {
    return await lireCoachPipeline(supabase, opts);
  } catch (e) {
    console.error("[pipeline] coach_pipeline_for_my_athletes :", e instanceof Error ? e.message : String(e));
    return [];
  }
}

/** Miroir de `cegep_pipeline_overview` — aucune colonne privée. */
export interface CegepPipelineRow {
  recruiter_id: string;
  athlete_id: string;
  stage: string;
  created_at: string | null;
  updated_at: string | null;
  moved_at: string | null;
}

/**
 * Pipeline des recruteurs `recruiterIds`, tel que l'appelant a le droit de le
 * voir : ses propres lignes, celles de ses collègues s'il est admin cégep,
 * tout s'il est admin plateforme (parité exacte avec l'ancienne RLS).
 */
export async function fetchCegepPipelineOverview(
  supabase: SupabaseClient,
  recruiterIds: readonly string[],
  stages?: readonly string[],
): Promise<CegepPipelineRow[]> {
  if (recruiterIds.length === 0) return [];
  // Toutes les lignes, erreur LEVÉE (correctif 2026-10-16, voir plus haut).
  return lireTout<CegepPipelineRow>((de, a) => supabase
    .rpc("cegep_pipeline_overview", {
      p_recruiter_ids: recruiterIds,
      p_stages: stages ?? null,
    }, { count: "exact" })
    .order("recruiter_id").order("athlete_id")
    .range(de, a));
}

/**
 * Les DOSSIERS des recruteurs `recruiterIds` (lot B2, étape 3) : le
 * pipeline de l'équipe, une ligne par athlète et par unité (cégep × sport),
 * à l'étape la plus avancée — voir lib/cegep/dossiersUnite.ts. À utiliser
 * dès qu'on COMPTE des athlètes : depuis B1, deux collègues d'une unité qui
 * suivent le même athlète ont chacun leur ligne.
 */
export async function fetchDossiersUniteCegep(
  supabase: SupabaseClient,
  recruiterIds: readonly string[],
  stages?: readonly string[],
): Promise<DossierUnite[]> {
  if (recruiterIds.length === 0) return [];
  const [lignes, sportsRes] = await Promise.all([
    fetchCegepPipelineOverview(supabase, recruiterIds, stages),
    supabase.from("users").select("id, sport_id").in("id", recruiterIds as string[]),
  ]);
  if (sportsRes.error) throw sportsRes.error;
  const sportParRecruteur = new Map<string, string | null>(
    ((sportsRes.data ?? []) as { id: string; sport_id: string | null }[]).map((u) => [u.id, u.sport_id]),
  );
  return dossiersParUnite(lignes, sportParRecruteur);
}
