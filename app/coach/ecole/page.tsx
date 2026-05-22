"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SchoolGate from "@/components/subscription/SchoolGate";
import { useSubscription } from "@/lib/hooks/useSubscription";
import KpiCard from "@/components/director/KpiCard";
import KpiCardRow from "@/components/director/KpiCardRow";
import FunnelChart from "@/components/director/FunnelChart";
import type { CoachOverview } from "@/lib/types/models";
import { getCurrentSeason } from "@/lib/utils/season";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

/* ─── Helpers ──────────────────────────────────────────────── */

function completionColor(pct: number): string {
  if (pct >= 60) return "#3B82F6";
  return "#6B7280";
}

/* ─── Custom Recharts Tooltip ──────────────────────────────── */

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1D24] border border-[#2A2D35] rounded-lg px-3 py-2 text-[12px]">
      <p className="text-[#9CA3AF]">{label}</p>
      <p className="text-white font-bold">{payload[0].value} vues</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE COMPONENT
═══════════════════════════════════════════════════════════ */

export default function SchoolDashboardPage() {
  const { tier, canSee } = useSubscription();
  return <SchoolGate><SchoolDashboardContent /></SchoolGate>;
}

function SchoolDashboardContent() {
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState("");
  const [stats, setStats] = useState({
    totalAthletes: 0,
    avgProfileCompletion: 0,
    recruiterViews30d: 0,
    placementsSeason: 0,
    athletesTrend: 0,
    completionTrend: 0,
    viewsTrend: 0,
  });
  const [viewsBySport, setViewsBySport] = useState<{ sport: string; views: number }[]>([]);
  const [viewsTrendData, setViewsTrendData] = useState<{ month: string; views: number }[]>([]);
  const [funnelData, setFunnelData] = useState<{ stage: string; value: number; color: string }[]>([]);
  const [rankedCoaches, setRankedCoaches] = useState<CoachOverview[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get my school from school_coaches
      const { data: mySchool } = await supabase
        .from("school_coaches")
        .select("school_id")
        .eq("coach_id", user.id)
        .limit(1)
        .single();

      if (!mySchool) { setLoading(false); return; }

      // Get school name — try from users.school_id → schools
      const { data: userRow } = await supabase
        .from("users")
        .select("school_id")
        .eq("id", user.id)
        .single();
      if (userRow?.school_id) {
        const { data: school } = await supabase
          .from("schools")
          .select("name")
          .eq("id", userRow.school_id)
          .single();
        if (school) setSchoolName(school.name);
      }

      // Get all coaches at my school
      const { data: schoolCoaches } = await supabase
        .from("school_coaches")
        .select("coach_id, role, sport")
        .eq("school_id", mySchool.school_id);
      const coachIds = schoolCoaches?.map(sc => sc.coach_id) || [];

      // Get all athletes for these coaches
      const { data: athletes } = await supabase
        .from("athletes")
        .select("id, first_name, last_name, sport_id, coach_id, profile_completion")
        .in("coach_id", coachIds);
      const athleteList = athletes || [];
      const athleteIds = athleteList.map(a => a.id);

      // KPI 1: Total athletes
      const totalAthletes = athleteList.length;

      // KPI 2: Avg profile completion
      const avgCompletion = totalAthletes > 0
        ? Math.round(athleteList.reduce((sum, a) => sum + ((a.profile_completion as number) || 0), 0) / totalAthletes)
        : 0;

      // KPI 4: Placements (LETTRE_SIGNEE)
      let placementsCount = 0;
      if (athleteIds.length > 0) {
        const { count } = await supabase
          .from("recruiter_pipeline")
          .select("id", { count: "exact", head: true })
          .in("athlete_id", athleteIds)
          .eq("stage", "LETTRE_SIGNEE");
        placementsCount = count || 0;
      }

      setStats({
        totalAthletes,
        avgProfileCompletion: avgCompletion,
        recruiterViews30d: 0,
        placementsSeason: placementsCount,
        athletesTrend: 0,
        completionTrend: 0,
        viewsTrend: 0,
      });

      // Views by sport — zero for now
      const sportIds = [...new Set(athleteList.map(a => a.sport_id).filter(Boolean))];
      if (sportIds.length > 0) {
        const { data: sports } = await supabase
          .from("sports")
          .select("id, nom")
          .in("id", sportIds);
        if (sports) setViewsBySport(sports.map(s => ({ sport: s.nom, views: 0 })));
      }

      // Views trend — last 6 months with zeros
      const MONTHS = ["Jan.", "Fév.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sep.", "Oct.", "Nov.", "Déc."];
      const now = new Date();
      const trend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        trend.push({ month: MONTHS[d.getMonth()], views: 0 });
      }
      setViewsTrendData(trend);

      // Funnel — count pipeline by status
      if (athleteIds.length > 0) {
        const { data: pipelineEntries } = await supabase
          .from("recruiter_pipeline")
          .select("stage")
          .in("athlete_id", athleteIds);

        const counts: Record<string, number> = {};
        (pipelineEntries || []).forEach((p: { stage: string }) => {
          if (p.stage !== "NONE" && p.stage !== "RETIRE") {
            counts[p.stage] = (counts[p.stage] || 0) + 1;
          }
        });

        setFunnelData([
          { stage: "Identifiés", value: counts["IDENTIFIE"] || 0, color: "#3B82F6" },
          { stage: "Contactés", value: counts["CONTACTE"] || 0, color: "#8B5CF6" },
          { stage: "En discussion", value: counts["EN_DISCUSSION"] || 0, color: "#F59E0B" },
          { stage: "Visite planifiée", value: counts["VISITE_PLANIFIEE"] || 0, color: "#F97316" },
          { stage: "Engagés", value: counts["ENGAGE"] || 0, color: "#22C55E" },
          { stage: "Lettre signée", value: counts["LETTRE_SIGNEE"] || 0, color: "#E63946" },
        ]);
      }

      // Coach ranking
      if (coachIds.length > 0) {
        const { data: coachProfiles } = await supabase
          .from("users")
          .select("id, first_name, last_name, avatar_url")
          .in("id", coachIds);

        const coachOverviews: CoachOverview[] = (schoolCoaches || []).map(sc => {
          const profile = coachProfiles?.find(u => u.id === sc.coach_id);
          const coachAthletes = athleteList.filter(a => a.coach_id === sc.coach_id);
          const completed = coachAthletes.filter(a => ((a.profile_completion as number) || 0) >= 60).length;
          const total = coachAthletes.length;

          return {
            id: sc.coach_id,
            firstName: profile?.first_name || "",
            lastName: profile?.last_name || "",
            avatarUrl: profile?.avatar_url || undefined,
            sport: sc.sport || "",
            athleteCount: total,
            profilesCompleted: completed,
            profileCompletionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
            recruiterViews30d: 0,
            viewsTrend: 0,
            messagesReceived: 0,
            lastLoginAt: new Date().toISOString(),
            status: "active" as const,
            accountStatus: "ACTIF" as "ACTIF" | "DESACTIVE",
            deactivatedAt: null,
            deactivatedBy: null,
            deactivationReason: null,
          };
        });

        setRankedCoaches(
          coachOverviews.sort((a, b) => b.athleteCount - a.athleteCount).slice(0, 5)
        );
      }

      setLoading(false);
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
            Tableau de bord — Mon école
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Vue d&apos;ensemble de votre programme sportif
          </p>
        </div>

        <div className="flex items-center gap-3">
          {schoolName && (
            <span className="hidden sm:inline-flex items-center gap-2 bg-[#1A1D24] border border-[#2A2D35] rounded-full px-4 py-1.5 text-[13px] text-[#9CA3AF]">
              {schoolName}
            </span>
          )}
          <button className="relative p-2 text-[#6B7280] hover:text-white transition-colors">
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Section 1: KPI Cards ───────────────────────────── */}
      <KpiCardRow>
        <KpiCard
          label="Athl&egrave;tes inscrits"
          value={stats.totalAthletes}
          href="/coach/ecole/athletes"
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx={9} cy={7} r={4} />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          iconBgColor="rgba(255,255,255,0.1)"
          trend={stats.athletesTrend}
          trendLabel="vs mois dernier"
        />

        <KpiCard
          label="Profils compl&eacute;t&eacute;s"
          value={`${stats.avgProfileCompletion}%`}
          href="/coach/ecole/athletes?statut=completes"
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={completionColor(stats.avgProfileCompletion)} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          iconBgColor={
            stats.avgProfileCompletion >= 60
              ? "rgba(37,99,235,0.15)"
              : "rgba(107,114,128,0.15)"
          }
          trend={stats.completionTrend}
          trendLabel="%"
          progressPercent={stats.avgProfileCompletion}
          progressColor={completionColor(stats.avgProfileCompletion)}
        />

        <KpiCard
          label="Vues recruteurs (30j)"
          value={stats.recruiterViews30d}
          href="/coach/ecole/athletes?statut=vus"
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx={12} cy={12} r={3} />
            </svg>
          }
          iconBgColor="rgba(255,255,255,0.1)"
          trend={stats.viewsTrend}
        />

        <KpiCard
          label="Placements cette année"
          value={stats.placementsSeason}
          href="/coach/ecole/placements"
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          }
          iconBgColor="rgba(230,57,70,0.15)"
          valueFontSize="36px"
          valueColor="#E63946"
        />
      </KpiCardRow>

      {/* ── Section 2: Charts ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h3 className="font-head text-[15px] font-bold text-white mb-4">
            Vues par sport (30 derniers jours)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={viewsBySport}
              layout="vertical"
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="sport"
                width={90}
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="views" fill="#E63946" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h3 className="font-head text-[15px] font-bold text-white mb-4">
            Vues recruteurs &mdash; 6 derniers mois
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={viewsTrendData}
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(230,57,70,0.25)" />
                  <stop offset="100%" stopColor="rgba(230,57,70,0)" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<DarkTooltip />} cursor={false} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#E63946"
                strokeWidth={2}
                fill="url(#areaGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#FFFFFF", stroke: "#E63946", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Section 3: Funnel ──────────────────────────────── */}
      <FunnelChart
        title={`Pipeline de recrutement — Saison ${getCurrentSeason()}`}
        data={funnelData}
      />

      {/* ── Section 4: Coach ranking table ─────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="font-head text-[15px] font-bold text-white">
            Performance des coachs
          </h3>
          <p className="text-[12px] text-[#6B7280] mt-0.5">
            Class&eacute; par nombre d&apos;athlètes
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11px] text-[#6B7280] uppercase tracking-wider border-b border-[#2A2D35]">
                <th className="pb-2 pr-3 w-8">#</th>
                <th className="pb-2 pr-3">Coach</th>
                <th className="pb-2 pr-3">Sport</th>
                <th className="pb-2 pr-3 text-center">Athl&egrave;tes</th>
                <th className="pb-2 pr-3">Compl&eacute;tude</th>
                <th className="pb-2 text-right">Vues 30j</th>
              </tr>
            </thead>
            <tbody>
              {rankedCoaches.map((c, i) => {
                const pColor = completionColor(c.profileCompletionRate);
                const isFirst = i === 0;
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-[#2A2D35] last:border-0 cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.04)] ${
                      isFirst ? "bg-[rgba(230,57,70,0.06)]" : ""
                    }`}
                    onClick={() => window.location.href = `/coach/ecole/coachs/${c.id}`}
                  >
                    <td className="py-3 pr-3 text-[#6B7280] font-medium">{i + 1}</td>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/coach/ecole/coachs/${c.id}`}
                        className="text-white font-medium hover:text-[#E63946] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-[#9CA3AF]">{c.sport}</td>
                    <td className="py-3 pr-3 text-center text-[#9CA3AF]">{c.athleteCount}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[#2A2D35] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${c.profileCompletionRate}%`,
                              backgroundColor: pColor,
                            }}
                          />
                        </div>
                        <span className="text-[12px]" style={{ color: pColor }}>
                          {c.profileCompletionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-white font-semibold">
                      {c.recruiterViews30d}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-right">
          <Link
            href="/coach/ecole/coachs"
            className="text-[13px] text-[#E63946] hover:underline"
          >
            Voir tous les coachs &rarr;
          </Link>
        </div>
      </div>

      {/* ── Section 5: Recent activity ─────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-head text-[15px] font-bold text-white">
            Activit&eacute; r&eacute;cente
          </h3>
          <Link
            href="/coach/ecole/activites"
            className="text-[13px] text-[#E63946] hover:underline"
          >
            Voir tout &rarr;
          </Link>
        </div>

        <div className="space-y-0">
          <div className="py-8 text-center text-[13px] text-[#6B7280]">
            Aucune activité récente
          </div>
        </div>
      </div>
    </div>
  );
}
