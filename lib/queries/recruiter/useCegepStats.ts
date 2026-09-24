/* ═══════════════════════════════════════════════════════════════
   useCegepStats — TanStack hook (iter 5.3a)
   Groupe les ~10 queries séquentielles de la page Mon CÉGEP en un
   seul useQuery. staleTime 10 min car stats équipe peu volatiles.

   Lot 2a (2026-09-17) : le pipeline de l'équipe vient d'UN appel à
   `cegep_pipeline_overview` ; l'ancien N+1 par recruteur a disparu.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchCegepPipelineOverview } from "@/lib/pipeline/pipelineVues";
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

/** `recruteurs` : le filtre « sport de l'unité » (lot A) — null = tout le
 *  cégep, sinon les recruteurs retenus. `filtrePret` retient la requête tant
 *  que le choix n'est pas connu, pour ne pas charger deux fois. */
export function useCegepStats(recruteurs: Set<string> | null = null, filtrePret = true) {
  const { data: currentUser } = useCurrentUser();
  const schoolId = currentUser?.profile.school_id;
  const cleFiltre = recruteurs ? [...recruteurs].sort().join(",") : "tous";

  return useQuery<CegepStatsData>({
    queryKey: ["cegep-stats", schoolId, cleFiltre],
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
      const rList = (teamMembers ?? []).filter((r) => !recruteurs || recruteurs.has(r.id as string));
      const recruiterIds = rList.map((r) => r.id as string);
      const recruiterFullMap = new Map(rList.map((r) => [r.id as string, `${r.first_name || ""} ${r.last_name || ""}`]));

      if (recruiterIds.length === 0) return { ...EMPTY, schoolName };

      // 3. KPIs — le pipeline de l'équipe en UN appel.
      /* Lot 2a des frontières du pipeline : plus de lecture directe de
         `recruiter_pipeline` (la RLS « cegep admin read pipeline » donnait les
         lignes ENTIÈRES des collègues, notes de relance, visite et drapeau
         compris). `cegep_pipeline_overview` rend recruiter_id, athlete_id,
         stage et trois dates — même périmètre que la RLS, colonnes privées en
         moins. Les quatre lectures d'avant (compte, athlètes, par sport, par
         région) et la boucle N+1 par recruteur partent toutes de ce jeu. */
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [overview, messagesRes, viewsRes] = await Promise.all([
        fetchCegepPipelineOverview(supabase, recruiterIds),
        supabase.from("messages").select("*", { count: "exact", head: true }).in("sender_id", recruiterIds).gte("created_at", thirtyDaysAgo),
        supabase.from("recruiter_athlete_views").select("*", { count: "exact", head: true }).in("recruiter_id", recruiterIds).gte("viewed_at", thirtyDaysAgo),
      ]);
      const recruesCount = overview.filter((p) => p.stage === "LETTRE_SIGNEE").length;
      const uniqueAthletes = new Set(overview.map((p) => p.athlete_id));
      const pipelineCount = uniqueAthletes.size;
      const messagesCount = messagesRes.count ?? 0;
      const viewsCount = viewsRes.count ?? 0;

      /* Sport et région : ce que les embeds `athletes!athlete_id(...)` lisaient,
         relu à part. Même table, même RLS recruteur (athlètes ACTIF) — un
         athlète non visible retombe sur « Autre » / « Inconnue », comme l'embed
         nul d'avant. */
      const { data: athleteAttrs } = uniqueAthletes.size > 0
        ? await supabase
            .from("athletes")
            .select("id, sports!sport_id(nom), schools!school_id(region)")
            .in("id", [...uniqueAthletes])
        : { data: [] };
      const firstRel = <T,>(rel: T | T[] | null | undefined): T | null =>
        (Array.isArray(rel) ? rel[0] : rel) ?? null;
      const sportByAthlete = new Map<string, string>();
      const regionByAthlete = new Map<string, string>();
      for (const a of athleteAttrs ?? []) {
        const sport = firstRel(a.sports as { nom?: string } | { nom?: string }[] | null)?.nom;
        const region = firstRel(a.schools as { region?: string } | { region?: string }[] | null)?.region;
        if (sport) sportByAthlete.set(a.id as string, sport);
        if (region) regionByAthlete.set(a.id as string, region);
      }

      // 4. Pipeline par sport
      const sportMap = new Map<string, { consulted: number; favorited: number; contacted: number; recruited: number }>();
      for (const row of overview) {
        const sportName = sportByAthlete.get(row.athlete_id) || "Autre";
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

      // 5. Recruiter activity bar chart — compté sur le jeu déjà chargé
      // (l'ancienne boucle faisait une requête par recruteur).
      const rowsByRecruiter = new Map<string, number>();
      for (const p of overview) rowsByRecruiter.set(p.recruiter_id, (rowsByRecruiter.get(p.recruiter_id) || 0) + 1);
      const activityBars: { short: string; name: string; messages: number }[] = rList.map((r) => ({
        short: `${((r.first_name as string) || "")[0] || ""}. ${r.last_name || ""}`,
        name: `${r.first_name || ""} ${r.last_name || ""}`,
        messages: rowsByRecruiter.get(r.id as string) || 0,
      }));
      const recruiterActivity = activityBars.sort((a, b) => b.messages - a.messages);

      // 6. Provenance recrues (donut)
      const regionMap = new Map<string, number>();
      for (const row of overview) {
        if (row.stage !== "ENGAGE" && row.stage !== "LETTRE_SIGNEE") continue;
        const region = regionByAthlete.get(row.athlete_id) || "Inconnue";
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
    enabled: !!schoolId && filtrePret,
    staleTime: 10 * 60 * 1000,
  });
}
