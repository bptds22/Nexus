/* ═══════════════════════════════════════════════════════════════
   useCoachReputationStats — TanStack hook.

   Pulls the same data the desktop /coach/reputation page builds
   inline ([app/coach/reputation/page.tsx:53-183]) :
   - coach_reviews + athlete join (for review feed + criteria avgs)
   - athletes (roster, profile_completion avg)
   - recruiter_pipeline (LETTRE_SIGNEE count = totalPlacements)
   - conversations (avg response time)
   - users (coach identity + career fields)

   Cache key : ["coach-reputation", coachId]. Accepts an explicit
   coachId so it works for both surfaces :
   - own-view  : auth.uid() (default)
   - recruiter→coach view (future) : coach's id from route param

   The hook is consumed by MaReputationMobile and (when built) by
   /recruteur/coach/[id]/page.tsx.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { CoachReview, CoachBadge } from "@/lib/types/models";

export interface CoachReputationStats {
  coachId: string;
  /** Identity (for the hero block). */
  firstName: string;
  lastName: string;
  displayName: string;
  photoUrl: string | null;
  schoolName: string | null;
  teamName: string | null;
  /** Score + reviews. */
  reviews: CoachReview[];
  totalReviews: number;
  overallScore: number;
  recommendRate: number;
  /** Criteria avgs (each /5). 0 when no reviews. */
  profileQualityAvg: number;
  responsivenessAvg: number;
  honestyAvg: number;
  professionalismAvg: number;
  /** Badge tier derived from review count (BadgeGrid evaluates the
   *  earned/unearned thresholds itself). */
  badge: CoachBadge;
  hasPlaceurBadge: boolean;
  /** Stats pills. */
  totalPlacements: number;
  avgResponseTimeHours: number;
  profileCompletionRate: number;
  /** Career toggle seed values. */
  careerOpen: boolean;
  careerSports: string[];
  careerRegions: string[];
  careerRole?: "head" | "assistant" | "both";
  careerBio: string;
  /** Sports list (lookup for the career editor). */
  sportsList: string[];
  /** Computed public-score gate (≥3 reviews AND ≥3.0 avg). */
  isPublic: boolean;
}

export function useCoachReputationStats(coachId?: string | null) {
  const { data: currentUser } = useCurrentUser();
  const resolvedId = coachId ?? currentUser?.authUser.id ?? null;

  return useQuery<CoachReputationStats | null>({
    queryKey: ["coach-reputation", resolvedId],
    queryFn: async (): Promise<CoachReputationStats | null> => {
      if (!resolvedId) return null;
      const supabase = createClient();

      /* ── 1. Identity (users + school join) ────────────────── */
      const { data: u } = await supabase
        .from("users")
        .select(`
          first_name, last_name, avatar_url, photo_url,
          ouvert_entraineur_cegep, career_sports, career_regions, career_role, career_bio,
          schools!school_id(name)
        `)
        .eq("id", resolvedId)
        .single();

      const schoolRel = (u as Record<string, unknown> | null)?.schools;
      const schoolRow = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string } | null;

      /* The coach's primary team (when assigned). school_coaches →
         teams join. Optional — for the hero subtitle fallback. */
      let teamName: string | null = null;
      {
        const { data: tc } = await supabase
          .from("school_coaches")
          .select("teams(name)")
          .eq("user_id", resolvedId)
          .limit(1);
        const teamRel = (tc?.[0] as Record<string, unknown> | undefined)?.teams;
        const team = (Array.isArray(teamRel) ? teamRel[0] : teamRel) as { name?: string } | null;
        teamName = team?.name || null;
      }

      /* ── 2. Reviews + criteria averages ───────────────────── */
      const { data: reviewRows } = await supabase
        .from("coach_reviews")
        .select("*, athletes(first_name, last_name, position_id, positions!position_id(nom, abreviation))")
        .eq("coach_id", resolvedId)
        .order("created_at", { ascending: false });

      const reviews: CoachReview[] = (reviewRows || []).map((r: Record<string, unknown>) => {
        const ath = r.athletes as Record<string, unknown> | null;
        const posRaw = ath?.positions;
        const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
        const posObj = pos as { abreviation?: string; nom?: string } | null;
        return {
          id: r.id as string,
          coachId: r.coach_id as string,
          recruiterId: r.recruiter_id as string,
          conversationId: "",
          athleteId: (r.athlete_id as string) || "",
          athleteName: ath ? `${(ath.first_name as string) || ""} ${(ath.last_name as string) || ""}`.trim() : "",
          athletePosition: posObj?.abreviation || posObj?.nom || "",
          profileQuality: (r.qualite_profils as 1|2|3|4|5) || 3,
          responsiveness: (r.reactivite as 1|2|3|4|5) || 3,
          evaluationHonesty: (r.honnetete_evaluations as 1|2|3|4|5) || 3,
          professionalism: (r.professionnalisme as 1|2|3|4|5) || 3,
          overallScore: (r.note_globale as number) || 0,
          wouldRecommend: !!(r.recommande),
          comment: (r.commentaire as string) || undefined,
          coachReply: (r.reponse_coach as string) || undefined,
          createdAt: (r.created_at as string) || "",
          status: "active" as const,
        };
      });

      const totalReviews = reviews.length;
      let overallScore = 0;
      let recommendRate = 0;
      let profileQualityAvg = 0;
      let responsivenessAvg = 0;
      let honestyAvg = 0;
      let professionalismAvg = 0;
      if (totalReviews > 0) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        overallScore = parseFloat(avg(reviews.map((r) => r.overallScore)).toFixed(1));
        profileQualityAvg = parseFloat(avg(reviews.map((r) => r.profileQuality)).toFixed(1));
        responsivenessAvg = parseFloat(avg(reviews.map((r) => r.responsiveness)).toFixed(1));
        honestyAvg = parseFloat(avg(reviews.map((r) => r.evaluationHonesty)).toFixed(1));
        professionalismAvg = parseFloat(avg(reviews.map((r) => r.professionalism)).toFixed(1));
        const recCount = reviews.filter((r) => r.wouldRecommend).length;
        recommendRate = Math.round((recCount / totalReviews) * 100);
      }

      let badge: CoachBadge = "none";
      if (totalReviews >= 15) badge = "elite";
      else if (totalReviews >= 5) badge = "recommended";
      else if (totalReviews >= 3) badge = "evaluated";

      /* ── 3. Athletes + roster stats ───────────────────────── */
      const { data: athleteRows } = await supabase
        .from("athletes")
        .select("id, profile_completion")
        .eq("coach_id", resolvedId);
      const athleteIds = (athleteRows || []).map((a: { id: string }) => a.id);
      let profileCompletionRate = 0;
      if (athleteRows && athleteRows.length > 0) {
        const completions = athleteRows.map((a: { profile_completion: number | null }) => a.profile_completion || 0);
        profileCompletionRate = Math.round(
          completions.reduce((a: number, b: number) => a + b, 0) / completions.length,
        );
      }

      /* ── 4. Placements (LETTRE_SIGNEE) ────────────────────── */
      let totalPlacements = 0;
      if (athleteIds.length > 0) {
        const { count } = await supabase
          .from("recruiter_pipeline")
          .select("athlete_id", { count: "exact", head: true })
          .in("athlete_id", athleteIds)
          .eq("stage", "LETTRE_SIGNEE");
        totalPlacements = count || 0;
      }
      const hasPlaceurBadge = totalPlacements >= 5;

      /* ── 5. Avg response time from conversations ──────────── */
      let avgResponseTimeHours = 0;
      const { data: convRows } = await supabase
        .from("conversations")
        .select("created_at, last_message_at")
        .eq("coach_id", resolvedId);
      if (convRows && convRows.length > 0) {
        let totalHours = 0;
        let validCount = 0;
        for (const c of convRows) {
          const created = c.created_at as string;
          const lastMsg = c.last_message_at as string;
          if (created && lastMsg) {
            const diff = new Date(lastMsg).getTime() - new Date(created).getTime();
            if (diff > 0) {
              totalHours += diff / (1000 * 60 * 60);
              validCount++;
            }
          }
        }
        if (validCount > 0) avgResponseTimeHours = Math.round(totalHours / validCount);
      }

      /* ── 6. Sports list for the career editor ─────────────── */
      const { data: sportsData } = await supabase
        .from("sports")
        .select("nom")
        .order("nom");
      const sportsList = (sportsData || []).map((s: { nom: string }) => s.nom);

      const firstName = (u?.first_name as string) || "";
      const lastName = (u?.last_name as string) || "";
      const displayName = `${firstName} ${lastName}`.trim() || "Coach";
      const photoUrl = (u?.photo_url as string) || (u?.avatar_url as string) || null;

      return {
        coachId: resolvedId,
        firstName,
        lastName,
        displayName,
        photoUrl,
        schoolName: schoolRow?.name || null,
        teamName,
        reviews,
        totalReviews,
        overallScore,
        recommendRate,
        profileQualityAvg,
        responsivenessAvg,
        honestyAvg,
        professionalismAvg,
        badge,
        hasPlaceurBadge,
        totalPlacements,
        avgResponseTimeHours,
        profileCompletionRate,
        careerOpen: !!(u?.ouvert_entraineur_cegep),
        careerSports: (u?.career_sports as string[]) || [],
        careerRegions: (u?.career_regions as string[]) || [],
        careerRole: (u?.career_role as "head" | "assistant" | "both") || undefined,
        careerBio: (u?.career_bio as string) || "",
        sportsList,
        isPublic: totalReviews >= 3 && overallScore >= 3.0,
      };
    },
    enabled: !!resolvedId,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
