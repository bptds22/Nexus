"use client";

import React, { useState, useEffect } from "react";
import FeatureGate from "@/components/subscription/FeatureGate";
import CegepGate from "@/components/subscription/CegepGate";
import KpiCard from "@/components/director/KpiCard";
import KpiCardRow from "@/components/director/KpiCardRow";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";

/* ── Helpers ──────────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  if (diffD < 30) return `il y a ${diffD}j`;
  const diffM = Math.floor(diffD / 30);
  return `il y a ${diffM} mois`;
}

/* ── Activity icon (SVG line icons) ── */

const ACTION_TYPE_MAP: Record<string, { icon: React.ReactNode; text: (d: Record<string, unknown>, rName: string) => React.ReactNode }> = {
  PIPELINE_CHANGED: {
    icon: (
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(230,57,70,0.15)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
      </span>
    ),
    text: (d, rName) => <><span className="text-white font-medium">{rName}</span> a changé le statut de <span className="text-white font-medium">{(d.first_name as string) || ""} {(d.last_name as string) || ""}</span></>,
  },
  FAVORITED: {
    icon: (
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(230,57,70,0.15)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
      </span>
    ),
    text: (d, rName) => <><span className="text-white font-medium">{rName}</span> a ajouté <span className="text-white font-medium">{(d.first_name as string) || ""} {(d.last_name as string) || ""}</span> aux favoris</>,
  },
  PROFILE_VIEWED: {
    icon: (
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(255,255,255,0.08)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      </span>
    ),
    text: (d, rName) => <><span className="text-white font-medium">{rName}</span> a consulté le profil de <span className="text-white font-medium">{(d.first_name as string) || ""} {(d.last_name as string) || ""}</span></>,
  },
  VIDEO_ADDED: {
    icon: (
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(139,92,246,0.15)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
      </span>
    ),
    text: (d) => <>Vidéo ajoutée pour <span className="text-white font-medium">{(d.first_name as string) || ""} {(d.last_name as string) || ""}</span></>,
  },
  ATHLETE_VERIFIED: {
    icon: (
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(59,130,246,0.15)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
      </span>
    ),
    text: (d) => <><span className="text-white font-medium">{(d.first_name as string) || ""} {(d.last_name as string) || ""}</span> a été vérifié</>,
  },
};

const defaultActivityIcon = (
  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(255,255,255,0.08)]">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
  </span>
);

/* ── Provenance donut ─────────────────────────────────────── */

const DONUT_COLORS = ["#E63946", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"];

function DonutChart({ data, colors, total }: { data: { region: string; count: number }[]; colors: string[]; total: number }) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 80;
  const innerR = 52;

  let cumAngle = -90;
  const segments = data.map((d, i) => {
    const angle = total > 0 ? (d.count / total) * 360 : 0;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    return { ...d, startAngle, endAngle, color: colors[i % colors.length] };
  });

  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(startDeg: number, endDeg: number, rOuter: number, rInner: number) {
    const s1 = polarToXY(startDeg, rOuter);
    const e1 = polarToXY(endDeg, rOuter);
    const s2 = polarToXY(endDeg, rInner);
    const e2 = polarToXY(startDeg, rInner);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M${s1.x},${s1.y} A${rOuter},${rOuter} 0 ${large} 1 ${e1.x},${e1.y} L${s2.x},${s2.y} A${rInner},${rInner} 0 ${large} 0 ${e2.x},${e2.y} Z`;
  }

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {total > 0 ? segments.map((seg, i) => (
          <path
            key={i}
            d={arcPath(seg.startAngle, seg.endAngle, outerR, innerR)}
            fill={seg.color}
            className="transition-opacity duration-200 hover:opacity-80"
            stroke="#1A1D24"
            strokeWidth="2"
          />
        )) : (
          <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="#2D3748" strokeWidth={outerR - innerR} />
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="28" fontWeight="900" fontFamily="var(--wl-font-head)">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#6B7280" fontSize="11">
          recrues
        </text>
      </svg>
      <div className="space-y-2.5 flex-1 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-[12px] text-[#9CA3AF] truncate flex-1">{seg.region}</span>
            <span className="text-[13px] font-bold text-white">{seg.count}</span>
          </div>
        ))}
        {data.length === 0 && <p className="text-[12px] text-[#4a4d56] italic">Aucune donnée</p>}
      </div>
    </div>
  );
}

/* ── Custom Recharts Tooltip ────────── */

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1D24] border border-[#2A2D35] rounded-lg px-3 py-2 text-[12px] shadow-lg">
      {label && <p className="text-[#9CA3AF] mb-0.5">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-white font-bold">
          {p.name ? `${p.name}: ` : ""}{p.value}
        </p>
      ))}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */

export default function Page() {
  return (
    <FeatureGate feature="cegep_management" requiredTier="all_star">
      <CegepDashboardWrapperContent />
    </FeatureGate>
  );
}

function CegepDashboardWrapperContent() {
  return <CegepGate><CegepDashboardContent /></CegepGate>;
}

interface ActivityRow {
  id: string;
  action_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
  recruiter_id: string;
}

function CegepDashboardContent() {
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState("Mon CÉGEP");

  // KPIs
  const [recruesCount, setRecruesCount] = useState(0);
  const [pipelineCount, setPipelineCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);

  // Charts
  const [pipelineBySport, setPipelineBySport] = useState<{ sport: string; consulted: number; favorited: number; contacted: number; recruited: number }[]>([]);
  const [recruiterActivity, setRecruiterActivity] = useState<{ short: string; name: string; messages: number }[]>([]);
  const [regionData, setRegionData] = useState<{ region: string; count: number }[]>([]);
  const [regionTotal, setRegionTotal] = useState(0);

  // Activity feed
  const [recentActivity, setRecentActivity] = useState<(ActivityRow & { recruiterName: string })[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get current user's school
      const { data: currentUser } = await supabase
        .from("users")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (!currentUser?.school_id) { setLoading(false); return; }

      // School name
      const { data: school } = await supabase
        .from("schools")
        .select("name")
        .eq("id", currentUser.school_id)
        .single();

      if (school) setSchoolName(school.name);

      // All team members at this school (coaches, recruiters, admins — anyone who may have pipeline data)
      const { data: teamMembers } = await supabase
        .from("users")
        .select("id, first_name, last_name, role")
        .eq("school_id", currentUser.school_id);

      const rList = teamMembers || [];
      const recruiterIds = rList.map((r) => r.id);
      const recruiterFullMap = new Map(rList.map((r) => [r.id, `${r.first_name || ""} ${r.last_name || ""}`]));

      console.log("[Mon CEGEP] school:", school?.name, "team members:", recruiterIds.length);

      if (recruiterIds.length === 0) { setLoading(false); return; }

      // === KPIs (parallel) ===
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [recruesRes, pipelineRes, messagesRes, viewsRes] = await Promise.all([
        supabase.from("recruiter_pipeline").select("*", { count: "exact", head: true }).in("recruiter_id", recruiterIds).eq("stage", "LETTRE_SIGNEE"),
        supabase.from("recruiter_pipeline").select("athlete_id").in("recruiter_id", recruiterIds),
        supabase.from("messages").select("*", { count: "exact", head: true }).in("sender_id", recruiterIds).gte("created_at", thirtyDaysAgo),
        supabase.from("recruiter_athlete_views").select("*", { count: "exact", head: true }).in("recruiter_id", recruiterIds).gte("viewed_at", thirtyDaysAgo),
      ]);

      setRecruesCount(recruesRes.count ?? 0);
      const uniqueAthletes = new Set(pipelineRes.data?.map((p) => p.athlete_id) || []);
      setPipelineCount(uniqueAthletes.size);
      setMessagesCount(messagesRes.count ?? 0);
      setViewsCount(viewsRes.count ?? 0);

      // === Pipeline par sport ===
      const { data: pipelineSports } = await supabase
        .from("recruiter_pipeline")
        .select("stage, athletes!athlete_id(sports!sport_id(nom))")
        .in("recruiter_id", recruiterIds);

      if (pipelineSports) {
        const sportMap = new Map<string, { consulted: number; favorited: number; contacted: number; recruited: number }>();
        for (const row of pipelineSports) {
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
        setPipelineBySport(
          Array.from(sportMap.entries())
            .map(([sport, counts]) => ({ sport, ...counts }))
            .sort((a, b) => (b.consulted + b.favorited + b.contacted + b.recruited) - (a.consulted + a.favorited + a.contacted + a.recruited))
        );
      }

      // === Recruiter activity bar chart ===
      const activityBars: { short: string; name: string; messages: number }[] = [];
      for (const r of rList) {
        const { count } = await supabase
          .from("recruiter_pipeline")
          .select("*", { count: "exact", head: true })
          .eq("recruiter_id", r.id);
        activityBars.push({
          short: `${(r.first_name || "")[0] || ""}. ${r.last_name || ""}`,
          name: `${r.first_name || ""} ${r.last_name || ""}`,
          messages: count || 0,
        });
      }
      setRecruiterActivity(activityBars.sort((a, b) => b.messages - a.messages));

      // === Provenance des recrues (donut) ===
      const { data: recrueRegions } = await supabase
        .from("recruiter_pipeline")
        .select("athletes!athlete_id(schools!school_id(region))")
        .in("recruiter_id", recruiterIds)
        .in("stage", ["ENGAGE", "LETTRE_SIGNEE"]);

      if (recrueRegions) {
        const regionMap = new Map<string, number>();
        for (const row of recrueRegions) {
          const athleteRel = row.athletes as unknown as { schools?: { region?: string } | { region?: string }[] | null } | null;
          const schoolRel = athleteRel?.schools;
          const schoolObj = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;
          const region = schoolObj?.region || "Inconnue";
          regionMap.set(region, (regionMap.get(region) || 0) + 1);
        }
        const regions = Array.from(regionMap.entries())
          .map(([region, count]) => ({ region, count }))
          .sort((a, b) => b.count - a.count);
        setRegionData(regions);
        setRegionTotal(regions.reduce((s, r) => s + r.count, 0));
      }

      // === Recent activity feed ===
      const { data: activityData } = await supabase
        .from("recruiter_activity_log")
        .select("id, action_type, details, created_at, recruiter_id")
        .in("recruiter_id", recruiterIds)
        .order("created_at", { ascending: false })
        .limit(10);

      if (activityData) {
        setRecentActivity(
          activityData.map((a) => ({
            ...a,
            details: (a.details as Record<string, unknown>) || {},
            recruiterName: recruiterFullMap.get(a.recruiter_id) || "Recruteur",
          }))
        );
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="px-5 sm:px-8 py-8 max-w-[1400px] mx-auto">
        <p className="text-[#6b7280] text-sm">Chargement du tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1
          className="font-head font-black text-white"
          style={{ fontSize: "28px" }}
        >
          Tableau de bord
        </h1>
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase bg-[#E63946]/15 text-[#E63946] px-3 py-1 rounded-full">
          {schoolName}
        </span>
      </div>

      {/* ── Section 1: KPI Cards ────────────────────────────── */}
      <KpiCardRow>
        <KpiCard
          label="Recrues confirmées"
          value={recruesCount}
          valueFontSize="48px"
          valueColor="#E63946"
          iconBgColor="rgba(230,57,70,0.15)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" /><path d="M12 3v12" /><path d="M5 21h14" /><circle cx="12" cy="3" r="2" />
            </svg>
          }
        />
        <KpiCard
          label="Athlètes dans le pipeline"
          value={pipelineCount}
          valueColor="#E63946"
          iconBgColor="rgba(230,57,70,0.15)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          }
        />
        <KpiCard
          label="Messages envoyés (30j)"
          value={messagesCount}
          valueColor="#22C55E"
          iconBgColor="rgba(34,197,94,0.15)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          }
        />
        <KpiCard
          label="Profils consultés (30j)"
          value={viewsCount}
          iconBgColor="rgba(255,255,255,0.1)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
      </KpiCardRow>

      {/* ── Section 2: Charts ───────────────────────────────── */}

      {/* Chart 1 — Pipeline par sport */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-head font-bold text-[15px]">Pipeline par sport</h2>
          <div className="flex items-center gap-4">
            {[
              { label: "Consultés", color: "#6B7280" },
              { label: "Favorisés", color: "#3B82F6" },
              { label: "Contactés", color: "#F59E0B" },
              { label: "Recrutés", color: "#E63946" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[11px] text-[#6B7280]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        {pipelineBySport.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, pipelineBySport.length * 40)}>
            <BarChart data={pipelineBySport} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="sport" width={90} tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="consulted" name="Consultés" stackId="a" fill="#6B7280" radius={[0, 0, 0, 0]} barSize={18} />
              <Bar dataKey="favorited" name="Favorisés" stackId="a" fill="#3B82F6" />
              <Bar dataKey="contacted" name="Contactés" stackId="a" fill="#F59E0B" />
              <Bar dataKey="recruited" name="Recrutés" stackId="a" fill="#E63946" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[13px] text-[#4a4d56] italic py-8 text-center">Aucun athlète dans le pipeline</p>
        )}
      </div>

      {/* Chart 2 + 3 — two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 2 — Activité des recruteurs */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className="text-white font-head font-bold text-[15px] mb-5">Activité des recruteurs</h2>
          {recruiterActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={recruiterActivity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="short" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""} />
                <Bar dataKey="messages" name="Pipeline" fill="#E63946" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-[#4a4d56] italic py-8 text-center">Aucun recruteur</p>
          )}
        </div>

        {/* Chart 3 — Provenance des recrues */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className="text-white font-head font-bold text-[15px] mb-5">Provenance des recrues</h2>
          <DonutChart data={regionData} colors={DONUT_COLORS} total={regionTotal} />
        </div>
      </div>

      {/* ── Section 3: Activité récente ─────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-head font-bold text-[16px]">Activité récente</h2>
          <Link href="/recruteur/cegep/activites" className="text-[13px] text-[#E63946] hover:text-[#D93C3C] font-semibold transition-colors">
            Voir tout →
          </Link>
        </div>
        <div className="space-y-0">
          {recentActivity.length > 0 ? recentActivity.map((a) => {
            const config = ACTION_TYPE_MAP[a.action_type];
            const details = a.details || {};
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 py-3 border-b border-[#2A2D35] last:border-0 rounded-lg transition-colors duration-150 hover:bg-[rgba(255,255,255,0.04)]"
              >
                {config?.icon || defaultActivityIcon}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#9CA3AF] leading-snug">
                    {config?.text(details, a.recruiterName) || <><span className="text-white font-medium">{a.recruiterName}</span> — {a.action_type}</>}
                  </p>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">{relativeTime(a.created_at)}</p>
                </div>
              </div>
            );
          }) : (
            <p className="text-[13px] text-[#4a4d56] italic py-4 text-center">Aucune activité récente</p>
          )}
        </div>
      </div>
    </div>
  );
}
