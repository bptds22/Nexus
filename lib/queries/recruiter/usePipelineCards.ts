/* ═══════════════════════════════════════════════════════════════
   usePipelineCards — TanStack hook (iter 5.3b)
   Fetch les cards pipeline du recruteur courant + competitorMap
   (stages des autres recruteurs sur les mêmes athlètes).
   Reproduit fidèlement le useEffect ligne 809+ du legacy.

   staleTime 60s — kanban peut bouger (autres recruteurs déplacent).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";

const STAGE_ORDER: Record<string, number> = {
  identifie: 1, contacte: 2, en_discussion: 3,
  visite_planifiee: 4, engage: 5, lettre_signee: 6,
};

export interface PipelineData {
  cards: PipelineKanbanCard[];
  competitorMap: Record<string, number>;
}

const EMPTY: PipelineData = { cards: [], competitorMap: {} };

export function usePipelineCards() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<PipelineData>({
    queryKey: ["pipeline", userId],
    queryFn: async (): Promise<PipelineData> => {
      if (!userId) return EMPTY;
      const supabase = createClient();

      const { data, error } = await supabase
        .from("recruiter_pipeline")
        .select(`
          id,
          recruiter_id,
          athlete_id,
          stage,
          notes,
          flagged,
          next_action_at,
          next_action_note,
          moved_at,
          created_at,
          updated_at,
          athletes!athlete_id(
            id,
            first_name,
            last_name,
            photo_url,
            verified,
            profile_completion,
            video_faits_saillants_url,
            annee_diplomation,
            numero_jersey,
            cote_globale_entraineur,
            recruitment_status,
            committed_school_id,
            school_id,
            open_to_offers,
            sports!sport_id(nom),
            positions!position_id(nom, abreviation),
            schools!school_id(name, region),
            committed_school:schools!committed_school_id(name)
          )
        `)
        .eq("recruiter_id", userId)
        .order("moved_at", { ascending: false });

      if (error) throw error;
      if (!data) return EMPTY;

      const mapped: PipelineKanbanCard[] = data.map((p: Record<string, unknown>) => {
        const aRaw = p.athletes;
        const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as Record<string, unknown> | null;
        const sportRel = a?.sports;
        const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
        const posRel = a?.positions;
        const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
        const schoolRel = a?.schools;
        const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string; region?: string } | null;
        const committedSchoolRel = a?.committed_school;
        const committedSchool = (Array.isArray(committedSchoolRel) ? committedSchoolRel[0] : committedSchoolRel) as { name?: string } | null;

        const movedAt = (p.moved_at as string) || (p.updated_at as string) || null;
        const daysSinceMove = movedAt ? Math.floor((Date.now() - new Date(movedAt).getTime()) / 86400000) : 0;
        const stageRaw = ((p.stage as string) || "IDENTIFIE").toLowerCase();

        return {
          id: (a?.id as string) || (p.athlete_id as string),
          pipeline_id: p.id as string,
          full_name: a ? `${a.first_name} ${a.last_name}` : "Athlète inconnu",
          photo_url: (a?.photo_url as string) || "",
          sport: sport?.nom || "",
          position: pos?.abreviation || "",
          school: school?.name || "",
          region: school?.region || "",
          division: "D1" as const,
          graduation_year: (a?.annee_diplomation as number) || 0,
          coach_rating: (a?.cote_globale_entraineur as number) || 0,
          profile_completeness: (a?.profile_completion as number) || 0,
          is_verified: !!a?.verified,
          has_video: !!a?.video_faits_saillants_url,
          jersey: a?.numero_jersey ? String(a.numero_jersey) : "",
          recruitment_status: (a?.recruitment_status as string) || "OUVERT",
          committed_school_name: committedSchool?.name || "",
          open_to_offers: (a?.open_to_offers as boolean | null) ?? null,
          status: stageRaw as RecruitmentStatus,
          days_in_status: daysSinceMove,
          notes: (p.notes as string) || "",
          last_activity: movedAt ? `Mis à jour il y a ${daysSinceMove} jours` : "",
          flagged: !!p.flagged,
          next_action_at: (p.next_action_at as string) || null,
          next_action_note: (p.next_action_note as string) || null,
          moved_at: movedAt,
          noTeam: !a?.school_id,
        } as PipelineKanbanCard;
      });

      // Competitor stages query — les autres recruteurs sur mes athlètes
      const athleteIds = mapped.map((c) => c.id);
      const competitorMap: Record<string, number> = {};
      if (athleteIds.length > 0) {
        const { data: competitorData } = await supabase
          .from("recruiter_pipeline")
          .select("athlete_id, stage")
          .in("athlete_id", athleteIds)
          .neq("recruiter_id", userId)
          .neq("stage", "RETIRÉ");

        if (competitorData) {
          for (const row of competitorData as { athlete_id: string; stage: string }[]) {
            const order = STAGE_ORDER[row.stage.toLowerCase()] ?? 0;
            if (!competitorMap[row.athlete_id] || order > competitorMap[row.athlete_id]) {
              competitorMap[row.athlete_id] = order;
            }
          }
        }
      }

      return { cards: mapped, competitorMap };
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}
