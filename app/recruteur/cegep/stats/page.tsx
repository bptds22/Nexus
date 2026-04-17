"use client";

import { useState, useEffect, useMemo } from "react";
import StarRating from "@/components/ui/StarRating";
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

/* ── Dark Recharts tooltip ───────────────────────────────── */

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

/* ── Types ── */

interface FunnelData {
  identified: number;
  contacted: number;
  in_discussion: number;
  visit_planned: number;
  engaged: number;
  signed: number;
}

interface RecruiterPerf {
  recruiter_id: string;
  name: string;
  identified: number;
  contacted: number;
  in_discussion: number;
  visits: number;
  signed: number;
  conversion_rate: number;
  avg_days_to_sign: number;
  activity_7d: number;
}

interface SportRow {
  sport: string;
  consulted: number;
  favorited: number;
  contacted: number;
  recruited: number;
}

interface TopTarget {
  athleteId: string;
  rank: number;
  rating: number;
  name: string;
  sport: string;
  position: string;
  recruiterName: string;
  stage: string;
  pipelineStatus: string;
}

/* ══════════════════════════════════════════════════════════════
   PAGE — Stats de recrutement
══════════════════════════════════════════════════════════════ */

export default function CegepStatsWrapper() {
  return <CegepGate><CegepStatsPage /></CegepGate>;
}

type TeamMember = { id: string; first_name: string | null; last_name: string | null };
// Pipeline row shape returned by Supabase — loosely typed since the join structure is complex
type PipelineRow = {
  recruiter_id: string;
  athlete_id: string;
  stage: string;
  created_at?: string;
  updated_at?: string;
  athletes?: unknown;
};

function extractPipelineSport(row: PipelineRow): { id: string | null; name: string } {
  const athletes = row?.athletes;
  const aObj = Array.isArray(athletes) ? athletes[0] : athletes;
  const sport_id = (aObj as { sport_id?: string } | null)?.sport_id ?? null;
  const sportsRel = (aObj as { sports?: unknown } | null)?.sports;
  const sObj = Array.isArray(sportsRel) ? sportsRel[0] : sportsRel;
  const name = (sObj as { nom?: string } | null)?.nom || "Autre";
  return { id: sport_id, name };
}

function CegepStatsPage() {
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState("CÉGEP");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [rawPipeline, setRawPipeline] = useState<PipelineRow[]>([]);
  const [sports, setSports] = useState<{ id: string; nom: string }[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string>("all");
  const [sportData, setSportData] = useState<SportRow[]>([]);
  const [contactsCount, setContactsCount] = useState(0);

  const [recruiterSort, setRecruiterSort] = useState<{ col: string; dir: "asc" | "desc" }>({ col: "signed", dir: "desc" });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Sports list for the filter dropdown
      const { data: sportsList } = await supabase.from("sports").select("id, nom").order("nom");
      setSports(sportsList || []);

      const { data: currentUser } = await supabase.from("users").select("school_id").eq("id", user.id).single();
      if (!currentUser?.school_id) { setLoading(false); return; }

      const { data: school } = await supabase.from("schools").select("name").eq("id", currentUser.school_id).single();
      if (school) setSchoolName(school.name);

      const { data: teamData } = await supabase.from("users").select("id, first_name, last_name").eq("school_id", currentUser.school_id);
      const teamList: TeamMember[] = teamData || [];
      setTeam(teamList);
      const teamIds = teamList.map((t) => t.id);
      if (teamIds.length === 0) { setLoading(false); return; }

      // Contacts initiés — count conversations started by team members
      const { count: convCount } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .in("recruiter_id", teamIds);
      setContactsCount(convCount ?? 0);

      // Get ALL pipeline entries (include sport_id for client-side sport filtering)
      const { data: allPipeline } = await supabase
        .from("recruiter_pipeline")
        .select("recruiter_id, athlete_id, stage, created_at, updated_at, athletes!athlete_id(sport_id, first_name, last_name, sports!sport_id(nom), positions!position_id(abreviation), evaluations(cote_globale))")
        .in("recruiter_id", teamIds);

      const pipeline: PipelineRow[] = allPipeline || [];
      console.log("[Stats] loaded", pipeline.length, "pipeline entries");
      setRawPipeline(pipeline);

      // === SPORT BREAKDOWN (separate queries for each column) ===
      const sportMap = new Map<string, SportRow>();
      const ensureSport = (name: string) => {
        if (!sportMap.has(name)) sportMap.set(name, { sport: name, consulted: 0, favorited: 0, contacted: 0, recruited: 0 });
        return sportMap.get(name)!;
      };
      const extractSport = (row: unknown): string => {
        const rel = (row as { athletes?: { sports?: { nom?: string } | { nom?: string }[] | null } | null })?.athletes;
        const sRel = rel?.sports;
        const sObj = Array.isArray(sRel) ? sRel[0] : sRel;
        return sObj?.nom || "Autre";
      };

      // Consultés = unique athletes viewed per sport
      const { data: viewsBySport } = await supabase
        .from("recruiter_athlete_views")
        .select("athlete_id, athletes!athlete_id(sports!sport_id(nom))")
        .in("recruiter_id", teamIds);
      const viewedByAthlete = new Set<string>();
      for (const v of (viewsBySport || [])) {
        const key = `${v.athlete_id}`;
        if (viewedByAthlete.has(key)) continue;
        viewedByAthlete.add(key);
        ensureSport(extractSport(v)).consulted++;
      }

      // Favorisés = athletes in recruiter_favorites per sport
      const { data: favsBySport } = await supabase
        .from("recruiter_favorites")
        .select("athletes!athlete_id(sports!sport_id(nom))")
        .in("recruiter_id", teamIds);
      for (const f of favsBySport || []) {
        ensureSport(extractSport(f)).favorited++;
      }

      // Contactés = pipeline CONTACTE or higher per sport
      const CONTACTED_STAGES = ["CONTACTE", "EN_DISCUSSION", "VISITE_PLANIFIEE", "ENGAGE", "LETTRE_SIGNEE"];
      for (const p of pipeline) {
        if (CONTACTED_STAGES.includes(p.stage as string)) {
          ensureSport(extractSport(p)).contacted++;
        }
      }

      // Recrutés = pipeline ENGAGE or LETTRE_SIGNEE per sport
      for (const p of pipeline) {
        if (p.stage === "ENGAGE" || p.stage === "LETTRE_SIGNEE") {
          ensureSport(extractSport(p)).recruited++;
        }
      }

      setSportData(Array.from(sportMap.values()).sort((a, b) => (b.consulted + b.favorited + b.contacted + b.recruited) - (a.consulted + a.favorited + a.contacted + a.recruited)));

      setLoading(false);
    }
    load();
  }, []);

  /* === Filter-derived data === */
  const STAGE_MAP: Record<string, keyof FunnelData> = {
    IDENTIFIE: "identified",
    CONTACTE: "contacted",
    EN_DISCUSSION: "in_discussion",
    VISITE_PLANIFIEE: "visit_planned",
    ENGAGE: "engaged",
    LETTRE_SIGNEE: "signed",
  };

  /* Sports that have at least one pipeline entry — used to populate the dropdown */
  const activeSports = useMemo(() => {
    const ids = new Set<string>();
    for (const p of rawPipeline) {
      const { id } = extractPipelineSport(p);
      if (id) ids.add(id);
    }
    return sports.filter((s) => ids.has(s.id));
  }, [rawPipeline, sports]);

  /* Pipeline filtered by the currently selected sport (or all) */
  const filteredPipeline = useMemo(() => {
    if (selectedSportId === "all") return rawPipeline;
    return rawPipeline.filter((p) => extractPipelineSport(p).id === selectedSportId);
  }, [rawPipeline, selectedSportId]);

  /* Global funnel — always from unfiltered pipeline, drives the top KPI bar */
  const globalFunnel = useMemo<FunnelData>(() => {
    const counts: FunnelData = { identified: 0, contacted: 0, in_discussion: 0, visit_planned: 0, engaged: 0, signed: 0 };
    for (const p of rawPipeline) {
      const key = STAGE_MAP[p.stage];
      if (key) counts[key]++;
    }
    counts.identified = rawPipeline.length;
    return counts;
  }, [rawPipeline]);

  /* Filtered funnel — drives the "Entonnoir de recrutement" section */
  const funnel = useMemo<FunnelData>(() => {
    const counts: FunnelData = { identified: 0, contacted: 0, in_discussion: 0, visit_planned: 0, engaged: 0, signed: 0 };
    for (const p of filteredPipeline) {
      const key = STAGE_MAP[p.stage];
      if (key) counts[key]++;
    }
    counts.identified = filteredPipeline.length;
    return counts;
  }, [filteredPipeline]);

  /* Recruiter performance — respects the sport filter */
  const recruiterPerf = useMemo<RecruiterPerf[]>(() => {
    const perfMap = new Map<string, RecruiterPerf>();
    for (const t of team) {
      perfMap.set(t.id, {
        recruiter_id: t.id,
        name: `${t.first_name || ""} ${t.last_name || ""}`.trim(),
        identified: 0, contacted: 0, in_discussion: 0, visits: 0, signed: 0,
        conversion_rate: 0, avg_days_to_sign: 0, activity_7d: 0,
      });
    }
    for (const p of filteredPipeline) {
      const perf = perfMap.get(p.recruiter_id);
      if (!perf) continue;
      const stage = p.stage;
      if (stage === "IDENTIFIE") perf.identified++;
      else if (stage === "CONTACTE") perf.contacted++;
      else if (stage === "EN_DISCUSSION") perf.in_discussion++;
      else if (stage === "VISITE_PLANIFIEE") perf.visits++;
      else if (stage === "ENGAGE" || stage === "LETTRE_SIGNEE") perf.signed++;
    }
    for (const perf of perfMap.values()) {
      const total = perf.identified + perf.contacted + perf.in_discussion + perf.visits + perf.signed;
      perf.conversion_rate = total > 0 ? Math.round((perf.signed / total) * 100) : 0;
      perf.activity_7d = total > 0 ? Math.min(total / 20, 1) : 0;
    }
    return Array.from(perfMap.values());
  }, [filteredPipeline, team]);

  /* Per-sport mini-funnel — always shows global breakdown regardless of selected filter */
  type PerSportRow = { id: string; name: string; identified: number; contacted: number; in_discussion: number; visit_planned: number; engaged: number; signed: number };
  const perSportFunnel = useMemo<PerSportRow[]>(() => {
    const byId = new Map<string, PerSportRow>();
    for (const p of rawPipeline) {
      const { id, name } = extractPipelineSport(p);
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, { id, name, identified: 0, contacted: 0, in_discussion: 0, visit_planned: 0, engaged: 0, signed: 0 });
      const row = byId.get(id)!;
      row.identified++;
      const key = STAGE_MAP[p.stage];
      if (key && key !== "identified") row[key]++;
    }
    return Array.from(byId.values()).sort((a, b) => b.identified - a.identified);
  }, [rawPipeline]);

  /* Top 10 athlètes ciblés — respects sport filter, sorts by pipeline stage (most advanced first), rating as tiebreaker */
  const topTargets = useMemo<TopTarget[]>(() => {
    const STAGE_ORDER: Record<string, number> = {
      LETTRE_SIGNEE: 6,
      ENGAGE: 5,
      VISITE_PLANIFIEE: 4,
      EN_DISCUSSION: 3,
      CONTACTE: 2,
      IDENTIFIE: 1,
    };
    const STAGE_LABELS: Record<string, string> = {
      IDENTIFIE: "Identifié", CONTACTE: "Contacté", EN_DISCUSSION: "En discussion",
      VISITE_PLANIFIEE: "Visite", ENGAGE: "Engagé", LETTRE_SIGNEE: "Signé",
    };
    const teamNameMap = new Map(team.map((t) => [t.id, `${t.first_name || ""} ${t.last_name || ""}`.trim()]));

    const targets = filteredPipeline
      .map((p) => {
        const athleteRel = p.athletes as unknown as {
          first_name?: string; last_name?: string;
          sports?: { nom?: string } | { nom?: string }[] | null;
          positions?: { abreviation?: string } | { abreviation?: string }[] | null;
          evaluations?: { cote_globale?: number }[] | { cote_globale?: number } | null;
        } | null;
        const sportsRel = athleteRel?.sports;
        const sportObj = Array.isArray(sportsRel) ? sportsRel[0] : sportsRel;
        const posRel = athleteRel?.positions;
        const posObj = Array.isArray(posRel) ? posRel[0] : posRel;
        const evalRel = athleteRel?.evaluations;
        const evalObj = Array.isArray(evalRel) ? evalRel[0] : evalRel;
        return {
          athleteId: p.athlete_id,
          rank: 0,
          rating: (evalObj?.cote_globale as number) || 0,
          name: `${athleteRel?.first_name || ""} ${athleteRel?.last_name || ""}`.trim(),
          sport: sportObj?.nom || "",
          position: posObj?.abreviation || "",
          recruiterName: teamNameMap.get(p.recruiter_id) || "",
          stage: p.stage,
          pipelineStatus: STAGE_LABELS[p.stage] || p.stage,
        };
      })
      .sort((a, b) => {
        const stageA = STAGE_ORDER[a.stage] || 0;
        const stageB = STAGE_ORDER[b.stage] || 0;
        if (stageB !== stageA) return stageB - stageA;
        return b.rating - a.rating;
      })
      .slice(0, 10)
      .map((t, i) => ({ ...t, rank: i + 1 }));

    console.log("[Stats] topTargets recomputed — count:", targets.length, "filter:", selectedSportId);
    return targets;
  }, [filteredPipeline, team, selectedSportId]);

  /* Sort recruiters */
  const sortedRecruiters = useMemo(() => {
    const copy = [...recruiterPerf];
    copy.sort((a, b) => {
      const aVal = a[recruiterSort.col as keyof typeof a] as number;
      const bVal = b[recruiterSort.col as keyof typeof b] as number;
      return recruiterSort.dir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return copy;
  }, [recruiterSort, recruiterPerf]);

  function toggleRecruiterSort(col: string) {
    setRecruiterSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "desc" }
    );
  }

  const sortArrow = (col: string) =>
    recruiterSort.col === col
      ? recruiterSort.dir === "asc" ? " ▲" : " ▼"
      : "";

  const sportTotals = sportData.reduce(
    (acc, s) => ({
      consulted: acc.consulted + s.consulted,
      favorited: acc.favorited + s.favorited,
      contacted: acc.contacted + s.contacted,
      recruited: acc.recruited + s.recruited,
    }),
    { consulted: 0, favorited: 0, contacted: 0, recruited: 0 },
  );

  const conversionRate = globalFunnel.identified > 0
    ? ((globalFunnel.signed / globalFunnel.identified) * 100).toFixed(1)
    : "0";

  const FUNNEL_STAGES = [
    { key: "identified",     label: "Identifiés",       value: funnel.identified,     color: "#6B7280" },
    { key: "contacted",      label: "Contactés",        value: funnel.contacted,      color: "#3B82F6" },
    { key: "in_discussion",  label: "En discussion",    value: funnel.in_discussion,  color: "#60A5FA" },
    { key: "visit_planned",  label: "Visite planifiée", value: funnel.visit_planned,  color: "#F59E0B" },
    { key: "engaged",        label: "Engagés",          value: funnel.engaged,        color: "#E63946" },
    { key: "signed",         label: "Signés",           value: funnel.signed,         color: "#E63946" },
  ];

  if (loading) {
    return <div className="px-5 sm:px-8 py-8 max-w-[1400px] mx-auto"><p className="text-[#6b7280] text-sm">Chargement des statistiques...</p></div>;
  }

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-head font-black text-white" style={{ fontSize: "28px" }}>
          Statistiques de recrutement
        </h1>
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase bg-[#E63946]/15 text-[#E63946] px-3 py-1 rounded-full">
          {schoolName}
        </span>
      </div>

      {/* SECTION 1 — Hero KPI Bar */}
      <KpiCardRow>
        <KpiCard
          label="Athlètes découverts"
          value={globalFunnel.identified}
          iconBgColor="rgba(107,114,128,0.15)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>}
        />
        <KpiCard
          label="Contacts initiés"
          value={contactsCount}
          iconBgColor="rgba(59,130,246,0.15)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
        />
        <KpiCard
          label="Visites planifiées"
          value={globalFunnel.visit_planned}
          iconBgColor="rgba(245,158,11,0.15)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
        />
        <KpiCard
          label="Lettres signées"
          value={globalFunnel.signed}
          valueColor="#E63946"
          valueFontSize="48px"
          iconBgColor="rgba(230,57,70,0.15)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
        />
        <KpiCard
          label="Taux de conversion"
          value={`${conversionRate}%`}
          iconBgColor="rgba(34,197,94,0.15)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>}
        />
      </KpiCardRow>

      {/* SECTION 2 — Entonnoir de recrutement */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <h2 className="text-white font-head font-bold text-[16px]">Entonnoir de recrutement</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="sport-filter" className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">Sport</label>
            <select
              id="sport-filter"
              value={selectedSportId}
              onChange={(e) => {
                setSelectedSportId(e.target.value);
                console.log("[Stats] sport filter →", e.target.value);
              }}
              className="bg-[#13151a] border border-[#2a2d36] rounded-full px-4 py-1.5 text-[13px] text-white focus:border-[#E63946] outline-none transition-colors cursor-pointer"
            >
              <option value="all">Tous les sports</option>
              {activeSports.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-3">
          {FUNNEL_STAGES.map((stage, i) => {
            const widthPct = funnel.identified > 0 ? (stage.value / funnel.identified) * 100 : 0;
            const prevValue = i > 0 ? FUNNEL_STAGES[i - 1].value : null;
            const stageConversion = prevValue && prevValue > 0 ? Math.round((stage.value / prevValue) * 100) : null;
            const dropOff = prevValue ? prevValue - stage.value : null;
            const overallPct = funnel.identified > 0 ? ((stage.value / funnel.identified) * 100).toFixed(1) : "0";
            return (
              <div key={stage.key}>
                {i > 0 && dropOff !== null && stageConversion !== null && (
                  <div className="flex items-center gap-3 mb-1.5 ml-2">
                    <span className="text-[11px] text-[#6B7280]">{stageConversion}% conversion</span>
                    <span className="text-[10px] text-[#4a4d56]">({dropOff} retiré{dropOff > 1 ? "s" : ""})</span>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <span className="text-[13px] font-medium text-[#e0e0e0] w-[130px] shrink-0">{stage.label}</span>
                  <div className="flex-1 h-7 rounded bg-[#2A2D35] overflow-hidden relative">
                    <div className="h-full rounded transition-all duration-500 flex items-center justify-end pr-3" style={{ width: `${Math.max(widthPct, 6)}%`, backgroundColor: stage.color, opacity: 0.85 }}>
                      {widthPct > 15 && <span className="text-[12px] font-bold text-white">{stage.value}</span>}
                    </div>
                    {widthPct <= 15 && <span className="absolute left-[calc(6%+8px)] top-1/2 -translate-y-1/2 text-[12px] font-bold text-white">{stage.value}</span>}
                  </div>
                  <span className="text-[12px] text-[#6B7280] w-[50px] text-right shrink-0">{overallPct}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Per-sport mini-funnel breakdown */}
        {perSportFunnel.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#2A2D35]">
            <h3 className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-4">Par sport</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                    <th className="text-left py-2 pr-3">Sport</th>
                    <th className="text-right px-2 py-2">Identifiés</th>
                    <th className="text-right px-2 py-2">Contactés</th>
                    <th className="text-right px-2 py-2">En disc.</th>
                    <th className="text-right px-2 py-2">Visite</th>
                    <th className="text-right px-2 py-2">Engagés</th>
                    <th className="text-right pl-2 py-2">Signés</th>
                  </tr>
                </thead>
                <tbody>
                  {perSportFunnel.map((row) => {
                    const cell = (val: number, color: string) => (
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color: val > 0 ? color : "#4a4d56" }}>{val}</span>
                    );
                    return (
                      <tr key={row.id} className="border-t border-[#1e2128]">
                        <td className="text-left py-2.5 pr-3 text-[13px] font-semibold text-white">{row.name}</td>
                        <td className="text-right px-2 py-2.5">{cell(row.identified, "#9CA3AF")}</td>
                        <td className="text-right px-2 py-2.5">{cell(row.contacted, "#3B82F6")}</td>
                        <td className="text-right px-2 py-2.5">{cell(row.in_discussion, "#60A5FA")}</td>
                        <td className="text-right px-2 py-2.5">{cell(row.visit_planned, "#F59E0B")}</td>
                        <td className="text-right px-2 py-2.5">{cell(row.engaged, "#E63946")}</td>
                        <td className="text-right pl-2 py-2.5">{cell(row.signed, "#E63946")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3 — Rendement par recruteur */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2128]">
          <h2 className="text-white font-head font-bold text-[16px]">Rendement par recruteur</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-3">Recruteur</th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("identified")}>Identifiés{sortArrow("identified")}</th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("contacted")}>Contactés{sortArrow("contacted")}</th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("in_discussion")}>En disc.{sortArrow("in_discussion")}</th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("visits")}>Visites{sortArrow("visits")}</th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("signed")}>Signés{sortArrow("signed")}</th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("conversion_rate")}>Taux{sortArrow("conversion_rate")}</th>
                <th className="text-center px-4 py-3">Activité</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecruiters.map((r) => {
                const rateColor = r.conversion_rate >= 10 ? "#22C55E" : r.conversion_rate >= 5 ? "#F59E0B" : "#E63946";
                const barW = Math.round(r.activity_7d * 100);
                return (
                  <tr key={r.recruiter_id} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/recruteur/cegep/entraineurs/${r.recruiter_id}`} className="text-[14px] font-semibold text-white hover:text-[#E63946] transition-colors">{r.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{r.identified}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{r.contacted}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{r.in_discussion}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{r.visits}</td>
                    <td className="px-4 py-3 text-right text-[14px] font-bold text-white">{r.signed}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-bold" style={{ color: rateColor }}>{r.conversion_rate}%</td>
                    <td className="px-4 py-3">
                      <div className="w-20 h-2.5 rounded-full bg-[#2A2D35] overflow-hidden mx-auto">
                        <div className="h-full rounded-full transition-all" style={{ width: `${barW}%`, backgroundColor: barW >= 60 ? "#22C55E" : barW >= 30 ? "#F59E0B" : "#E63946" }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4 — Recrutement par sport */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2128]">
          <h2 className="text-white font-head font-bold text-[16px]">Recrutement par sport</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-3">Sport</th>
                <th className="text-right px-4 py-3">Consultés</th>
                <th className="text-right px-4 py-3">Favorisés</th>
                <th className="text-right px-4 py-3">Contactés</th>
                <th className="text-right px-4 py-3">Recrutés</th>
              </tr>
            </thead>
            <tbody>
              {sportData.map((s) => (
                <tr key={s.sport} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                  <td className="px-4 py-3 text-[14px] font-semibold text-white">{s.sport}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{s.consulted}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{s.favorited}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{s.contacted}</td>
                  <td className="px-4 py-3 text-right text-[14px] font-bold" style={{ color: s.recruited > 0 ? "#E63946" : "#6B7280" }}>{s.recruited}</td>
                </tr>
              ))}
              {sportData.length > 0 && (
                <tr className="border-t-2 border-[#2A2D35] bg-[#13151a]">
                  <td className="px-4 py-3 text-[14px] font-bold text-white">Total</td>
                  <td className="px-4 py-3 text-right text-[14px] font-bold text-white">{sportTotals.consulted}</td>
                  <td className="px-4 py-3 text-right text-[14px] font-bold text-white">{sportTotals.favorited}</td>
                  <td className="px-4 py-3 text-right text-[14px] font-bold text-white">{sportTotals.contacted}</td>
                  <td className="px-4 py-3 text-right text-[14px] font-bold text-[#E63946]">{sportTotals.recruited}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 5 — Top 10 athlètes ciblés */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className="text-white font-head font-bold text-[16px] mb-5">Top 10 athlètes ciblés</h2>
        <div className="space-y-2">
          {topTargets.length > 0 ? topTargets.map((t) => {
            const stageBadge: Record<string, string> = {
              LETTRE_SIGNEE: "bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30",
              ENGAGE:        "bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30",
              VISITE_PLANIFIEE: "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30",
              EN_DISCUSSION: "bg-[#EAB308]/15 text-[#EAB308] border border-[#EAB308]/30",
              CONTACTE:      "bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30",
              IDENTIFIE:     "bg-[#6B7280]/15 text-[#9CA3AF] border border-[#6B7280]/30",
            };
            const badgeCls = stageBadge[t.stage] || "bg-[#6B7280]/15 text-[#9CA3AF] border border-[#6B7280]/30";
            return (
              <div key={`${t.athleteId}-${t.rank}`} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                <span className="text-[18px] font-head font-black w-[36px] shrink-0" style={{ color: t.rank <= 3 ? "#E63946" : "#4a4d56" }}>#{t.rank}</span>
                <div className="w-9 h-9 rounded-full bg-[#2A2D35] shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link href={`/recruteur/athletes/${t.athleteId}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate block">{t.name}</Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-[#6B7280] truncate">{t.sport} · {t.position} — {t.recruiterName}</p>
                    {t.rating > 0 && <StarRating rating={t.rating} size="sm" />}
                  </div>
                </div>
                <span className={`text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded shrink-0 ${badgeCls}`}>{t.pipelineStatus}</span>
              </div>
            );
          }) : (
            <p className="text-[13px] text-[#4a4d56] italic py-4 text-center">Aucun athlète dans le pipeline</p>
          )}
        </div>
      </div>
    </div>
  );
}
