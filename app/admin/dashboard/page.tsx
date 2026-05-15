"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, BarChart, Bar, Cell,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   Admin Dashboard — full platform health view
───────────────────────────────────────────────────────────────── */

const PIPELINE_STAGES = [
  { key: "IDENTIFIE",        label: "Identifié",         color: "#4a4d56" },
  { key: "CONTACTE",         label: "Contacté",          color: "#6b7280" },
  { key: "EN_DISCUSSION",    label: "En discussion",     color: "#9CA3AF" },
  { key: "VISITE_PLANIFIEE", label: "Visite planifiée",  color: "#E63946B3" },
  { key: "ENGAGE",           label: "Engagé",            color: "#E63946D9" },
  { key: "LETTRE_SIGNEE",    label: "Lettre signée",     color: "#E63946" },
] as const;

const SECTION_HEADING =
  "text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]";

type Counts = {
  totalAthletes: number;
  athletesThisWeek: number;
  totalCoaches: number;
  totalRecruiters: number;
  activeSchools: number;
  totalSchools: number;
};

type Engagement = {
  viewsThis: number;  viewsLast: number;
  favsThis: number;   favsLast: number;
  pipeThis: number;   pipeLast: number;
  msgsThis: number;   msgsLast: number;
};

type Quality = {
  verifRate: number;
  avgCompletion: number;
  avgCote: number;
  noEval: number;
};

type WeekPoint = { week: string; count: number };
type StageCount = { stage: string; label: string; color: string; count: number };
type SchoolRank = { name: string; views: number };

type ActivityRow = {
  id: string;
  type: string;
  created_at: string;
  athleteName: string;
  metadata: Record<string, unknown>;
};

function startOfCurrentWeek(): Date {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - now.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMinus(n: number): Date {
  const d = startOfCurrentWeek();
  d.setDate(d.getDate() - 7 * n);
  return d;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-CA", { month: "short", day: "numeric" });
}

export default function AdminDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [eng, setEng] = useState<Engagement | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [registrationSeries, setRegistrationSeries] = useState<WeekPoint[]>([]);
  const [funnel, setFunnel] = useState<StageCount[]>([]);
  const [topSchools, setTopSchools] = useState<SchoolRank[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const startOfWeek = startOfCurrentWeek();
      const startOfLastWeek = startOfWeekMinus(1);
      const startOfWeekISO = startOfWeek.toISOString();
      const startOfLastWeekISO = startOfLastWeek.toISOString();

      // ── Row 1 + row 3 counts ───────────────────────────────────
      const [
        athletesTot, athletesWeek, coachesTot, recruitersTot,
        schoolsTot, activeSchoolsData, verifiedCount, noEvalCount,
        athletesCompletion, evalsCote,
      ] = await Promise.all([
        supabase.from("athletes").select("id", { count: "exact", head: true }),
        supabase.from("athletes").select("id", { count: "exact", head: true }).gte("created_at", startOfWeekISO),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "COACH"),
        supabase.from("users").select("id", { count: "exact", head: true }).in("role", ["RECRUTEUR"]),
        supabase.from("schools").select("id", { count: "exact", head: true }),
        supabase.from("athletes").select("school_id").not("school_id", "is", null),
        supabase.from("athletes").select("id", { count: "exact", head: true }).eq("verified", true),
        supabase.from("athletes").select("id", { count: "exact", head: true }).is("coach_id", null),
        supabase.from("athletes").select("profile_completion"),
        supabase.from("evaluations").select("cote_globale").not("cote_globale", "is", null),
      ]);

      const totalAthletes = athletesTot.count ?? 0;
      const activeSchools = new Set(
        (activeSchoolsData.data || [])
          .map((a: { school_id: string | null }) => a.school_id)
          .filter(Boolean) as string[],
      ).size;
      const nextCounts: Counts = {
        totalAthletes,
        athletesThisWeek: athletesWeek.count ?? 0,
        totalCoaches: coachesTot.count ?? 0,
        totalRecruiters: recruitersTot.count ?? 0,
        activeSchools,
        totalSchools: schoolsTot.count ?? 0,
      };
      setCounts(nextCounts);

      // Quality
      const verified = verifiedCount.count ?? 0;
      const verifRate = totalAthletes > 0 ? Math.round((verified / totalAthletes) * 100) : 0;
      const completionRows = (athletesCompletion.data || []) as { profile_completion: number | null }[];
      const completionValues = completionRows
        .map((r) => Number(r.profile_completion))
        .filter((v) => Number.isFinite(v));
      const avgCompletion = completionValues.length
        ? Math.round(completionValues.reduce((a, b) => a + b, 0) / completionValues.length)
        : 0;
      const coteValues = (evalsCote.data || [])
        .map((e: { cote_globale: number | null }) => Number(e.cote_globale))
        .filter((v) => Number.isFinite(v));
      const avgCote = coteValues.length
        ? coteValues.reduce((a, b) => a + b, 0) / coteValues.length
        : 0;
      const nextQuality: Quality = {
        verifRate,
        avgCompletion,
        avgCote,
        noEval: noEvalCount.count ?? 0,
      };
      setQuality(nextQuality);

      // ── Row 2 engagement (tolerate missing `messages` table) ───
      const [
        viewsThis, viewsLast, favsThis, favsLast,
        pipeThis, pipeLast,
      ] = await Promise.all([
        supabase.from("recruiter_athlete_views").select("id", { count: "exact", head: true }).gte("viewed_at", startOfWeekISO),
        supabase.from("recruiter_athlete_views").select("id", { count: "exact", head: true }).gte("viewed_at", startOfLastWeekISO).lt("viewed_at", startOfWeekISO),
        supabase.from("recruiter_favorites").select("id", { count: "exact", head: true }).gte("created_at", startOfWeekISO),
        supabase.from("recruiter_favorites").select("id", { count: "exact", head: true }).gte("created_at", startOfLastWeekISO).lt("created_at", startOfWeekISO),
        supabase.from("recruiter_pipeline").select("id", { count: "exact", head: true }).gte("updated_at", startOfWeekISO),
        supabase.from("recruiter_pipeline").select("id", { count: "exact", head: true }).gte("updated_at", startOfLastWeekISO).lt("updated_at", startOfWeekISO),
      ]);
      let msgsThis = 0, msgsLast = 0;
      try {
        const [mThis, mLast] = await Promise.all([
          supabase.from("messages").select("id", { count: "exact", head: true }).gte("created_at", startOfWeekISO),
          supabase.from("messages").select("id", { count: "exact", head: true }).gte("created_at", startOfLastWeekISO).lt("created_at", startOfWeekISO),
        ]);
        msgsThis = mThis.count ?? 0;
        msgsLast = mLast.count ?? 0;
      } catch (err) {
      }
      const nextEng: Engagement = {
        viewsThis: viewsThis.count ?? 0,  viewsLast: viewsLast.count ?? 0,
        favsThis: favsThis.count ?? 0,    favsLast: favsLast.count ?? 0,
        pipeThis: pipeThis.count ?? 0,    pipeLast: pipeLast.count ?? 0,
        msgsThis, msgsLast,
      };
      setEng(nextEng);

      // ── Row 4 — registrations by week (last 8 weeks) ───────────
      const eightWeeksAgo = startOfWeekMinus(7);
      const { data: regs } = await supabase
        .from("athletes")
        .select("created_at")
        .gte("created_at", eightWeeksAgo.toISOString());
      const bucket = new Map<number, number>();
      for (let i = 7; i >= 0; i--) bucket.set(i, 0);
      for (const r of (regs || []) as { created_at: string }[]) {
        const diffWeeks = Math.floor((startOfCurrentWeek().getTime() - new Date(r.created_at).getTime()) / (7 * 86400000));
        const idx = Math.max(0, Math.min(7, diffWeeks));
        bucket.set(idx, (bucket.get(idx) ?? 0) + 1);
      }
      const now = new Date();
      const series: WeekPoint[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1 - i * 7);
        weekStart.setHours(0, 0, 0, 0);
        const label = weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
        series.push({ week: label, count: bucket.get(i) ?? 0 });
      }
      setRegistrationSeries(series);

      // ── Row 4 — pipeline funnel ────────────────────────────────
      const { data: pipelineRows } = await supabase.from("recruiter_pipeline").select("stage");
      const stageCounts = new Map<string, number>();
      for (const r of (pipelineRows || []) as { stage: string | null }[]) {
        if (!r.stage) continue;
        stageCounts.set(r.stage, (stageCounts.get(r.stage) ?? 0) + 1);
      }
      const funnelData: StageCount[] = PIPELINE_STAGES.map((s) => ({
        stage: s.key, label: s.label, color: s.color, count: stageCounts.get(s.key) ?? 0,
      }));
      setFunnel(funnelData);

      // ── Row 5 — top 5 schools by views ─────────────────────────
      const { data: viewsJoin } = await supabase
        .from("recruiter_athlete_views")
        .select("athlete_id, athletes!athlete_id(school_id, schools!school_id(name))");
      const schoolCounts = new Map<string, { name: string; views: number }>();
      for (const v of (viewsJoin || []) as unknown as Array<{ athletes: { school_id: string | null; schools: { name: string } | null } | null }>) {
        const schoolId = v.athletes?.school_id;
        const name = v.athletes?.schools?.name;
        if (!schoolId || !name) continue;
        const existing = schoolCounts.get(schoolId);
        if (existing) existing.views += 1;
        else schoolCounts.set(schoolId, { name, views: 1 });
      }
      const ranked = [...schoolCounts.values()].sort((a, b) => b.views - a.views).slice(0, 5);
      setTopSchools(ranked);

      // ── Row 5 — recent platform activity ───────────────────────
      const { data: acts } = await supabase
        .from("activities")
        .select("id, type, created_at, metadata, athletes(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(8);
      const mappedActs: ActivityRow[] = (acts || []).map((r: Record<string, unknown>) => {
        const a = r.athletes as { first_name?: string; last_name?: string } | null;
        return {
          id: r.id as string,
          type: (r.type as string) || "",
          created_at: (r.created_at as string) || "",
          athleteName: a ? [a.first_name, a.last_name].filter(Boolean).join(" ") : "",
          metadata: (r.metadata as Record<string, unknown>) || {},
        };
      });
      setActivity(mappedActs);

      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          Santé de la plateforme Nexus en temps réel
        </p>
      </div>

      {/* ═══════ ROW 1 — KEY NUMBERS ═══════ */}
      <section className="space-y-3">
        <h2 className={SECTION_HEADING}>Nombres clés</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BigStat
            label="Athlètes"
            value={counts?.totalAthletes}
            delta={counts?.athletesThisWeek ?? 0}
            deltaLabel="cette semaine"
            loading={loading}
          />
          <BigStat label="Entraîneurs" value={counts?.totalCoaches} loading={loading} />
          <BigStat label="Recruteurs" value={counts?.totalRecruiters} loading={loading} />
          <BigStat
            label="Écoles actives"
            value={counts?.activeSchools}
            sublabel={counts ? `sur ${counts.totalSchools.toLocaleString("fr-CA")} total` : ""}
            loading={loading}
          />
        </div>
      </section>

      {/* ═══════ ROW 2 — ENGAGEMENT ═══════ */}
      <section className="space-y-3">
        <h2 className={SECTION_HEADING}>Engagement hebdomadaire</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TrendStat label="Profils consultés" thisWeek={eng?.viewsThis ?? 0} lastWeek={eng?.viewsLast ?? 0} loading={loading} />
          <TrendStat label="Favoris ajoutés" thisWeek={eng?.favsThis ?? 0} lastWeek={eng?.favsLast ?? 0} loading={loading} />
          <TrendStat label="Mouvements pipeline" thisWeek={eng?.pipeThis ?? 0} lastWeek={eng?.pipeLast ?? 0} loading={loading} />
          <TrendStat label="Messages envoyés" thisWeek={eng?.msgsThis ?? 0} lastWeek={eng?.msgsLast ?? 0} loading={loading} />
        </div>
      </section>

      {/* ═══════ ROW 3 — QUALITY ═══════ */}
      <section className="space-y-3">
        <h2 className={SECTION_HEADING}>Qualité</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PercentStat label="Taux de vérification" percent={quality?.verifRate ?? 0} loading={loading} />
          <PercentStat label="Complétion profil moyenne" percent={quality?.avgCompletion ?? 0} loading={loading} />
          <StarStat label="Cote globale moyenne" value={quality?.avgCote ?? 0} loading={loading} />
          <WarningStat label="Athlètes sans évaluation" value={quality?.noEval ?? 0} sublabel="besoin d'évaluation" loading={loading} />
        </div>
      </section>

      {/* ═══════ ROW 4 — CHARTS ═══════ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Inscriptions — 8 dernières semaines">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={registrationSeries}>
                <defs>
                  <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E63946" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#E63946" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" vertical={false} />
                <XAxis dataKey="week" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1A1D24", border: "1px solid #2D3748", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#9CA3AF" }}
                  labelFormatter={(label) => `Sem. du ${String(label)}`}
                  formatter={(value) => [`${Number(value)} inscription${Number(value) > 1 ? "s" : ""}`, ""]}
                  separator=""
                />
                <Area type="monotone" dataKey="count" stroke="#E63946" strokeWidth={2} fill="url(#regFill)" dot={{ fill: "#E63946", r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Entonnoir de recrutement">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} width={110} />
                <Tooltip
                  contentStyle={{ background: "#1A1D24", border: "1px solid #2D3748", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#9CA3AF" }}
                  cursor={{ fill: "#ffffff08" }}
                  formatter={(value) => [`${Number(value)} athlète${Number(value) > 1 ? "s" : ""}`, ""]}
                  separator=""
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {funnel.map((f) => <Cell key={f.stage} fill={f.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* ═══════ ROW 5 — TOP SCHOOLS + ACTIVITY ═══════ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Écoles les plus consultées">
          {topSchools.length === 0 ? (
            <p className="text-[13px] text-[#6b7280] py-6 text-center">Aucune donnée</p>
          ) : (
            <ol className="space-y-2">
              {topSchools.map((s, i) => (
                <li key={s.name + i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#111317] border border-white/5">
                  <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-[#E63946]/15 text-[#E63946] text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[13px] text-white truncate">{s.name}</span>
                  <span className="text-[12px] font-bold text-[#9CA3AF] tabular-nums">
                    {s.views.toLocaleString("fr-CA")} vue{s.views > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Activité récente">
          {activity.length === 0 ? (
            <p className="text-[13px] text-[#6b7280] py-6 text-center">Aucune activité récente</p>
          ) : (
            <ul className="space-y-1.5">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E63946] mt-[7px] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white truncate">
                      <span className="font-bold">{activityLabel(a.type)}</span>
                      {a.athleteName && <span className="text-[#9CA3AF]"> — {a.athleteName}</span>}
                    </p>
                    <p className="text-[11px] text-[#6b7280] mt-0.5">{relativeTime(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Components
══════════════════════════════════════════════════════════════════ */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-6">
      <h3 className="font-head text-[13px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF] mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatShell({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-6 min-h-[130px] flex flex-col justify-between">
      <div>{children}</div>
      <div>
        <p className="text-[13px] text-[#9CA3AF] mt-4">{label}</p>
        {sublabel && <div className="text-[11px] text-[#6b7280] mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

function BigStat({
  label, value, delta, deltaLabel, sublabel, loading,
}: {
  label: string;
  value: number | null | undefined;
  delta?: number;
  deltaLabel?: string;
  sublabel?: string;
  loading: boolean;
}) {
  return (
    <StatShell
      label={label}
      sublabel={
        delta !== undefined && delta > 0 ? (
          <span className="text-[#22C55E] font-bold">+{delta.toLocaleString("fr-CA")} {deltaLabel}</span>
        ) : sublabel ? (
          sublabel
        ) : null
      }
    >
      <p className="font-head text-[48px] leading-none font-black text-[#E63946] tabular-nums">
        {loading || value == null ? <span className="text-[#4a4d56]">—</span> : value.toLocaleString("fr-CA")}
      </p>
    </StatShell>
  );
}

function TrendStat({
  label, thisWeek, lastWeek, loading,
}: {
  label: string;
  thisWeek: number;
  lastWeek: number;
  loading: boolean;
}) {
  const diff = thisWeek - lastWeek;
  const up = diff > 0, down = diff < 0;
  const colorClass = up ? "text-[#22C55E]" : down ? "text-[#EF4444]" : "text-[#6B7280]";
  const arrow = up ? "▲" : down ? "▼" : "—";
  return (
    <StatShell
      label={label}
      sublabel={
        <span className="text-[11px] text-[#6b7280]">
          vs {lastWeek.toLocaleString("fr-CA")} sem. dernière
        </span>
      }
    >
      <div className="flex items-baseline gap-2">
        <p className="font-head text-[40px] leading-none font-black text-white tabular-nums">
          {loading ? <span className="text-[#4a4d56]">—</span> : thisWeek.toLocaleString("fr-CA")}
        </p>
        <span className={`text-[14px] font-bold ${colorClass}`}>
          {arrow}{diff !== 0 && ` ${Math.abs(diff).toLocaleString("fr-CA")}`}
        </span>
      </div>
    </StatShell>
  );
}

function PercentStat({ label, percent, loading }: { label: string; percent: number; loading: boolean }) {
  const barClass = percent >= 60 ? "bg-[#22C55E]" : percent >= 30 ? "bg-[#F59E0B]" : "bg-[#EF4444]";
  const clamped = Math.min(100, Math.max(0, percent));
  const widthVar = { "--bar-w": `${clamped}%` } as React.CSSProperties;
  return (
    <StatShell label={label}>
      <p className="font-head text-[40px] leading-none font-black text-white tabular-nums">
        {loading ? <span className="text-[#4a4d56]">—</span> : `${percent}%`}
      </p>
      <div className="mt-4 h-1.5 w-full rounded-full bg-[#2D3748] overflow-hidden">
        {/* eslint-disable-next-line react/forbid-dom-props -- width is genuinely dynamic */}
        <div className={`h-full rounded-full transition-all w-[var(--bar-w)] ${barClass}`} style={widthVar} />
      </div>
    </StatShell>
  );
}

function StarStat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  const rounded = Math.round(value * 10) / 10;
  return (
    <StatShell label={label}>
      <div className="flex items-baseline gap-2">
        <p className="font-head text-[40px] leading-none font-black text-white tabular-nums">
          {loading ? <span className="text-[#4a4d56]">—</span> : rounded.toFixed(1)}
        </p>
        <span className="text-[14px] font-bold text-[#6b7280]">/ 5</span>
      </div>
      <div className="mt-3 flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width="16" height="16" viewBox="0 0 24 24"
            fill={i <= Math.round(rounded) ? "#F59E0B" : "#2D3748"}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
    </StatShell>
  );
}

function WarningStat({ label, value, sublabel, loading }: { label: string; value: number; sublabel: string; loading: boolean }) {
  return (
    <StatShell label={label} sublabel={<span className="text-[11px] text-[#EF4444]">{sublabel}</span>}>
      <p className="font-head text-[40px] leading-none font-black text-[#EF4444] tabular-nums">
        {loading ? <span className="text-[#4a4d56]">—</span> : value.toLocaleString("fr-CA")}
      </p>
    </StatShell>
  );
}

function activityLabel(type: string): string {
  switch (type) {
    case "NEW_MESSAGE":        return "Nouveau message";
    case "NEW_FAVORITE":       return "Nouveau favori";
    case "PROFILE_VIEW":       return "Profil consulté";
    case "PIPELINE_MOVE":      return "Mouvement pipeline";
    case "EVALUATION_UPDATED": return "Évaluation mise à jour";
    case "ATHLETE_VERIFIED":   return "Athlète vérifié";
    case "NEW_REGISTRATION":   return "Nouvelle inscription";
    default:                   return type || "Activité";
  }
}

// Keep Link import used (potential drill-in — currently not needed).
void Link;
