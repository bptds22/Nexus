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
  percentile: number | null;
  sportName: string;
  loading: boolean;
}

export interface AthleteVisibilityPro {
  cegepDetails: CegepDetail[];
  recruiterDetails: RecruiterDetail[];
  loading: boolean;
}

function deriveInterest(views: number, favCount: number, firstSeen: string): "fort" | "interesse" | "nouveau" {
  if (views >= 5 && favCount > 0) return "fort";
  if (views >= 3 || favCount > 0) return "interesse";
  const daysSinceFirst = (Date.now() - new Date(firstSeen).getTime()) / 86400000;
  if (daysSinceFirst <= 7) return "nouveau";
  return "interesse";
}

/* ═══════════════════════════════════════════════════════════════
   Free-tier hook: fetches only non-PII aggregates.
   Never selects recruiter_name or cegep_name — region breakdown
   is built from region-only columns.
═══════════════════════════════════════════════════════════════ */
const EMPTY_VISIBILITY: AthleteVisibility = {
  stats: { viewsThisMonth: 0, viewsLastMonth: 0, uniqueRecruiters: 0, totalFavorites: 0 },
  weeklyViews: [],
  regionBreakdown: [],
  percentile: null,
  sportName: "",
  loading: false,
};

// authInFlight-style coalescence: the athlete dashboard mounts this hook from
// ~17 components at once, which used to fire 17× getUser + athletes +
// get_sport_view_stats concurrently (a self-inflicted burst on the DB). One
// shared in-flight promise collapses every concurrent mount to a SINGLE
// round-trip. Cleared on settle so a later visit re-fetches fresh — no stale
// cache, pure concurrent-dedup. Errors clear it too, so a retry can re-fetch.
let _visibilityInFlight: Promise<AthleteVisibility> | null = null;

function loadAthleteVisibility(): Promise<AthleteVisibility> {
  if (_visibilityInFlight) return _visibilityInFlight;
  _visibilityInFlight = (async (): Promise<AthleteVisibility> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return EMPTY_VISIBILITY;

    const { data: athlete } = await supabase
      .from("athletes")
      .select("id, sport_id, sports!sport_id(nom)")
      .eq("user_id", user.id)
      .single();
    if (!athlete) return EMPTY_VISIBILITY;

    const athleteId = athlete.id;
    const sportName = (athlete as any).sports?.nom || "";

    const [statsRes, weeklyRes, regionsRes, percentileRes] = await Promise.all([
      supabase.from("athlete_visibility_stats").select("*").eq("athlete_id", athleteId).maybeSingle(),
      supabase.from("athlete_views_weekly").select("*").eq("athlete_id", athleteId),
      // Region-only column select — no recruiter_name, no cegep_name reaches the browser.
      supabase.from("athlete_view_details").select("cegep_region, visit_count").eq("athlete_id", athleteId),
      supabase.rpc("get_sport_view_stats", { p_athlete_id: athleteId }).maybeSingle(),
    ]);

    const stats = statsRes.data;
    const weekly = weeklyRes.data || [];
    const regionRows = regionsRes.data || [];

    const visStats: VisibilityStats = {
      viewsThisMonth: stats?.views_this_month || 0,
      viewsLastMonth: stats?.views_last_month || 0,
      uniqueRecruiters: stats?.unique_recruiters_total || 0,
      totalFavorites: stats?.total_favorites || 0,
    };

    const weeklyViews: WeeklyView[] = weekly.map((w: any) => ({
      weekStart: w.week_start,
      viewCount: Number(w.view_count) || 0,
    }));

    const regionMap = new Map<string, number>();
    for (const d of regionRows) {
      const region = (d as any).cegep_region || "Inconnue";
      regionMap.set(region, (regionMap.get(region) || 0) + Number((d as any).visit_count || 0));
    }
    const regionBreakdown: RegionBreakdown[] = Array.from(regionMap.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    const pctData = percentileRes.data as { percentile?: number } | null;
    const percentile: number | null = pctData?.percentile != null ? Number(pctData.percentile) : null;

    return { stats: visStats, weeklyViews, regionBreakdown, percentile, sportName, loading: false };
  })().finally(() => { _visibilityInFlight = null; });
  return _visibilityInFlight;
}

export default function useAthleteVisibility(): AthleteVisibility {
  const [data, setData] = useState<AthleteVisibility>({
    stats: { viewsThisMonth: 0, viewsLastMonth: 0, uniqueRecruiters: 0, totalFavorites: 0 },
    weeklyViews: [],
    regionBreakdown: [],
    percentile: null,
    sportName: "",
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    loadAthleteVisibility()
      .then((r) => { if (mounted) setData(r); })
      .catch(() => { if (mounted) setData(EMPTY_VISIBILITY); });
    return () => { mounted = false; };
  }, []);

  return data;
}

/* ═══════════════════════════════════════════════════════════════
   Pro-tier hook: fetches PII (recruiter names, cegep names).
   Must be called ONLY inside a FeatureGate-wrapped component so
   gated rows never reach the browser for free users.
═══════════════════════════════════════════════════════════════ */
export function useAthleteVisibilityPro(): AthleteVisibilityPro {
  const [data, setData] = useState<AthleteVisibilityPro>({
    cegepDetails: [],
    recruiterDetails: [],
    loading: true,
  });

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setData((d) => ({ ...d, loading: false })); return; }

      const { data: athlete } = await supabase
        .from("athletes")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!athlete) { setData((d) => ({ ...d, loading: false })); return; }

      const athleteId = athlete.id;

      /* Migration 20260616090000 closed the athlete_view_details RLS bypass :
         direct SELECT * on the view is now permission-denied for the PII
         columns (recruiter_name, cegep_name). The SECURITY DEFINER RPC
         get_my_athlete_view_details enforces ownership + user_has_pro at
         the DB layer ; returns ZERO rows for free users + anon + cross-
         athlete queries. The FeatureGate UI lock is now belt-and-braces
         on top of a real data-layer paywall. Column shape is identical
         to the view ; the mapping below is unchanged. */
      const [detailsRes, favsRes] = await Promise.all([
        supabase.rpc("get_my_athlete_view_details"),
        supabase.from("recruiter_favorites").select("recruiter_id").eq("athlete_id", athleteId),
      ]);

      const details = detailsRes.data || [];
      const favSet = new Set((favsRes.data || []).map((f: any) => f.recruiter_id));

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

      setData({ cegepDetails, recruiterDetails, loading: false });
    };

    load();
  }, []);

  return data;
}
