"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ActionBar from "./_components/ActionBar";
import KpiCards from "./_components/KpiCards";
import TrendingAthletes from "./_components/TrendingAthletes";
import RecruiterActivityFeed from "./_components/RecruiterActivityFeed";
import type { RecruiterActionBarData, RecruiterKpiData, TrendingAthlete } from "../_data/mockDashboardData";
import type { ActivityEvent } from "@/lib/types/activityEvents";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Recruiter Tableau de Bord
   Daily landing page — answers 5 questions in 5 seconds.
───────────────────────────────────────────────────────────────── */

const BLUE = "#E63946";

function frenchDate(): string {
  const d = new Date();
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── Quick Actions ─────────────────────────────────────────────── */

const iconBox = "w-10 h-10 rounded-lg bg-[#E63946]/15 flex items-center justify-center";

function QuickActions() {
  const actions = [
    { label: "Rechercher des athlètes", href: "/recruteur/recherche", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg> },
    { label: "Voir mes favoris", href: "/recruteur/favoris", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg> },
    { label: "Mes messages", href: "/recruteur/messages", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {actions.map((a) => (
        <Link key={a.href} href={a.href} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 flex items-center gap-4 hover:border-[#E63946]/40 hover:shadow-[0_0_16px_rgba(230,57,70,0.1)] transition-all group">
          <div className={iconBox}>{a.icon}</div>
          <span className="text-[14px] font-bold text-white group-hover:text-[#E63946] transition-colors">{a.label}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  );
}

/* ── Activity event type mapping ── */

const ACTION_TYPE_TO_EVENT: Record<string, { type: ActivityEvent["type"]; direction: "inbound" | "outbound"; priority: 1 | 2 | 3; icon: string; iconColor: string }> = {
  PIPELINE_CHANGED: { type: "status_engage", direction: "outbound", priority: 2, icon: "activity", iconColor: "#E63946" },
  FAVORITED: { type: "recruiter_favorited", direction: "outbound", priority: 2, icon: "heart", iconColor: "#E63946" },
  UNFAVORITED: { type: "recruiter_favorited", direction: "outbound", priority: 3, icon: "heart", iconColor: "#6B7280" },
  PROFILE_VIEWED: { type: "profile_updated_bulk", direction: "outbound", priority: 3, icon: "eye", iconColor: "#6B7280" },
  VIDEO_ADDED: { type: "video_added", direction: "inbound", priority: 2, icon: "video", iconColor: "#8B5CF6" },
  ATHLETE_VERIFIED: { type: "profile_verified", direction: "inbound", priority: 1, icon: "check-circle", iconColor: "#3B82F6" },
  PROFILE_UPDATED: { type: "profile_updated_bulk", direction: "inbound", priority: 2, icon: "edit", iconColor: "#6B7280" },
  NOTE_ADDED: { type: "scouting_report_updated", direction: "outbound", priority: 3, icon: "file-text", iconColor: "#F59E0B" },
  COACH_REPLY: { type: "coach_replied", direction: "inbound", priority: 1, icon: "message-circle", iconColor: "#22C55E" },
};

function getTimeGroup(iso: string): ActivityEvent["timeGroup"] {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return "Cette semaine";
  return "Semaine dernière";
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function RecruteurTableauDeBordPage() {
  const [loading, setLoading] = useState(true);
  const [headerName, setHeaderName] = useState("");
  const [headerSchool, setHeaderSchool] = useState("");

  const [actionBarData, setActionBarData] = useState<RecruiterActionBarData>({ coachReplies: 0, newAthletesThisWeek: 0 });
  const [kpiData, setKpiData] = useState<RecruiterKpiData>({ totalFavoris: 0, messagesSent: 0, responsesReceived: 0, responseRate: 0, upcomingVisits: 0 });
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
  const [trendingAthletes, setTrendingAthletes] = useState<TrendingAthlete[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Profile + school
      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, school_id, division, sport")
        .eq("id", user.id)
        .single();

      if (profile) {
        setHeaderName(`${profile.first_name || ""}`);
        if (profile.school_id) {
          const { data: school } = await supabase.from("schools").select("name").eq("id", profile.school_id).single();
          const div = (profile.division as string) ? `, ${profile.division}` : "";
          setHeaderSchool(`${school?.name || ""}${div}`);
        }
      }

      console.log("[Dashboard] profile:", profile?.first_name, profile?.last_name);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // === Action Bar ===
      // Coach replies = messages in my conversations where sender is NOT me
      const { data: myConvs } = await supabase.from("conversations").select("id").eq("recruiter_id", user.id);
      const convIds = myConvs?.map((c) => c.id) || [];
      let coachReplies = 0;
      if (convIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .neq("sender_id", user.id)
          .gte("created_at", sevenDaysAgo);
        coachReplies = count ?? 0;
      }

      const { count: newAthletes } = await supabase
        .from("athletes")
        .select("*", { count: "exact", head: true })
        .eq("status", "ACTIF")
        .gte("created_at", sevenDaysAgo);

      setActionBarData({ coachReplies, newAthletesThisWeek: newAthletes ?? 0 });
      console.log("[Dashboard] actionBar:", { coachReplies, newAthletes });

      // === Pipeline ===
      const { data: pipeline } = await supabase
        .from("recruiter_pipeline")
        .select("stage")
        .eq("recruiter_id", user.id);

      const counts: Record<string, number> = {
        identifie: 0, contacte: 0, en_discussion: 0,
        visite_planifiee: 0, engage: 0, lettre_signee: 0, retire: 0,
      };
      const STAGE_MAP: Record<string, string> = {
        IDENTIFIE: "identifie", CONTACTE: "contacte", EN_DISCUSSION: "en_discussion",
        VISITE_PLANIFIEE: "visite_planifiee", ENGAGE: "engage", LETTRE_SIGNEE: "lettre_signee", RETIRE: "retire",
      };
      for (const p of pipeline || []) {
        const key = STAGE_MAP[p.stage as string];
        if (key) counts[key]++;
      }
      setPipelineCounts(counts);

      // === KPI: Messages sent + responses ===
      const { count: messagesSent } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("sender_id", user.id);

      let responsesReceived = 0;
      if (convIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .neq("sender_id", user.id);
        responsesReceived = count ?? 0;
      }

      setKpiData({
        totalFavoris: 0,
        messagesSent: messagesSent ?? 0,
        responsesReceived,
        responseRate: (messagesSent ?? 0) > 0 ? Math.round((responsesReceived / (messagesSent ?? 1)) * 100) : 0,
        upcomingVisits: counts.visite_planifiee,
      });
      console.log("[Dashboard] kpi:", { messagesSent, responsesReceived });

      // === Trending Athletes (most viewed this week — both tables) ===
      const [{ data: viewsData }, { data: newViewsData }] = await Promise.all([
        supabase.from("recruiter_athlete_views")
          .select("athlete_id, athletes!athlete_id(first_name, last_name, cote_globale_entraineur, sports!sport_id(nom), positions!position_id(abreviation), schools!school_id(name))")
          .gte("viewed_at", sevenDaysAgo),
        supabase.from("profile_views")
          .select("athlete_id, athletes!athlete_id(first_name, last_name, cote_globale_entraineur, sports!sport_id(nom), positions!position_id(abreviation), schools!school_id(name))")
          .gte("viewed_at", sevenDaysAgo),
      ]);

      const allViews = [...(viewsData || []), ...(newViewsData || [])];
      if (allViews.length > 0) {
        // Group by athlete_id, count views
        const viewMap = new Map<string, { count: number; row: typeof allViews[0] }>();
        for (const v of allViews) {
          const existing = viewMap.get(v.athlete_id);
          if (existing) { existing.count++; }
          else { viewMap.set(v.athlete_id, { count: 1, row: v }); }
        }

        // Get fav counts for these athletes
        const athleteIds = Array.from(viewMap.keys());
        const { data: favData } = await supabase
          .from("recruiter_favorites")
          .select("athlete_id")
          .in("athlete_id", athleteIds);
        const favCountMap = new Map<string, number>();
        for (const f of favData || []) {
          favCountMap.set(f.athlete_id, (favCountMap.get(f.athlete_id) || 0) + 1);
        }

        const sorted = Array.from(viewMap.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 5);

        const trending: TrendingAthlete[] = sorted.map(([athId, { count, row }], i) => {
          const ath = row.athletes as unknown as {
            first_name?: string; last_name?: string; cote_globale_entraineur?: number;
            sports?: { nom?: string } | { nom?: string }[] | null;
            positions?: { abreviation?: string } | { abreviation?: string }[] | null;
            schools?: { name?: string } | { name?: string }[] | null;
          } | null;
          const sRel = ath?.sports; const sObj = Array.isArray(sRel) ? sRel[0] : sRel;
          const pRel = ath?.positions; const pObj = Array.isArray(pRel) ? pRel[0] : pRel;
          const schRel = ath?.schools; const schObj = Array.isArray(schRel) ? schRel[0] : schRel;
          return {
            id: athId,
            rank: i + 1,
            name: `${ath?.first_name || ""} ${ath?.last_name || ""}`.trim(),
            position: pObj?.abreviation || sObj?.nom || "",
            school: schObj?.name || "",
            stars: (ath?.cote_globale_entraineur as number) || 0,
            viewsThisWeek: count,
            favoritedBy: favCountMap.get(athId) || 0,
          };
        });
        setTrendingAthletes(trending);
        console.log("[Dashboard] trending:", trending.length);
      }

      // === Activity Feed ===
      const { data: activityData } = await supabase
        .from("recruiter_activity_log")
        .select("id, action_type, details, created_at, athlete_id")
        .eq("recruiter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (activityData) {
        const events: ActivityEvent[] = activityData.map((a) => {
          const details = (a.details as Record<string, unknown>) || {};
          const mapping = ACTION_TYPE_TO_EVENT[a.action_type] || { type: "profile_updated_bulk" as const, direction: "outbound" as const, priority: 3 as const, icon: "activity", iconColor: "#6B7280" };
          const athleteName = `${(details.first_name as string) || ""} ${(details.last_name as string) || ""}`.trim();

          // Relative time
          const diffMs = Date.now() - new Date(a.created_at).getTime();
          const diffMin = Math.floor(diffMs / 60000);
          let relativeTime = "À l'instant";
          if (diffMin >= 60) { const h = Math.floor(diffMin / 60); relativeTime = `Il y a ${h}h`; }
          else if (diffMin >= 1) { relativeTime = `Il y a ${diffMin} min`; }
          const diffDays = Math.floor(diffMs / 86400000);
          if (diffDays === 1) relativeTime = "Hier";
          else if (diffDays > 1 && diffDays < 7) relativeTime = `Il y a ${diffDays}j`;
          else if (diffDays >= 7) relativeTime = `Il y a ${Math.floor(diffDays / 7)} sem.`;

          return {
            id: a.id,
            type: mapping.type,
            direction: mapping.direction,
            priority: mapping.priority,
            icon: mapping.icon,
            iconColor: mapping.iconColor,
            timeGroup: getTimeGroup(a.created_at),
            timestamp: a.created_at,
            relativeTime,
            athleteId: a.athlete_id || undefined,
            athleteName: athleteName || undefined,
            message: `${athleteName || "Athlète"} — ${a.action_type.replace(/_/g, " ").toLowerCase()}`,
            actionLabel: "Voir",
            actionUrl: a.athlete_id ? `/recruteur/athletes/${a.athlete_id}` : undefined,
          };
        });
        setActivityEvents(events);
        console.log("[Dashboard] activities:", events.length);
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto">
        <p className="text-[#6b7280] text-sm">Chargement du tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-8">

      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Bienvenue, {headerName}{headerSchool ? ` — ${headerSchool}` : ""}
        </p>
        <p className="text-[12px] text-[#6b7280] mt-0.5 capitalize">{frenchDate()}</p>
      </div>

      {/* Zone 1: Action Bar */}
      <ActionBar data={actionBarData} />

      {/* Zone 2: KPI Cards + Pipeline */}
      <KpiCards data={kpiData} pipelineCounts={pipelineCounts} />

      {/* Zone 3 + 4: Trending Athletes + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <TrendingAthletes athletes={trendingAthletes} />
        </div>
        <div className="xl:col-span-2">
          <RecruiterActivityFeed events={activityEvents} />
        </div>
      </div>

      {/* Zone 5: Quick Actions */}
      <QuickActions />

    </div>
  );
}
