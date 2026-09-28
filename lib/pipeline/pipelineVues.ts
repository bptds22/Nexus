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
 * En cas d'erreur : journalisée, liste vide — un indicateur à 0 plutôt
 * qu'un écran cassé.
 */
export async function fetchCoachPipeline(
  supabase: SupabaseClient,
  opts: { athleteIds?: readonly string[]; stages?: readonly string[] } = {},
): Promise<CoachPipelineRow[]> {
  const { data, error } = await supabase.rpc("coach_pipeline_for_my_athletes", {
    p_athlete_ids: opts.athleteIds ?? null,
    p_stages: opts.stages ?? null,
  });
  if (error) {
    console.error("[pipeline] coach_pipeline_for_my_athletes :", error.message);
    return [];
  }
  return (data ?? []) as CoachPipelineRow[];
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
  const { data, error } = await supabase.rpc("cegep_pipeline_overview", {
    p_recruiter_ids: recruiterIds,
    p_stages: stages ?? null,
  });
  if (error) {
    console.error("[pipeline] cegep_pipeline_overview :", error.message);
    return [];
  }
  return (data ?? []) as CegepPipelineRow[];
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
  if (sportsRes.error) console.error("[pipeline] sports de l'équipe :", sportsRes.error.message);
  const sportParRecruteur = new Map<string, string | null>(
    ((sportsRes.data ?? []) as { id: string; sport_id: string | null }[]).map((u) => [u.id, u.sport_id]),
  );
  return dossiersParUnite(lignes, sportParRecruteur);
}
