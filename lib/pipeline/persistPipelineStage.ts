/* ═══════════════════════════════════════════════════════════════
   persistPipelineStage — écriture d'un changement de stage pipeline
   depuis la FICHE ATHLÈTE (desktop + mobile).

   Existait déjà pour le kanban (app/recruteur/pipeline/page.tsx) et le
   pipeline mobile (lib/queries/recruiter/useUpdatePipelineStage.ts) —
   mais PAS pour la fiche athlète, dont le handler ne faisait que
   setPipelineStatus() en state local : le stage était perdu au refresh.
   Ce helper est le point d'écriture partagé des deux fiches.

   ⚠️ Le kanban n'est PAS touché : il a sa propre mutation optimiste.

   TABLEAU BLANC (lot 2 de la 1.4.4) : les deux fiches écrivaient « ma
   ligne » — un upsert (rattrapé par la synchronisation d'unité) et, pour
   « Retiré », un DELETE de ma seule ligne : le dossier restait dans l'unité
   par les lignes des collègues et revenait. Désormais :
   unite_ecrire_dossier pour une étape, unite_retirer_du_processus pour un
   retrait (pour toute l'unité), comme Mon processus. Un gratuit est
   toujours refusé (user_has_pro) → « pro_required ».

   Règles :
   - `retire` n'est pas une étape : unite_retirer_du_processus (même
     sémantique que useRemoveFromPipeline).
   - `none` n'est pas un stage → no-op.
   - unite_ecrire_dossier couvre la ligne absente (créée, alignée sur
     l'unité) et la ligne existante.
   - visit_at suit lib/pipeline/regleVisite.ts (décision BP 2026-09-23) :
     il survit de « Visite planifiée » à « Lettre signée » et n'est effacé
     que si l'étape redescend SOUS « Visite planifiée ». (Avant : porté par
     VISITE_PLANIFIEE seulement, effacé en passant à « Engagé ».)
   - RLS : INSERT/UPDATE exigent user_has_pro() (tier pro | all_star).
     Un recruteur Free se fait refuser par Postgres → on renvoie
     { ok: false, reason: "pro_required" } pour un toast propre, pas un
     crash.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";
import { champVisitePourEtape, etapePorteVisite } from "@/lib/pipeline/regleVisite";

/** Stages acceptés par chk_recruiter_pipeline_stage. */
const DB_STAGES = [
  "IDENTIFIE",
  "CONTACTE",
  "EN_DISCUSSION",
  "VISITE_PLANIFIEE",
  "ENGAGE",
  "LETTRE_SIGNEE",
] as const;

export type PersistResult =
  | { ok: true; cleared: boolean }
  | { ok: false; reason: "unauthenticated" | "pro_required" | "invalid_stage" | "failed"; message?: string };

/** Postgres renvoie 42501 (insufficient_privilege) quand la policy RLS
 *  refuse l'écriture ; PostgREST remonte aussi 42501 sur un WITH CHECK
 *  violé. C'est notre signal « tier Free ». */
function isRlsDenial(code?: string, message?: string): boolean {
  if (code === "42501") return true;
  return !!message && /row-level security|violates row-level/i.test(message);
}

export interface PersistStageInput {
  athleteId: string;
  /** Statut UI, lowercase (RecruitmentStatus). */
  status: string;
  /** Instant ISO complet (date + heure éventuelle). Écrit seulement à partir
   *  de « Visite planifiée » ; absent → la date existante n'est pas touchée. */
  visitAtIso?: string;
}

export async function persistPipelineStage(
  { athleteId, status, visitAtIso }: PersistStageInput,
): Promise<PersistResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  // « Retiré » = sortie du processus, POUR TOUTE L'UNITÉ (tableau blanc).
  if (status === "retire") {
    const { error } = await supabase.rpc("unite_retirer_du_processus", { p_athlete_id: athleteId, p_sport_id: null });
    if (error) {
      return isRlsDenial(error.code, error.message)
        ? { ok: false, reason: "pro_required" }
        : { ok: false, reason: "failed", message: error.message };
    }
    return { ok: true, cleared: true };
  }

  const stage = status.toUpperCase();
  if (!(DB_STAGES as readonly string[]).includes(stage)) {
    return { ok: false, reason: "invalid_stage" };
  }

  // La ligne de l'acteur, créée au besoin et alignée sur l'unité, journal
  // signé (unite_ecrire_dossier). regleVisite : effacé sous « Visite
  // planifiée », sinon la date saisie ou — clé absente — la date existante.
  const { error } = await supabase.rpc("unite_ecrire_dossier", {
    p_athlete_id: athleteId,
    p_champs: { stage, ...champVisitePourEtape(stage, visitAtIso) },
  });

  if (error) {
    return isRlsDenial(error.code, error.message)
      ? { ok: false, reason: "pro_required" }
      : { ok: false, reason: "failed", message: error.message };
  }

  return { ok: true, cleared: !etapePorteVisite(stage) };
}

/** Le dossier de l'athlète tel que le voit l'acteur : celui de son UNITÉ
 *  (unite_pipeline — l'étape commune, posée par n'importe quel collègue),
 *  sinon sa propre ligne (gratuit, ou recruteur sans unité). Lu par les deux
 *  fiches (web et mobile) pour « Mon statut » et la date de visite.
 *  `collegues` : les ids des AUTRES recruteurs qui suivent ce dossier (la
 *  confirmation de retrait les nomme). */
export async function lireDossierActeur(
  athleteId: string,
): Promise<{ stage: string | null; visit_at: string | null; collegues: string[] } | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: unite, error } = await supabase.rpc("unite_pipeline", { p_sport_id: null, p_tout_le_cegep: false });
  if (!error) {
    const l = ((unite ?? []) as { athlete_id: string; stage: string | null; visit_at: string | null; recruteurs: string[] | null }[])
      .find((x) => x.athlete_id === athleteId);
    if (l) return { stage: l.stage, visit_at: l.visit_at, collegues: (l.recruteurs ?? []).filter((r) => r !== user.id) };
  }
  const { data } = await supabase
    .from("recruiter_pipeline").select("stage, visit_at")
    .eq("recruiter_id", user.id).eq("athlete_id", athleteId).maybeSingle();
  return data
    ? { stage: (data.stage as string | null) ?? null, visit_at: (data.visit_at as string | null) ?? null, collegues: [] }
    : null;
}
