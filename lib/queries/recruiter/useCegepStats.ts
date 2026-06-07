/* ═══════════════════════════════════════════════════════════════
   useCegepStats — TanStack hook (iter 5.3a)
   Groupe les ~10 queries séquentielles de la page Mon CÉGEP en un
   seul useQuery. staleTime 10 min car stats équipe peu volatiles.

   TODO: optimize N+1 in iter 5.5+ via RPC group-by (recruiterActivity
   ligne ~120 fait une query par recruiteur — acceptable pour <20
   recruteurs/école mais à refactor pour scale).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface CegepActivityRow {
  id: string;
  action_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
  recruiter_id: string;
}

export interface CegepStatsData {
  schoolName: string;
  recruesCount: number;
  pipelineCount: number;
  messagesCount: number;
  viewsCount: number;
  pipelineBySport: { sport: string; consulted: number; favorited: number; contacted: number; recruited: number }[];
  recruiterActivity: { short: string; name: string; messages: number }[];
  regionData: { region: string; count: number }[];
  regionTotal: number;
  recentActivity: (CegepActivityRow & { recruiterName: string })[];
}

const EMPTY: CegepStatsData = {
  schoolName: "Mon CÉGEP",
  recruesCount: 0, pipelineCount: 0, messagesCount: 0, viewsCount: 0,
  pipelineBySport: [],
  recruiterActivity: [],
  regionData: [],
  regionTotal: 0,
  recentActivity: [],
};

export function useCegepStats() {
  const { data: currentUser } = useCurrentUser();
  const schoolId = currentUser?.profile.school_id;

  return useQuery<CegepStatsData>({
    queryKey: ["cegep-stats", schoolId],
    queryFn: async (): Promise<CegepStatsData> => {
      if (!schoolId) return EMPTY;
      const supabase = createClient();

      // 1. School name
      const { data: school } = await supabase
        .from("schools").select("name").eq("id", schoolId).single();
      const schoolName = school?.name ?? "Mon CÉGEP";

      // 2. Team members
      const { data: teamMembers } = await supabase
        .from("users")
        .select("id, first_name, last_name, role")
        .eq("school_id", schoolId);
      const rList = teamMembers ?? [];
      const recruiterIds = rList.map((r) => r.id as string);
      const recruiterFullMap = new Map(rList.map((r) => [r.id as string, `${r.first_name || ""} ${r.last_name || ""}`]));

      if (recruiterIds.length === 0) return { ...EMPTY, schoolName };

      // 3. KPIs 4 queries parallèles
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [recruesRes, pipelineRes, messagesRes, viewsRes] = await Promise.all([
        supabase.from("recruiter_pipeline").select("*", { count: "exact", head: true }).in("recruiter_id", recruiterIds).eq("stage", "LETTRE_SIGNEE"),
        supabase.from("recruiter_pipeline").select("athlete_id").in("recruiter_id", recruiterIds),
        supabase.from("messages").select("*", { count: "exact", head: true }).in("sender_id", recruiterIds).gte("created_at", thirtyDaysAgo),
        supabase.from("recruiter_athlete_views").select("*", { count: "exact", head: true }).in("recruiter_id", recruiterIds).gte("viewed_at", thirtyDaysAgo),
      ]);
      const recruesCount = recruesRes.count ?? 0;
      const uniqueAthletes = new Set((pipelineRes.data ?? []).map((p) => p.athlete_id));
      const pipelineCount = uniqueAthletes.size;
      const messagesCount = messagesRes.count ?? 0;
      const viewsCount = viewsRes.count ?? 0;

      // 4. Pipeline par sport
      const { data: pipelineSports } = await supabase
        .from("recruiter_pipeline")
        .select("stage, athletes!athlete_id(sports!sport_id(nom))")
        .in("recruiter_id", recruiterIds);
      const sportMap = new Map<string, { consulted: number; favorited: number; contacted: number; recruited: number }>();
      for (const row of pipelineSports ?? []) {
        const athleteRel = row.athletes as unknown as { sports?: { nom?: string } | { nom?: string }[] | null } | null;
        const sportsRel = athleteRel?.sports;
        const sportObj = Array.isArray(sportsRel) ? sportsRel[0] : sportsRel;
        const sportName = sportObj?.nom || "Autre";
        if (!sportMap.has(sportName)) sportMap.set(sportName, { consulted: 0, favorited: 0, contacted: 0, recruited: 0 });
        const entry = sportMap.get(sportName)!;
        const stage = row.stage as string;
        if (stage === "IDENTIFIE") entry.consulted++;
        else if (stage === "CONTACTE") entry.contacted++;
        else if (stage === "EN_DISCUSSION" || stage === "VISITE_PLANIFIEE") entry.favorited++;
        else if (stage === "ENGAGE" || stage === "LETTRE_SIGNEE") entry.recruited++;
      }
      const pipelineBySport = Array.from(sportMap.entries())
        .map(([sport, counts]) => ({ sport, ...counts }))
        .sort((a, b) => (b.consulted + b.favorited + b.contacted + b.recruited) - (a.consulted + a.favorited + a.contacted + a.recruited));

      // 5. Recruiter activity bar chart (N+1 — TODO RPC group-by iter 5.5+)
      const activityBars: { short: string; name: string; messages: number }[] = [];
      for (const r of rList) {
        const { count } = await supabase
          .from("recruiter_pipeline")
          .select("*", { count: "exact", head: true })
          .eq("recruiter_id", r.id as string);
        activityBars.push({
          short: `${((r.first_name as string) || "")[0] || ""}. ${r.last_name || ""}`,
          name: `${r.first_name || ""} ${r.last_name || ""}`,
          messages: count || 0,
        });
      }
      const recruiterActivity = activityBars.sort((a, b) => b.messages - a.messages);

      // 6. Provenance recrues (donut)
      const { data: recrueRegions } = await supabase
        .from("recruiter_pipeline")
        .select("athletes!athlete_id(schools!school_id(region))")
        .in("recruiter_id", recruiterIds)
        .in("stage", ["ENGAGE", "LETTRE_SIGNEE"]);
      const regionMap = new Map<string, number>();
      for (const row of recrueRegions ?? []) {
        const athleteRel = row.athletes as unknown as { schools?: { region?: string } | { region?: string }[] | null } | null;
        const schoolRel = athleteRel?.schools;
        const schoolObj = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;
        const region = schoolObj?.region || "Inconnue";
        regionMap.set(region, (regionMap.get(region) || 0) + 1);
      }
      const regionData = Array.from(regionMap.entries())
        .map(([region, count]) => ({ region, count }))
        .sort((a, b) => b.count - a.count);
      const regionTotal = regionData.reduce((s, r) => s + r.count, 0);

      // 7. Activity feed
      const { data: activityData } = await supabase
        .from("recruiter_activity_log")
        .select("id, action_type, details, created_at, recruiter_id")
        .in("recruiter_id", recruiterIds)
        .order("created_at", { ascending: false })
        .limit(10);
      const recentActivity = (activityData ?? []).map((a): CegepActivityRow & { recruiterName: string } => ({
        id: a.id as string,
        action_type: a.action_type as string,
        details: (a.details as Record<string, unknown>) || {},
        created_at: a.created_at as string,
        recruiter_id: a.recruiter_id as string,
        recruiterName: recruiterFullMap.get(a.recruiter_id as string) || "Recruteur",
      }));

      return {
        schoolName,
        recruesCount, pipelineCount, messagesCount, viewsCount,
        pipelineBySport,
        recruiterActivity,
        regionData,
        regionTotal,
        recentActivity,
      };
    },
    enabled: !!schoolId,
    staleTime: 10 * 60 * 1000,
  });
}
