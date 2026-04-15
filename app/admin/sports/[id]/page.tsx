"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type RecruitBucket = "OUVERT" | "EN_PROCESSUS" | "RECRUTE" | "RETIRE" | null;

function bucketRecruitmentStatus(raw: string | null | undefined): RecruitBucket {
  if (!raw) return null;
  const v = raw.toUpperCase();
  if (v === "OUVERT" || v === "IDENTIFIE") return "OUVERT";
  if (v === "CONTACTE" || v === "EN_DISCUSSION" || v === "VISITE_PLANIFIEE" || v === "EN_PROCESSUS") return "EN_PROCESSUS";
  if (v === "ENGAGE" || v === "LETTRE_SIGNEE" || v === "RECRUTE") return "RECRUTE";
  if (v === "RETIRE") return "RETIRE";
  return null;
}

function bucketLabel(b: RecruitBucket): string {
  if (b === "OUVERT") return "Ouvert";
  if (b === "EN_PROCESSUS") return "En processus";
  if (b === "RECRUTE") return "Recruté";
  if (b === "RETIRE") return "Retiré";
  return "Non défini";
}

function bucketDotClass(b: RecruitBucket): string {
  if (b === "OUVERT") return "bg-green-500";
  if (b === "EN_PROCESSUS") return "bg-amber-500";
  if (b === "RECRUTE") return "bg-red-500";
  if (b === "RETIRE") return "bg-gray-500";
  return "bg-gray-500";
}

function bucketBadgeClass(b: RecruitBucket): string {
  if (b === "OUVERT") return "bg-green-500/20 text-green-400";
  if (b === "EN_PROCESSUS") return "bg-amber-500/20 text-amber-400";
  if (b === "RECRUTE") return "bg-red-500/20 text-red-400";
  return "bg-gray-500/20 text-gray-400";
}

interface Athlete {
  id: string;
  first_name: string | null;
  last_name: string | null;
  sport_id: string | null;
  position_id: string | null;
  school_id: string | null;
  coach_id: string | null;
  verified: boolean | null;
  statut_recrutement_override: string | null;
  profile_completion: number | null;
  annee_diplomation: number | string | null;
  photo_url: string | null;
  numero_jersey: number | string | null;
  cote_globale_entraineur: number | null;
  created_at: string | null;
}

interface Position {
  id: string;
  sport_id: string;
  nom: string;
  abreviation: string | null;
  athlete_count: number;
}

interface School {
  id: string;
  name: string | null;
  region: string | null;
  city: string | null;
}

interface RecentAthleteRow extends Athlete {
  school_name: string | null;
  position_nom: string | null;
}

interface SchoolRow {
  id: string;
  name: string;
  region: string | null;
  athlete_count: number;
  active_coaches: number;
}

export default function AdminSportDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [sportName, setSportName] = useState<string>("");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [pipelineRecruiters, setPipelineRecruiters] = useState<number>(0);
  const [platformAvg, setPlatformAvg] = useState<number | null>(null);
  const [schoolsMap, setSchoolsMap] = useState<Map<string, School>>(new Map());
  const [recent, setRecent] = useState<RecentAthleteRow[]>([]);
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [newPosName, setNewPosName] = useState("");
  const [editingPos, setEditingPos] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchAll() {
    if (!id) return;
    setLoading(true);
    console.log("Sport ID from params:", id);

    const [sportRes, athletesRes, positionsRes, schoolsRes, platformRes] = await Promise.all([
      supabase.from("sports").select("id,nom").eq("id", id).maybeSingle(),
      supabase
        .from("athletes")
        .select(
          "id,first_name,last_name,sport_id,position_id,school_id,coach_id,verified,statut_recrutement_override,profile_completion,annee_diplomation,photo_url,numero_jersey,cote_globale_entraineur,created_at",
        )
        .eq("sport_id", id),
      supabase.from("positions").select("id,sport_id,nom,abreviation").eq("sport_id", id).order("nom"),
      supabase.from("schools").select("id,name,region,city"),
      supabase.from("athletes").select("cote_globale_entraineur").not("cote_globale_entraineur", "is", null),
    ]);

    const platformRatings = ((platformRes.data || []) as { cote_globale_entraineur: number | null }[])
      .map((a) => a.cote_globale_entraineur)
      .filter((v): v is number => typeof v === "number");
    setPlatformAvg(platformRatings.length > 0 ? platformRatings.reduce((s, v) => s + v, 0) / platformRatings.length : null);

    const athletesData = (athletesRes.data || []) as Athlete[];
    const positionsData = (positionsRes.data || []) as Omit<Position, "athlete_count">[];
    console.log("Athletes count:", athletesData?.length);
    console.log("Positions count:", positionsData?.length);

    setSportName(((sportRes.data as { nom?: string } | null)?.nom as string) || "");
    setAthletes(athletesData);

    const posCount = new Map<string, number>();
    for (const a of athletesData) {
      if (a.position_id) posCount.set(a.position_id, (posCount.get(a.position_id) || 0) + 1);
    }
    setPositions(
      positionsData.map((p) => ({ ...p, athlete_count: posCount.get(p.id) || 0 })),
    );

    const sMap = new Map<string, School>();
    for (const s of (schoolsRes.data || []) as School[]) sMap.set(s.id, s);
    setSchoolsMap(sMap);

    const athleteIds = athletesData.map((a) => a.id);
    let pipelineData: { recruiter_id: string | null; athlete_id: string | null }[] = [];
    if (athleteIds.length > 0) {
      const pipeRes = await supabase
        .from("recruiter_pipeline")
        .select("recruiter_id,athlete_id")
        .in("athlete_id", athleteIds);
      pipelineData = (pipeRes.data || []) as typeof pipelineData;
    }
    console.log("Pipeline count:", pipelineData?.length);
    const distinctRecruiters = new Set<string>();
    for (const r of pipelineData) if (r.recruiter_id) distinctRecruiters.add(r.recruiter_id);
    setPipelineRecruiters(distinctRecruiters.size);

    const positionsById = new Map<string, string>();
    for (const p of positionsData) positionsById.set(p.id, p.nom);
    const recentList = [...athletesData]
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      .slice(0, 5)
      .map((a) => ({
        ...a,
        school_name: a.school_id ? sMap.get(a.school_id)?.name || null : null,
        position_nom: a.position_id ? positionsById.get(a.position_id) || null : null,
      }));
    setRecent(recentList);

    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Aggregates
  const total = athletes.length;
  const verified = athletes.filter((a) => a.verified === true).length;
  const unverified = total - verified;
  const verifiedPct = total > 0 ? Math.round((verified / total) * 100) : 0;

  const distinctCoaches = new Set<string>();
  const distinctSchools = new Set<string>();
  for (const a of athletes) {
    if (a.coach_id) distinctCoaches.add(a.coach_id);
    if (a.school_id) distinctSchools.add(a.school_id);
  }

  const avgCompletion = total > 0
    ? Math.round(athletes.reduce((s, a) => s + (a.profile_completion || 0), 0) / total)
    : 0;
  const avgColor = avgCompletion >= 75 ? "bg-green-500" : "bg-amber-500";

  const demand = pipelineRecruiters;
  const supply = total;
  const showImbalance = demand > 0 && supply < demand * 3;

  // Calibration
  const ratedAthletes = athletes.filter((a) => typeof a.cote_globale_entraineur === "number");
  const ratedCount = ratedAthletes.length;
  const unratedCount = total - ratedCount;
  const sportAvg = ratedCount > 0
    ? ratedAthletes.reduce((s, a) => s + (a.cote_globale_entraineur as number), 0) / ratedCount
    : null;
  const delta = sportAvg != null && platformAvg != null ? sportAvg - platformAvg : null;
  const unratedPct = total > 0 ? Math.round((unratedCount / total) * 100) : 0;
  const ratedPct = total > 0 ? Math.round((ratedCount / total) * 100) : 0;
  const ratedBarColor = ratedPct < 25 ? "bg-red-500" : ratedPct < 50 ? "bg-amber-500" : "bg-green-500";

  const distributionBuckets: { label: string; count: number; tone: "green" | "amber" | "red" }[] = [
    { label: "★★★★★", count: ratedAthletes.filter((a) => (a.cote_globale_entraineur as number) === 5).length, tone: "green" },
    { label: "★★★★", count: ratedAthletes.filter((a) => { const v = a.cote_globale_entraineur as number; return v >= 4 && v < 5; }).length, tone: "green" },
    { label: "★★★", count: ratedAthletes.filter((a) => { const v = a.cote_globale_entraineur as number; return v >= 3 && v < 4; }).length, tone: "amber" },
    { label: "★★", count: ratedAthletes.filter((a) => { const v = a.cote_globale_entraineur as number; return v >= 2 && v < 3; }).length, tone: "red" },
    { label: "★", count: ratedAthletes.filter((a) => { const v = a.cote_globale_entraineur as number; return v >= 1 && v < 2; }).length, tone: "red" },
  ];

  let deltaLabel = "Identique";
  const deltaRounded = delta != null ? Math.round(delta * 10) / 10 : 0;
  if (delta != null && deltaRounded !== 0) {
    deltaLabel = `${deltaRounded > 0 ? "+" : ""}${deltaRounded.toFixed(1)} ${deltaRounded > 0 ? "au-dessus" : "en-dessous"}`;
  }
  const absDelta = delta != null ? Math.abs(delta) : 0;
  const deltaColor = delta == null ? "text-[#9CA3AF]" : absDelta > 1.0 ? "text-red-400" : absDelta > 0.5 ? "text-amber-400" : "text-[#9CA3AF]";

  const showCalibrationAlert = ratedCount >= 10 && delta != null && Math.abs(delta) > 1.0;
  const showLowEvalAlert = total >= 5 && unratedPct > 70;

  console.log("Calibration data:", { sportAvg, platformAvg, delta, rated: ratedCount, unrated: unratedCount });

  // Breakdowns
  const statusCounts = new Map<string, number>();
  for (const a of athletes) {
    const key = bucketRecruitmentStatus(a.statut_recrutement_override) ?? "NON_DEFINI";
    statusCounts.set(key, (statusCounts.get(key) || 0) + 1);
  }
  const statusOrder: (RecruitBucket | "NON_DEFINI")[] = ["OUVERT", "EN_PROCESSUS", "RECRUTE", "RETIRE", "NON_DEFINI"];

  const promoCounts = new Map<string, number>();
  for (const a of athletes) {
    const key = a.annee_diplomation == null || a.annee_diplomation === "" ? "Non défini" : String(a.annee_diplomation);
    promoCounts.set(key, (promoCounts.get(key) || 0) + 1);
  }
  const promoList = Array.from(promoCounts.entries()).sort((a, b) => {
    if (a[0] === "Non défini") return 1;
    if (b[0] === "Non défini") return -1;
    return b[0].localeCompare(a[0]);
  });

  const regionCounts = new Map<string, number>();
  for (const a of athletes) {
    const school = a.school_id ? schoolsMap.get(a.school_id) : null;
    const key = school?.region || "Non défini";
    regionCounts.set(key, (regionCounts.get(key) || 0) + 1);
  }
  const regionList = Array.from(regionCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Schools breakdown
  const schoolAgg = new Map<string, { athlete_count: number }>();
  for (const a of athletes) {
    if (!a.school_id) continue;
    const cur = schoolAgg.get(a.school_id) || { athlete_count: 0 };
    cur.athlete_count += 1;
    schoolAgg.set(a.school_id, cur);
  }
  const [schoolRows, setSchoolRows] = useState<SchoolRow[]>([]);
  useEffect(() => {
    async function loadCoaches() {
      if (schoolAgg.size === 0) {
        setSchoolRows([]);
        return;
      }
      const ids = Array.from(schoolAgg.keys());
      const { data } = await supabase
        .from("users")
        .select("school_id")
        .eq("role", "COACH")
        .eq("status", "ACTIF")
        .in("school_id", ids);
      const coachCount = new Map<string, number>();
      for (const u of (data || []) as { school_id: string | null }[]) {
        if (!u.school_id) continue;
        coachCount.set(u.school_id, (coachCount.get(u.school_id) || 0) + 1);
      }
      const rows: SchoolRow[] = ids
        .map((sid) => {
          const s = schoolsMap.get(sid);
          return {
            id: sid,
            name: s?.name || "—",
            region: s?.region ?? null,
            athlete_count: schoolAgg.get(sid)!.athlete_count,
            active_coaches: coachCount.get(sid) || 0,
          };
        })
        .sort((a, b) => b.athlete_count - a.athlete_count);
      setSchoolRows(rows);
    }
    loadCoaches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletes, schoolsMap]);

  // Position mutations
  async function addPosition() {
    const nom = newPosName.trim();
    if (!nom) return;
    const { error } = await supabase.from("positions").insert({ sport_id: id, nom });
    if (error) {
      notify(`Erreur : ${error.message}`);
      return;
    }
    setNewPosName("");
    notify("Position ajoutée");
    fetchAll();
  }

  async function savePosition(posId: string, patch: { nom?: string; abreviation?: string | null }) {
    const { error } = await supabase.from("positions").update(patch).eq("id", posId);
    if (error) {
      notify(`Erreur : ${error.message}`);
      return;
    }
    setPositions((prev) => prev.map((p) => (p.id === posId ? { ...p, ...patch } : p)));
    setEditingPos(null);
  }

  const displayedPositions = showAllPositions ? positions : positions.slice(0, 8);
  const remainingPositions = positions.length - 8;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/admin/sports"
          className="inline-flex items-center text-[12px] text-[#9CA3AF] hover:text-white transition-colors"
        >
          ← Gestion des sports
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="font-head text-3xl font-black text-white uppercase tracking-tight">
            {sportName || "Sport"}
          </h1>
          <div className="flex gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[12px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
            >
              Modifier le sport
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-[#2D3748] text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 transition-colors"
            >
              Désactiver
            </button>
          </div>
        </div>
      </div>

      {/* Imbalance banner */}
      {showImbalance && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[13px] text-amber-300">
            Déséquilibre offre/demande : {demand} recruteurs cherchent du {sportName} mais seulement {supply} athlètes sont disponibles
          </p>
        </div>
      )}

      {showCalibrationAlert && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[13px] text-amber-300">
            Les évaluations en {sportName} sont significativement {(delta as number) > 0 ? "au-dessus" : "en-dessous"} de la moyenne de la plateforme ({(sportAvg as number).toFixed(1)} vs {(platformAvg as number).toFixed(1)})
          </p>
        </div>
      )}

      {showLowEvalAlert && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[13px] text-amber-300">
            {unratedPct}% des athlètes en {sportName} n&apos;ont pas d&apos;évaluation de leur entraîneur
          </p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Athlètes</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{total}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">
            {verified} vérifiés · {unverified} non vérifiés
          </p>
          <div className="mt-3 h-1.5 bg-[#111317] rounded-full overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${verifiedPct}%` }} />
          </div>
        </div>

        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Coachs actifs</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{distinctCoaches.size}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">
            dans {distinctSchools.size} école{distinctSchools.size > 1 ? "s" : ""} différente{distinctSchools.size > 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Recruteurs intéressés</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{pipelineRecruiters}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">athlètes dans leur pipeline</p>
        </div>

        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Complétude moyenne</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{avgCompletion}%</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">des profils sont remplis</p>
          <div className="mt-3 h-1.5 bg-[#111317] rounded-full overflow-hidden">
            <div className={`h-full ${avgColor}`} style={{ width: `${avgCompletion}%` }} />
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <h3 className="font-head text-[13px] font-black text-white uppercase tracking-wide mb-3">Statut de recrutement</h3>
          <ul className="space-y-2">
            {statusOrder.map((k) => {
              const count = statusCounts.get(k as string) || 0;
              if (count === 0) return null;
              const bucket = (k === "NON_DEFINI" ? null : (k as RecruitBucket));
              return (
                <li key={k as string} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-[#E0E0E0]">
                    <span className={`w-2 h-2 rounded-full ${bucketDotClass(bucket)}`} />
                    {bucketLabel(bucket)}
                  </span>
                  <span className="text-[13px] text-white font-bold tabular-nums">{count}</span>
                </li>
              );
            })}
            {statusCounts.size === 0 && <li className="text-[12px] text-[#6b7280]">Aucun athlète.</li>}
          </ul>
        </div>

        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <h3 className="font-head text-[13px] font-black text-white uppercase tracking-wide mb-3">Par promotion</h3>
          <ul className="space-y-2">
            {promoList.map(([year, count]) => (
              <li key={year} className="flex items-center justify-between">
                <span className="text-[13px] text-[#E0E0E0]">{year}</span>
                <span className="text-[13px] text-white font-bold tabular-nums">{count}</span>
              </li>
            ))}
            {promoList.length === 0 && <li className="text-[12px] text-[#6b7280]">Aucun athlète.</li>}
          </ul>
        </div>

        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <h3 className="font-head text-[13px] font-black text-white uppercase tracking-wide mb-3">Par région</h3>
          <ul className="space-y-2">
            {regionList.map(([region, count]) => (
              <li key={region} className="flex items-center justify-between">
                <span className="text-[13px] text-[#E0E0E0]">{region}</span>
                <span className="text-[13px] text-white font-bold tabular-nums">{count}</span>
              </li>
            ))}
            {regionList.length === 0 && <li className="text-[12px] text-[#6b7280]">Aucun athlète.</li>}
          </ul>
        </div>
      </div>

      {/* Calibration des évaluations */}
      <div>
        <h2 className="font-head text-[13px] font-black text-white uppercase tracking-wide mb-3">
          Calibration des évaluations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
            <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Cote moyenne</p>
            <p className="font-head text-3xl font-black text-[#F59E0B] mt-1 tabular-nums">
              ★ {sportAvg != null ? sportAvg.toFixed(1) : "—"}
            </p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">
              Plateforme : ★ {platformAvg != null ? platformAvg.toFixed(1) : "—"}
            </p>
            <p className={`text-[12px] mt-0.5 font-bold ${deltaColor}`}>
              {delta == null ? "—" : deltaLabel}
            </p>
          </div>

          <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
            <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Athlètes évalués</p>
            <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">
              {ratedCount} / {total}
            </p>
            <div className="mt-3 h-1.5 bg-[#111317] rounded-full overflow-hidden">
              <div className={`h-full ${ratedBarColor}`} style={{ width: `${ratedPct}%` }} />
            </div>
            <p className="text-[12px] text-[#9CA3AF] mt-2">
              {unratedPct}% sans évaluation
            </p>
          </div>

          <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
            <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold mb-3">Distribution</p>
            {ratedCount === 0 ? (
              <p className="text-[12px] text-[#6b7280] text-center py-4">Aucune évaluation</p>
            ) : (
              <ul className="space-y-2">
                {distributionBuckets.filter((b) => b.count > 0).map((b) => {
                  const dot = b.tone === "green" ? "bg-green-500" : b.tone === "amber" ? "bg-amber-500" : "bg-red-500";
                  return (
                    <li key={b.label} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13px] text-[#F59E0B] tracking-[1px]">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        {b.label}
                      </span>
                      <span className="text-[13px] text-white font-bold tabular-nums">{b.count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Two-column: positions + recent athletes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Positions */}
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-head text-[13px] font-black text-white uppercase tracking-wide">
              Positions ({positions.length})
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nom de la position"
                value={newPosName}
                onChange={(e) => setNewPosName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPosition()}
                className="bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-1.5 text-[12px] text-white focus:outline-none focus:border-[#E63946]/50 w-40"
              />
              <button
                type="button"
                onClick={addPosition}
                className="px-3 py-1.5 rounded-lg bg-[#E63946] text-white font-bold text-[11px] uppercase tracking-wider hover:bg-[#D93C3C] transition-colors"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {positions.length === 0 ? (
            <p className="text-[13px] text-[#6b7280]">Aucune position pour ce sport.</p>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2D3748]">
                    <th className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2">Position</th>
                    <th className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-24">Abrév.</th>
                    <th className="text-right text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-24">Athlètes</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {displayedPositions.map((p) => (
                    <PositionRow
                      key={p.id}
                      pos={p}
                      editing={editingPos === p.id}
                      onEdit={() => setEditingPos(p.id)}
                      onCancel={() => setEditingPos(null)}
                      onSave={(patch) => savePosition(p.id, patch)}
                    />
                  ))}
                </tbody>
              </table>
              {!showAllPositions && remainingPositions > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllPositions(true)}
                  className="mt-3 text-[12px] text-[#E63946] hover:underline"
                >
                  Voir les {remainingPositions} autres...
                </button>
              )}
            </>
          )}
        </div>

        {/* Recent athletes */}
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-head text-[13px] font-black text-white uppercase tracking-wide">Athlètes récents</h3>
            <Link href="/admin/athletes" className="text-[12px] text-[#E63946] hover:underline">
              Voir tous →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-[13px] text-[#6b7280]">Aucun athlète.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((a) => {
                const name = `${a.first_name || ""} ${a.last_name || ""}`.trim() || "—";
                const initials = `${(a.first_name || "?")[0]}${(a.last_name || "?")[0]}`.toUpperCase();
                const bucket = bucketRecruitmentStatus(a.statut_recrutement_override);
                const subtitleParts = [a.position_nom, a.school_name, a.annee_diplomation ? String(a.annee_diplomation) : null].filter(Boolean);
                return (
                  <li key={a.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center text-[12px] font-bold text-white shrink-0 overflow-hidden">
                      {a.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.photo_url} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/athletes/${a.id}`} className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors block truncate">
                        {name}
                      </Link>
                      <p className="text-[11px] text-[#9CA3AF] truncate">
                        {subtitleParts.join(" · ") || "—"}
                      </p>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${bucketBadgeClass(bucket)}`}>
                      {bucketLabel(bucket).toUpperCase()}
                    </span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill={a.verified ? "#3B82F6" : "#4a4d56"}
                      stroke="none"
                      className="shrink-0"
                      aria-label={a.verified ? "Vérifié" : "Non vérifié"}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path
                        d="M9 12l2 2 4-4"
                        stroke={a.verified ? "#fff" : "#6b7280"}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Schools table */}
      <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
        <h3 className="font-head text-[13px] font-black text-white uppercase tracking-wide mb-4">
          Écoles avec des athlètes en {sportName}
        </h3>
        {schoolRows.length === 0 ? (
          <p className="text-[13px] text-[#6b7280]">Aucune école.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2D3748]">
                <th className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2">École</th>
                <th className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2">Région</th>
                <th className="text-right text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-24">Athlètes</th>
                <th className="text-right text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-24">Coach</th>
              </tr>
            </thead>
            <tbody>
              {schoolRows.map((s) => (
                <tr key={s.id} className="border-b border-[#2D3748]/50 hover:bg-[#22252D] cursor-pointer" onClick={() => router.push(`/admin/schools/${s.id}`)}>
                  <td className="py-2.5 text-[13px] text-white font-bold">{s.name}</td>
                  <td className="py-2.5 text-[13px] text-[#E0E0E0]">{s.region || <span className="text-[#4a4d56]">—</span>}</td>
                  <td className="py-2.5 text-[13px] text-[#E0E0E0] text-right tabular-nums">{s.athlete_count}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${s.active_coaches > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                    >
                      {s.active_coaches > 0 ? "Actif" : "Aucun"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#E63946] rounded-lg px-5 py-3 text-[13px] text-white shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function PositionRow({
  pos,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  pos: Position;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: { nom?: string; abreviation?: string | null }) => void;
}) {
  const [nom, setNom] = useState(pos.nom);
  const [abrev, setAbrev] = useState(pos.abreviation || "");

  useEffect(() => {
    setNom(pos.nom);
    setAbrev(pos.abreviation || "");
  }, [pos.nom, pos.abreviation]);

  function commit() {
    const patch: { nom?: string; abreviation?: string | null } = {};
    if (nom !== pos.nom) patch.nom = nom;
    if ((abrev || null) !== (pos.abreviation || null)) patch.abreviation = abrev || null;
    if (Object.keys(patch).length > 0) onSave(patch);
    else onCancel();
  }

  if (editing) {
    return (
      <tr className="border-b border-[#2D3748]/50">
        <td className="py-2">
          <input
            autoFocus
            type="text"
            title="Nom de la position"
            placeholder="Nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") onCancel();
            }}
            className="bg-[#111317] border border-[#E63946]/50 rounded px-2 py-1 text-[13px] text-white w-full focus:outline-none"
          />
        </td>
        <td className="py-2">
          <input
            type="text"
            title="Abréviation"
            placeholder="Abrév."
            value={abrev}
            onChange={(e) => setAbrev(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") onCancel();
            }}
            className="bg-[#111317] border border-[#2D3748] rounded px-2 py-1 text-[12px] text-white w-20 focus:outline-none focus:border-[#E63946]/50"
          />
        </td>
        <td className="py-2 text-right text-[13px] text-[#E0E0E0] tabular-nums">{pos.athlete_count}</td>
        <td />
      </tr>
    );
  }

  return (
    <tr className="border-b border-[#2D3748]/50 group">
      <td className="py-2.5 text-[13px] text-white">{pos.nom}</td>
      <td className="py-2.5 text-[12px] text-[#6b7280]">{pos.abreviation || ""}</td>
      <td className="py-2.5 text-right text-[13px] text-[#E0E0E0] tabular-nums">{pos.athlete_count}</td>
      <td className="py-2.5 text-right">
        <button
          type="button"
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-[#E63946] transition-all p-1"
          title="Modifier"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
