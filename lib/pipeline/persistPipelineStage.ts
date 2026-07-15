/* ═══════════════════════════════════════════════════════════════
   persistPipelineStage — écriture d'un changement de stage pipeline
   depuis la FICHE ATHLÈTE (desktop + mobile).

   Existait déjà pour le kanban (app/recruteur/pipeline/page.tsx) et le
   pipeline mobile (lib/queries/recruiter/useUpdatePipelineStage.ts) —
   mais PAS pour la fiche athlète, dont le handler ne faisait que
   setPipelineStatus() en state local : le stage était perdu au refresh.
   Ce helper est le point d'écriture partagé des deux fiches.

   ⚠️ Le kanban n'est PAS touché : il a sa propre mutation optimiste.

   Règles :
   - `retire` n'est pas une valeur légale de chk_recruiter_pipeline_stage
     → on DELETE la row (même sémantique que useRemoveFromPipeline).
   - `none` n'est pas un stage → no-op.
   - upsert sur la contrainte unique (recruiter_id, athlete_id) : couvre
     d'un coup la row absente (INSERT) et la row existante (UPDATE).
   - visit_at n'est porté QUE par VISITE_PLANIFIEE. Tout autre stage
     l'efface (NULL) — sinon une date de visite survivrait à un passage
     vers « Engagé » et on afficherait un rendez-vous fantôme.
   - RLS : INSERT/UPDATE exigent user_has_pro() (tier pro | all_star).
     Un recruteur Free se fait refuser par Postgres → on renvoie
     { ok: false, reason: "pro_required" } pour un toast propre, pas un
     crash.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";

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
  /** Instant ISO complet (date + heure éventuelle). Ignoré hors VISITE_PLANIFIEE. */
  visitAtIso?: string;
}

export async function persistPipelineStage(
  { athleteId, status, visitAtIso }: PersistStageInput,
): Promise<PersistResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const now = new Date().toISOString();

  // « Retiré » = sortie du pipeline → suppression de la row.
  if (status === "retire") {
    const { error } = await supabase
      .from("recruiter_pipeline")
      .delete()
      .eq("athlete_id", athleteId)
      .eq("recruiter_id", user.id);
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

  const isVisit = stage === "VISITE_PLANIFIEE";

  const { error } = await supabase
    .from("recruiter_pipeline")
    .upsert(
      {
        recruiter_id: user.id,
        athlete_id: athleteId,
        stage,
        moved_at: now,
        updated_at: now,
        // Porté par VISITE_PLANIFIEE uniquement ; effacé partout ailleurs.
        visit_at: isVisit ? (visitAtIso ?? null) : null,
      },
      { onConflict: "recruiter_id,athlete_id" },
    );

  if (error) {
    return isRlsDenial(error.code, error.message)
      ? { ok: false, reason: "pro_required" }
      : { ok: false, reason: "failed", message: error.message };
  }

  return { ok: true, cleared: !isVisit };
}
