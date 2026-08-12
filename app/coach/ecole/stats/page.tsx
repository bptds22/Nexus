"use client";

import { useState, useEffect, useCallback } from "react";
import SchoolGate from "@/components/subscription/SchoolGate";
import { createClient } from "@/lib/supabase/client";
import { loadCoachAthleteScope } from "@/lib/queries/coach/getCoachAthletes";

/* ── types ──────────────────────────────────────────────── */

type StatBySport = { sport: string; athletes: number; profilesCompleted: number; views: number; contacts: number; placements: number };
type InterestedCegep = { cegep: string; athleteCount: number };
type TopAthlete = { id: string; name: string; sport: string; position: string; profileCompletion: number; views: number; bestStatus: string };
type PipelineCounts = { IDENTIFIE: number; CONTACTE: number; EN_DISCUSSION: number; ENGAGE: number; LETTRE_SIGNEE: number };

/* ── helpers ─────────────────────────────────────────────── */

type Period = "2025-2026" | "2024-2025" | "2023-2024";
const PERIODS: { value: Period; label: string }[] = [
  { value: "2025-2026", label: "2025-2026" },
  { value: "2024-2025", label: "2024-2025" },
  { value: "2023-2024", label: "2023-2024" },
];

const STATUS_HIERARCHY = ["LETTRE_SIGNEE", "ENGAGE", "VISITE_PLANIFIEE", "EN_DISCUSSION", "CONTACTE", "IDENTIFIE"];
const STATUS_LABELS: Record<string, string> = {
  IDENTIFIE: "Identifié", CONTACTE: "Contacté", EN_DISCUSSION: "En discussion",
  VISITE_PLANIFIEE: "Visite planifiée", ENGAGE: "Engagé", LETTRE_SIGNEE: "Lettre signée",
};

function getBestStatus(statuses: string[]): string {
  for (const s of STATUS_HIERARCHY) {
    if (statuses.includes(s)) return s;
  }
  return "";
}

/* ── page ────────────────────────────────────────────────── */

export default function StatsPageWrapper() {
  return <SchoolGate><StatsPage /></SchoolGate>;
}

function StatsPage() {
  const [period, setPeriod] = useState<Period>("2025-2026");
  const [sportFilter, setSportFilter] = useState("Tous");
  const [toast, setToast] = useState(false);

  const [loading, setLoading] = useState(true);
  const [statsBySport, setStatsBySport] = useState<StatBySport[]>([]);
  const [interestedCegeps, setInterestedCegeps] = useState<InterestedCegep[]>([]);
  const [topAthletes, setTopAthletes] = useState<TopAthlete[]>([]);
  const [sportsList, setSportsList] = useState<string[]>(["Tous"]);
  const [pipelineCounts, setPipelineCounts] = useState<PipelineCounts>({ IDENTIFIE: 0, CONTACTE: 0, EN_DISCUSSION: 0, ENGAGE: 0, LETTRE_SIGNEE: 0 });

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: mySchool } = await supabase
        .from("school_coaches")
        .select("school_id")
        .eq("coach_id", user.id)
        .limit(1)
        .single();
      if (!mySchool) { setLoading(false); return; }

      // Périmètre canonique — source unique get_coach_athletes (directeur →
      // école ∪ équipes ; ACTIF+EN_ATTENTE). Remplace .in("coach_id", coachIds).
      const { ids: scopeIds } = await loadCoachAthleteScope(supabase);
      if (!scopeIds.length) { setLoading(false); return; }

      const { data: athletes } = await supabase
        .from("athletes")
        .select("id, first_name, last_name, sport_id, coach_id, profile_completion, verified, annee_diplomation, position_id, sports!sport_id(nom), positions!position_id(nom, abreviation)")
        .in("id", scopeIds);

      if (!athletes || athletes.length === 0) { setLoading(false); return; }
      const athleteIds = athletes.map(a => a.id);

      const { data: pipelineEntries } = await supabase
        .from("recruiter_pipeline")
        .select("id, athlete_id, recruiter_id, stage")
        .in("athlete_id", athleteIds);
      const pipeline = pipelineEntries || [];

      const sportIds = [...new Set(athletes.map(a => a.sport_id).filter(Boolean))];
      let sportsMap: Record<string, string> = {};
      if (sportIds.length > 0) {
        const { data: sports } = await supabase.from("sports").select("id, nom").in("id", sportIds);
        if (sports) sports.forEach(s => { sportsMap[s.id] = s.nom; });
      }

      // ── Stats by sport ──
      const sportGroups: Record<string, { athletes: Set<string>; completed: number; contacts: number; placements: number }> = {};
      athletes.forEach(a => {
        const sportName = sportsMap[a.sport_id] || "Inconnu";
        if (!sportGroups[sportName]) sportGroups[sportName] = { athletes: new Set(), completed: 0, contacts: 0, placements: 0 };
        sportGroups[sportName].athletes.add(a.id);
        if ((a.profile_completion as number) >= 60) sportGroups[sportName].completed += 1;
      });
      const CONTACT_STATUSES = ["CONTACTE", "EN_DISCUSSION", "VISITE_PLANIFIEE", "ENGAGE", "LETTRE_SIGNEE"];
      pipeline.forEach(p => {
        const ath = athletes.find(a => a.id === p.athlete_id);
        if (!ath) return;
        const sportName = sportsMap[ath.sport_id] || "Inconnu";
        if (!sportGroups[sportName]) return;
        if (CONTACT_STATUSES.includes(p.stage)) sportGroups[sportName].contacts += 1;
        if (p.stage === "LETTRE_SIGNEE") sportGroups[sportName].placements += 1;
      });
      const builtStats: StatBySport[] = Object.entries(sportGroups).map(([sport, g]) => ({
        sport, athletes: g.athletes.size, profilesCompleted: g.completed, views: 0, contacts: g.contacts, placements: g.placements,
      }));
      setStatsBySport(builtStats);
      setSportsList(["Tous", ...builtStats.map(s => s.sport)]);

      // ── Pipeline counts for funnel ──
      const counts: PipelineCounts = { IDENTIFIE: 0, CONTACTE: 0, EN_DISCUSSION: 0, ENGAGE: 0, LETTRE_SIGNEE: 0 };
      pipeline.forEach(p => {
        if (p.stage in counts) counts[p.stage as keyof PipelineCounts] += 1;
      });
      setPipelineCounts(counts);

      // ── CÉGEPs intéressés — group by CÉGEP, count distinct athletes ──
      const activePipeline = pipeline.filter(p => p.stage !== "NONE" && p.stage !== "RETIRE");
      const recruiterIds = [...new Set(activePipeline.map(p => p.recruiter_id).filter(Boolean))];
      let cegepList: InterestedCegep[] = [];
      if (recruiterIds.length > 0) {
        const { data: recruiterUsers } = await supabase.from("users").select("id, school_id").in("id", recruiterIds);
        const cegepSchoolIds = [...new Set((recruiterUsers || []).map((r: Record<string, unknown>) => r.school_id).filter(Boolean))] as string[];
        let schoolsMap: Record<string, string> = {};
        if (cegepSchoolIds.length > 0) {
          const { data: schools } = await supabase.from("schools").select("id, name").in("id", cegepSchoolIds);
          if (schools) schools.forEach((s: { id: string; name: string }) => { schoolsMap[s.id] = s.name; });
        }
        const cegepAthletes: Record<string, Set<string>> = {};
        activePipeline.forEach(p => {
          const rec = (recruiterUsers || []).find((r: Record<string, unknown>) => r.id === p.recruiter_id) as { school_id?: string } | undefined;
          if (!rec?.school_id) return;
          const schoolName = schoolsMap[rec.school_id] || rec.school_id;
          if (!cegepAthletes[schoolName]) cegepAthletes[schoolName] = new Set();
          cegepAthletes[schoolName].add(p.athlete_id);
        });
        cegepList = Object.entries(cegepAthletes)
          .map(([cegep, athletes]) => ({ cegep, athleteCount: athletes.size }))
          .sort((a, b) => b.athleteCount - a.athleteCount);
      }
      setInterestedCegeps(cegepList);

      // ── Top athletes ──
      const athletePipelineMap: Record<string, string[]> = {};
      pipeline.forEach(p => {
        if (!athletePipelineMap[p.athlete_id]) athletePipelineMap[p.athlete_id] = [];
        athletePipelineMap[p.athlete_id].push(p.stage);
      });
      const sorted = [...athletes].sort((a, b) => (athletePipelineMap[b.id]?.length || 0) - (athletePipelineMap[a.id]?.length || 0));
      const top10: TopAthlete[] = sorted.slice(0, 10).map(a => {
        const sportRaw = a.sports;
        const sportObj = (Array.isArray(sportRaw) ? sportRaw[0] : sportRaw) as { nom?: string } | null;
        const posRaw = a.positions;
        const posObj = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { nom?: string; abreviation?: string } | null;
        return {
          id: a.id,
          name: `${a.first_name} ${a.last_name}`,
          sport: sportObj?.nom || sportsMap[a.sport_id] || "—",
          position: posObj?.abreviation || posObj?.nom || "—",
          profileCompletion: (a.profile_completion as number) || 0,
          views: 0,
          bestStatus: getBestStatus(athletePipelineMap[a.id] || []),
        };
      });
      setTopAthletes(top10);

      setLoading(false);
    }
    fetchData();
  }, []);

  const handleExport = useCallback(() => {
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  }, []);

  const stats = sportFilter === "Tous" ? statsBySport : statsBySport.filter((s) => s.sport === sportFilter);
  const totals = stats.reduce(
    (acc, s) => ({ athletes: acc.athletes + s.athletes, profilesCompleted: acc.profilesCompleted + s.profilesCompleted, views: acc.views + s.views, contacts: acc.contacts + s.contacts, placements: acc.placements + s.placements }),
    { athletes: 0, profilesCompleted: 0, views: 0, contacts: 0, placements: 0 },
  );

  const selectClass = "bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors";

  // Pipeline funnel bars
  const funnelSteps = [
    { label: "Identifiés", value: pipelineCounts.IDENTIFIE, color: "#3B82F6" },
    { label: "Contactés", value: pipelineCounts.CONTACTE, color: "#8B5CF6" },
    { label: "En discussion", value: pipelineCounts.EN_DISCUSSION, color: "#F59E0B" },
    { label: "Engagés", value: pipelineCounts.ENGAGE, color: "#22C55E" },
    { label: "Placés", value: pipelineCounts.LETTRE_SIGNEE, color: "#E63946" },
  ];
  const maxFunnel = Math.max(...funnelSteps.map(s => s.value), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1A1D24] border border-[#E63946] text-white text-[13px] px-5 py-3 rounded-lg shadow-lg animate-fade-in">
          Export en cours...
        </div>
      )}

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
          Statistiques de recrutement
        </h1>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 border border-[#E63946] text-[#E63946] rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-[#E63946] hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Exporter en PDF
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={selectClass} title="Saison">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className={selectClass} title="Sport">
          {sportsList.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* ── Statistiques par sport ───────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="font-head text-[15px] font-bold text-white">Statistiques par sport</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-3">Sport</th>
                <th className="text-left px-4 py-3">Athlètes</th>
                <th className="text-left px-4 py-3">Profils complétés</th>
                <th className="text-left px-4 py-3">Vues</th>
                <th className="text-left px-4 py-3">Contacts</th>
                <th className="text-left px-4 py-3">Placements</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const pct = s.athletes > 0 ? Math.round((s.profilesCompleted / s.athletes) * 100) : 0;
                return (
                  <tr key={s.sport} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                    <td className="px-4 py-3 text-[13px] text-white font-medium">{s.sport}</td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{s.athletes}</td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{s.profilesCompleted} ({pct}%)</td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{s.views}</td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{s.contacts}</td>
                    <td className={`px-4 py-3 text-[13px] font-bold ${s.placements > 0 ? "text-[#E63946]" : "text-[#6B7280]"}`}>{s.placements}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#22262E] border-t border-[#1e2128]">
                <td className="px-4 py-3 text-[13px] text-white font-bold">Total</td>
                <td className="px-4 py-3 text-[13px] text-white font-bold">{totals.athletes}</td>
                <td className="px-4 py-3 text-[13px] text-white font-bold">{totals.profilesCompleted} ({totals.athletes > 0 ? Math.round((totals.profilesCompleted / totals.athletes) * 100) : 0}%)</td>
                <td className="px-4 py-3 text-[13px] text-white font-bold">{totals.views}</td>
                <td className="px-4 py-3 text-[13px] text-white font-bold">{totals.contacts}</td>
                <td className={`px-4 py-3 text-[13px] font-bold ${totals.placements > 0 ? "text-[#E63946]" : "text-[#6B7280]"}`}>{totals.placements}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Two-column: Pipeline + CÉGEPs ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LEFT: Pipeline de recrutement */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5">
          <h2 className="font-head text-[15px] font-bold text-white mb-5">Pipeline de recrutement</h2>
          <div className="space-y-3">
            {funnelSteps.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <span className="text-[12px] text-[#9CA3AF] w-[90px] text-right shrink-0">{step.label}</span>
                <div className="flex-1 h-2 bg-[#2A2D35] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${maxFunnel > 0 ? (step.value / maxFunnel) * 100 : 0}%`, backgroundColor: step.color }} />
                </div>
                <span className="text-[13px] font-bold text-white w-8 text-right shrink-0">{step.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: CÉGEPs intéressés */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5">
          <h2 className="font-head text-[15px] font-bold text-white mb-5">CÉGEPs intéressés</h2>
          {interestedCegeps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 22V12h6v10" />
                <path d="M3 10h18" />
              </svg>
              <p className="text-[13px] text-[#6B7280] text-center">Aucun CÉGEP n&apos;a encore consulté vos athlètes.</p>
            </div>
          ) : (
            <div>
              {interestedCegeps.slice(0, 8).map((c) => (
                <div key={c.cegep} className="flex items-center justify-between py-3 border-b border-[#2A2D35] last:border-0">
                  <span className="text-[13px] text-white font-medium">{c.cegep}</span>
                  <span className="text-[13px] text-[#9CA3AF]">{c.athleteCount} athlète{c.athleteCount > 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top athlètes — table ────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="font-head text-[15px] font-bold text-white">Top athlètes — 2025-2026</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-3 w-10">#</th>
                <th className="text-left px-4 py-3">Athlète</th>
                <th className="text-left px-4 py-3">Sport</th>
                <th className="text-left px-4 py-3">Profil</th>
                <th className="text-left px-4 py-3">Vues</th>
                <th className="text-left px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {topAthletes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[#6B7280]">Aucun athlète</td>
                </tr>
              ) : (
                topAthletes.map((a, i) => {
                  const compColor = a.profileCompletion >= 60 ? "#3B82F6" : "#6B7280";
                  return (
                    <tr key={a.id} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                      <td className="px-4 py-3 text-[13px] text-[#6B7280] font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-bold text-white">{a.name}</p>
                        <p className="text-[11px] text-[#6B7280]">{a.position}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{a.sport}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-[#2A2D35] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${a.profileCompletion}%`, backgroundColor: compColor }} />
                          </div>
                          <span className="text-[11px] font-bold" style={{ color: compColor }}>{a.profileCompletion}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{a.views}</td>
                      <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{a.bestStatus ? STATUS_LABELS[a.bestStatus] || a.bestStatus : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
