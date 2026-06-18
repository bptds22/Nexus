/* ═══════════════════════════════════════════════════════════════
   useDashboardKpi — TanStack hook (iter 5.2)
   Reproduit les blocs Action Bar + Pipeline counts + KPI Cards du
   useEffect dashboard. Groupe les queries Supabase connexes (toutes
   dépendent du même user.id + conversations) pour économiser un
   round-trip à chaque consult de dashboard.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { RecruiterActionBarData, RecruiterKpiData } from "@/app/recruteur/_data/mockDashboardData";

const STAGE_MAP: Record<string, string> = {
  IDENTIFIE: "identifie",
  CONTACTE: "contacte",
  EN_DISCUSSION: "en_discussion",
  VISITE_PLANIFIEE: "visite_planifiee",
  ENGAGE: "engage",
  LETTRE_SIGNEE: "lettre_signee",
  RETIRE: "retire",
};

export interface DashboardKpiResult {
  actionBarData: RecruiterActionBarData;
  pipelineCounts: Record<string, number>;
  kpiData: RecruiterKpiData;
}

export function useDashboardKpi() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<DashboardKpiResult>({
    queryKey: ["dashboard", "kpi", userId],
    queryFn: async (): Promise<DashboardKpiResult> => {
      const supabase = createClient();
      if (!userId) {
        return {
          actionBarData: { coachReplies: 0, newAthletesThisWeek: 0 },
          pipelineCounts: {},
          kpiData: { totalFavoris: 0, messagesSent: 0, responsesReceived: 0, responseRate: 0, upcomingVisits: 0 },
        };
      }
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // === Action Bar ===
      const { data: myConvs } = await supabase
        .from("conversations")
        .select("id")
        .eq("recruiter_id", userId);
      const convIds = (myConvs ?? []).map((c) => c.id);

      let coachReplies = 0;
      if (convIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .neq("sender_id", userId)
          .gte("created_at", sevenDaysAgo);
        coachReplies = count ?? 0;
      }

      const { count: newAthletes } = await supabase
        .from("athletes")
        .select("*", { count: "exact", head: true })
        .eq("status", "ACTIF")
        .gte("created_at", sevenDaysAgo);

      const actionBarData: RecruiterActionBarData = {
        coachReplies,
        newAthletesThisWeek: newAthletes ?? 0,
      };

      // === Pipeline ===
      const { data: pipeline } = await supabase
        .from("recruiter_pipeline")
        .select("stage")
        .eq("recruiter_id", userId);

      const pipelineCounts: Record<string, number> = {
        identifie: 0, contacte: 0, en_discussion: 0,
        visite_planifiee: 0, engage: 0, lettre_signee: 0, retire: 0,
      };
      for (const p of pipeline || []) {
        const key = STAGE_MAP[p.stage as string];
        if (key) pipelineCounts[key]++;
      }

      // === KPI: messages sent + responses ===
      const { count: messagesSent } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("sender_id", userId);

      let responsesReceived = 0;
      if (convIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .neq("sender_id", userId);
        responsesReceived = count ?? 0;
      }

      const kpiData: RecruiterKpiData = {
        totalFavoris: 0,
        messagesSent: messagesSent ?? 0,
        responsesReceived,
        responseRate: (messagesSent ?? 0) > 0 ? Math.round((responsesReceived / (messagesSent ?? 1)) * 100) : 0,
        upcomingVisits: pipelineCounts.visite_planifiee,
      };

      return { actionBarData, pipelineCounts, kpiData };
    },
    enabled: !!userId,
  });
}
