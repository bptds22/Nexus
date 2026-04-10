"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface VisibilityStats {
  viewsThisMonth: number;
  viewsLastMonth: number;
  uniqueRecruiters: number;
  totalFavorites: number;
}

export interface WeeklyView {
  weekStart: string;
  viewCount: number;
}

export interface RegionBreakdown {
  region: string;
  count: number;
}

export interface CegepDetail {
  cegepName: string;
  region: string;
  totalViews: number;
  recruiterCount: number;
  favCount: number;
  lastSeen: string;
  firstSeen: string;
  interestLevel: "fort" | "interesse" | "nouveau";
}

export interface RecruiterDetail {
  recruiterId: string;
  name: string;
  cegepName: string | null;
  viewCount: number;
  lastViewed: string;
  hasFavorited: boolean;
}

export interface AthleteVisibility {
  stats: VisibilityStats;
  weeklyViews: WeeklyView[];
  regionBreakdown: RegionBreakdown[];
  cegepDetails: CegepDetail[];
  recruiterDetails: RecruiterDetail[];
  percentile: number | null;
  sportName: string;
  loading: boolean;
}

function deriveInterest(views: number, favCount: number, firstSeen: string): "fort" | "interesse" | "nouveau" {
  if (views >= 5 && favCount > 0) return "fort";
  if (views >= 3 || favCount > 0) return "interesse";
  const daysSinceFirst = (Date.now() - new Date(firstSeen).getTime()) / 86400000;
  if (daysSinceFirst <= 7) return "nouveau";
  return "interesse";
}

export default function useAthleteVisibility(): AthleteVisibility {
  const [data, setData] = useState<AthleteVisibility>({
    stats: { viewsThisMonth: 0, viewsLastMonth: 0, uniqueRecruiters: 0, totalFavorites: 0 },
    weeklyViews: [],
    regionBreakdown: [],
    cegepDetails: [],
    recruiterDetails: [],
    percentile: null,
    sportName: "",
    loading: true,
  });

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setData((d) => ({ ...d, loading: false })); return; }

      // Get athlete record
      const { data: athlete } = await supabase
        .from("athletes")
        .select("id, sport_id, sports!sport_id(nom)")
        .eq("user_id", user.id)
        .single();
      if (!athlete) { setData((d) => ({ ...d, loading: false })); return; }

      const athleteId = athlete.id;
      const sportName = (athlete as any).sports?.nom || "";

      // Parallel queries
      const [statsRes, weeklyRes, detailsRes, favsRes, percentileRes] = await Promise.all([
        // 1. Aggregated stats
        supabase.from("athlete_visibility_stats").select("*").eq("athlete_id", athleteId).maybeSingle(),
        // 2. Weekly views
        supabase.from("athlete_views_weekly").select("*").eq("athlete_id", athleteId),
        // 3. View details (per recruiter)
        supabase.from("athlete_view_details").select("*").eq("athlete_id", athleteId),
        // 4. Favorites for this athlete
        supabase.from("recruiter_favorites").select("recruiter_id").eq("athlete_id", athleteId),
        // 5. Sport percentile via RPC
        supabase.rpc("get_sport_view_stats", { p_athlete_id: athleteId }).maybeSingle(),
      ]);

      const stats = statsRes.data;
      const weekly = weeklyRes.data || [];
      const details = detailsRes.data || [];
      const favSet = new Set((favsRes.data || []).map((f: any) => f.recruiter_id));

      // Stats
      const visStats: VisibilityStats = {
        viewsThisMonth: stats?.views_this_month || 0,
        viewsLastMonth: stats?.views_last_month || 0,
        uniqueRecruiters: stats?.unique_recruiters_total || 0,
        totalFavorites: stats?.total_favorites || 0,
      };

      // Weekly views (pad to 8 weeks)
      const weeklyViews: WeeklyView[] = weekly.map((w: any) => ({
        weekStart: w.week_start,
        viewCount: Number(w.view_count) || 0,
      }));

      // Region breakdown (from details)
      const regionMap = new Map<string, number>();
      for (const d of details) {
        const region = (d as any).cegep_region || "Inconnue";
        regionMap.set(region, (regionMap.get(region) || 0) + Number((d as any).visit_count || 0));
      }
      const regionBreakdown: RegionBreakdown[] = Array.from(regionMap.entries())
        .map(([region, count]) => ({ region, count }))
        .sort((a, b) => b.count - a.count);

      // CÉGEP details (group by cegep)
      const cegepMap = new Map<string, { region: string; totalViews: number; recruiterCount: number; lastSeen: string; firstSeen: string }>();
      for (const d of details) {
        const name = (d as any).cegep_name;
        if (!name) continue;
        const existing = cegepMap.get(name);
        const lastSeen = (d as any).last_viewed_at;
        const firstSeen = (d as any).first_viewed_at;
        const visits = Number((d as any).visit_count || 0);
        if (existing) {
          existing.totalViews += visits;
          existing.recruiterCount += 1;
          if (lastSeen > existing.lastSeen) existing.lastSeen = lastSeen;
          if (firstSeen < existing.firstSeen) existing.firstSeen = firstSeen;
        } else {
          cegepMap.set(name, { region: (d as any).cegep_region || "", totalViews: visits, recruiterCount: 1, lastSeen, firstSeen });
        }
      }
      // Count favorites per cegep (from favSet + user school)
      const cegepFavMap = new Map<string, number>();
      for (const d of details) {
        const name = (d as any).cegep_name;
        if (!name) continue;
        if (favSet.has((d as any).recruiter_id)) {
          cegepFavMap.set(name, (cegepFavMap.get(name) || 0) + 1);
        }
      }

      const cegepDetails: CegepDetail[] = Array.from(cegepMap.entries())
        .map(([cegepName, c]) => ({
          cegepName,
          region: c.region,
          totalViews: c.totalViews,
          recruiterCount: c.recruiterCount,
          favCount: cegepFavMap.get(cegepName) || 0,
          lastSeen: c.lastSeen,
          firstSeen: c.firstSeen,
          interestLevel: deriveInterest(c.totalViews, cegepFavMap.get(cegepName) || 0, c.firstSeen),
        }))
        .sort((a, b) => b.totalViews - a.totalViews);

      // Recruiter details (top 10)
      const recruiterDetails: RecruiterDetail[] = details
        .slice(0, 10)
        .map((d: any) => ({
          recruiterId: d.recruiter_id,
          name: d.recruiter_name || "Recruteur",
          cegepName: d.cegep_name || null,
          viewCount: Number(d.visit_count || 0),
          lastViewed: d.last_viewed_at,
          hasFavorited: favSet.has(d.recruiter_id),
        }));

      // Percentile from RPC
      const pctData = percentileRes.data as { percentile?: number } | null;
      const percentile: number | null = pctData?.percentile != null
        ? Number(pctData.percentile)
        : null;

      setData({
        stats: visStats,
        weeklyViews,
        regionBreakdown,
        cegepDetails,
        recruiterDetails,
        percentile,
        sportName,
        loading: false,
      });
    };

    load();
  }, []);

  return data;
}
