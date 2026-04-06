"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   Mes Favoris — 3-section priority layout
   🔴 URGENT  — competitor ahead OR stale
   ⏱ À ACTIVER — stale only (no competitor pressure)
   ● ACTIFS — everything else
═══════════════════════════════════════════════════════════════ */

/* ── Shared urgency logic ────────────────────────────────────── */

const STAGE_ORDER: Record<string, number> = {
  IDENTIFIE: 1, CONTACTE: 2, EN_DISCUSSION: 3,
  VISITE_PLANIFIEE: 4, ENGAGE: 5, LETTRE_SIGNEE: 6,
};

const STALE_THRESHOLDS: Record<string, number> = {
  IDENTIFIE: 14, CONTACTE: 7, EN_DISCUSSION: 10,
  VISITE_PLANIFIEE: 5, ENGAGE: 14, LETTRE_SIGNEE: 0, "RETIRÉ": 0,
};

function isStaleFn(stage: string | null, movedAt: string | null): boolean {
  if (!stage || !movedAt) return false;
  const upper = stage.toUpperCase();
  const threshold = STALE_THRESHOLDS[upper];
  if (!threshold) return false;
  const days = Math.floor((Date.now() - new Date(movedAt).getTime()) / 86400000);
  return days >= threshold;
}

function isCompetitorAheadFn(
  athleteId: string,
  myStage: string | null,
  competitorMap: Record<string, number>,
): boolean {
  const myOrder = STAGE_ORDER[(myStage || "").toUpperCase()] ?? 0;
  const competitorOrder = competitorMap[athleteId] ?? 0;
  return competitorOrder > myOrder;
}

interface FavoriAthlete {
  id: string;
  firstName: string;
  lastName: string;
  photo: string;
  position: string;
  sport: string;
  school: string;
  region: string;
  graduationYear: number;
  stars: number;
  isVerified: boolean;
  hasVideo: boolean;
  heightWeight: string;
  favoritedAt: string;
  pipelineStage: string | null;
  pipelineMovedAt: string | null;
  daysIdle: number;
  favCount: number;
  jersey: string;
  competitorAhead: boolean;
  stale: boolean;
  urgent: boolean;
}

/* ── Stage labels & colors ─────────────────────────────────── */

const STAGE_LABELS: Record<string, string> = {
  IDENTIFIE: "Identifié", CONTACTE: "Contacté", EN_DISCUSSION: "En discussion",
  VISITE_PLANIFIEE: "Visite planifiée", ENGAGE: "Engagé", LETTRE_SIGNEE: "Lettre signée",
};

const STAGE_COLORS: Record<string, string> = {
  IDENTIFIE: "#6B7280", CONTACTE: "#6B7280", EN_DISCUSSION: "#E63946",
  VISITE_PLANIFIEE: "#E63946", ENGAGE: "#E63946", LETTRE_SIGNEE: "#22C55E",
};

/* ── Compact card ───────────────────────────────────────────── */

function FavoriCard({ a, onUnfavorite }: { a: FavoriAthlete; onUnfavorite: (id: string) => void }) {
  const stageKey = (a.pipelineStage || "").toUpperCase();
  const stageLabel = STAGE_LABELS[stageKey] || "Identifié";
  const stageColor = STAGE_COLORS[stageKey] || "#6B7280";

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] transition-all duration-300 ease-out flex h-[100px]">
      {/* Photo */}
      <div className="relative w-[100px] sm:w-[130px] shrink-0 bg-[#2F3440]">
        {a.photo ? (
          <img src={a.photo} alt={`${a.firstName} ${a.lastName}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[28px] font-head font-black text-white/5">{a.firstName[0]}{a.lastName[0]}</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, transparent 40%, rgba(26,29,36,0.95) 100%)" }} />
        <div className="absolute top-2 left-2 z-10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill={a.isVerified ? "#3B82F6" : "#4a4d56"} stroke="none">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" stroke={a.isVerified ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/recruteur/athletes/${a.id}`} className="text-[15px] font-bold text-white hover:text-[#E63946] transition-colors truncate">
              {a.firstName} {a.lastName}
            </Link>
            {a.jersey && <span className="text-[12px] font-bold text-[#4a4d56]">#{a.jersey}</span>}
            {a.position && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{a.position}</span>
            )}
            <div className="flex items-center gap-0.5 shrink-0">
              {Array.from({ length: 5 }, (_, i) => (
                <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#4a4d56"} stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
          </div>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5 truncate">
            {a.school} <span className="text-[#4a4d56]">·</span> {a.graduationYear}
            {a.heightWeight && <><span className="text-[#4a4d56]"> · </span>{a.heightWeight}</>}
          </p>
          {a.competitorAhead && (
            <p className="text-[10px] text-[#E63946] mt-0.5">⚠️ Un autre CÉGEP est plus avancé</p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
            style={{ color: stageColor, borderColor: stageColor, backgroundColor: `${stageColor}15` }}
          >
            {stageLabel}
          </span>
          {a.favCount > 1 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#E63946] font-bold" title={`${a.favCount} recruteurs`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
              {a.favCount}
            </span>
          )}
          {a.daysIdle > 0 && (
            <span className={`text-[11px] font-medium ${a.stale ? "text-[#F59E0B]" : "text-[#6b7280]"}`}>{a.daysIdle}j inactif</span>
          )}
          <div className="flex-1" />
          <button type="button" onClick={() => onUnfavorite(a.id)} className="text-[#E63946] hover:text-[#6b7280] transition-colors p-1" title="Retirer des favoris">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
          </button>
          <Link href={`/recruteur/athletes/${a.id}`} className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1">
            Voir <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Section header ─────────────────────────────────────────── */

function SectionHeader({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-8 first:mt-0">
      <span className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity" style={{ backgroundColor: color, opacity: count > 0 ? 1 : 0.3 }} />
      <h2 className="font-head text-[14px] font-black text-white uppercase tracking-wider">{label}</h2>
      <span className="text-[12px] font-bold text-[#6b7280]">({count})</span>
      <div className="flex-1 h-px bg-[#2D3748]" />
    </div>
  );
}

/* ── Filter chip types ─────────────────────────────────────── */
type FilterChip = "tous" | "urgent" | "a_activer" | "actifs";

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function FavorisPage() {
  return (
    <Suspense fallback={<div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>}>
      <FavorisContent />
    </Suspense>
  );
}

function FavorisContent() {
  const [athletes, setAthletes] = useState<FavoriAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [chipFilter, setChipFilter] = useState<FilterChip>("tous");

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // 1. Load favorites with athlete data
    const { data: favData } = await supabase
      .from("recruiter_favorites")
      .select(`
        id, athlete_id, created_at,
        athletes!athlete_id(
          id, first_name, last_name, photo_url, verified,
          video_faits_saillants_url, annee_diplomation,
          cote_globale_entraineur, numero_jersey, taille_pieds, taille_pouces, poids_lbs,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          schools!school_id(name, region),
          evaluations(cote_globale)
        )
      `)
      .eq("recruiter_id", user.id);

    if (!favData || favData.length === 0) {
      setAthletes([]);
      setLoading(false);
      return;
    }

    const athleteIds = favData.map((f: Record<string, unknown>) => {
      const aRaw = f.athletes;
      const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as Record<string, unknown> | null;
      return (a?.id as string) || (f.athlete_id as string);
    });

    // 2. My pipeline stages
    const { data: pipelineData } = await supabase
      .from("recruiter_pipeline")
      .select("athlete_id, stage, moved_at")
      .eq("recruiter_id", user.id)
      .in("athlete_id", athleteIds);

    const pipelineMap = new Map<string, { stage: string; movedAt: string }>();
    if (pipelineData) {
      for (const p of pipelineData) pipelineMap.set(p.athlete_id, { stage: p.stage, movedAt: p.moved_at });
    }

    // 3. Competitor stages
    const { data: competitorData } = await supabase
      .from("recruiter_pipeline")
      .select("athlete_id, stage")
      .in("athlete_id", athleteIds)
      .neq("recruiter_id", user.id)
      .neq("stage", "RETIRÉ");

    console.log("[Competitor stages]", competitorData);

    const competitorMap: Record<string, number> = {};
    if (competitorData) {
      for (const row of competitorData) {
        const order = STAGE_ORDER[row.stage] ?? 0;
        if (!competitorMap[row.athlete_id] || order > competitorMap[row.athlete_id]) {
          competitorMap[row.athlete_id] = order;
        }
      }
    }

    // 4. Last note date
    const { data: notesData } = await supabase
      .from("recruiter_notes")
      .select("athlete_id, created_at")
      .eq("recruiter_id", user.id)
      .in("athlete_id", athleteIds)
      .order("created_at", { ascending: false });

    const lastNoteMap = new Map<string, string>();
    if (notesData) {
      for (const n of notesData) {
        if (!lastNoteMap.has(n.athlete_id)) lastNoteMap.set(n.athlete_id, n.created_at);
      }
    }

    // 5. Last view date
    const { data: viewsData } = await supabase
      .from("recruiter_athlete_views")
      .select("athlete_id, viewed_at")
      .eq("recruiter_id", user.id)
      .in("athlete_id", athleteIds)
      .order("viewed_at", { ascending: false });

    const lastViewMap = new Map<string, string>();
    if (viewsData) {
      for (const v of viewsData) {
        if (!lastViewMap.has(v.athlete_id)) lastViewMap.set(v.athlete_id, v.viewed_at);
      }
    }

    // 6. Fav counts
    const { data: favCountData } = await supabase
      .from("recruiter_favorites")
      .select("athlete_id")
      .in("athlete_id", athleteIds);

    const favCountMap = new Map<string, number>();
    if (favCountData) {
      for (const fc of favCountData) favCountMap.set(fc.athlete_id, (favCountMap.get(fc.athlete_id) || 0) + 1);
    }

    // 7. Map everything
    const now = Date.now();
    const mapped: FavoriAthlete[] = favData.map((f: Record<string, unknown>) => {
      const aRaw = f.athletes;
      const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as Record<string, unknown> | null;
      const sportRel = a?.sports;
      const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
      const posRel = a?.positions;
      const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
      const schoolRel = a?.schools;
      const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string; region?: string } | null;
      const evalRel = a?.evaluations;
      const eval0 = (Array.isArray(evalRel) ? evalRel[0] : evalRel) as Record<string, unknown> | null;

      const athleteId = (a?.id as string) || (f.athlete_id as string);
      const ft = a?.taille_pieds as number | null;
      const inches = a?.taille_pouces as number | null;
      const lbs = a?.poids_lbs as number | null;
      const hwParts: string[] = [];
      if (ft) hwParts.push(`${ft}'${inches || 0}"`);
      if (lbs) hwParts.push(`${lbs} lbs`);

      const pipeline = pipelineMap.get(athleteId);
      const dates = [
        f.created_at as string, pipeline?.movedAt,
        lastNoteMap.get(athleteId), lastViewMap.get(athleteId),
      ].filter(Boolean) as string[];
      const mostRecent = dates.length > 0 ? Math.max(...dates.map(d => new Date(d).getTime())) : now;
      const daysIdle = Math.floor((now - mostRecent) / 86400000);

      const myStage = pipeline?.stage || null;
      const stale = isStaleFn(myStage, pipeline?.movedAt || null);
      const competitorAhead = isCompetitorAheadFn(athleteId, myStage, competitorMap);
      const urgent = competitorAhead || stale;

      console.log("[Urgency]", a?.first_name, {
        myStage, competitorOrder: competitorMap[athleteId],
        stale, urgent,
      });

      return {
        id: athleteId,
        firstName: (a?.first_name as string) || "Athlète",
        lastName: (a?.last_name as string) || "",
        photo: (a?.photo_url as string) || "",
        position: pos?.abreviation || "",
        sport: sport?.nom || "",
        school: school?.name || "",
        region: school?.region || "",
        graduationYear: (a?.annee_diplomation as number) || 0,
        stars: (eval0?.cote_globale as number) ?? (a?.cote_globale_entraineur as number) ?? 0,
        isVerified: !!(a?.verified),
        hasVideo: !!(a?.video_faits_saillants_url),
        heightWeight: hwParts.join(" · "),
        favoritedAt: (f.created_at as string) || "",
        pipelineStage: myStage,
        pipelineMovedAt: pipeline?.movedAt || null,
        daysIdle,
        favCount: favCountMap.get(athleteId) || 1,
        jersey: a?.numero_jersey ? String(a.numero_jersey) : "",
        competitorAhead,
        stale,
        urgent,
      };
    });

    setAthletes(mapped);
    setLoading(false);
  }

  const handleUnfavorite = useCallback(async (athleteId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("recruiter_favorites").delete().eq("recruiter_id", user.id).eq("athlete_id", athleteId);
    setAthletes(prev => prev.filter(a => a.id !== athleteId));
  }, []);

  /* ── Section split ───────────────────────────────────────── */
  const { urgentList, aActiverList, activeList } = useMemo(() => {
    const urgentList: FavoriAthlete[] = [];
    const aActiverList: FavoriAthlete[] = [];
    const activeList: FavoriAthlete[] = [];

    for (const a of athletes) {
      if (a.urgent) {
        urgentList.push(a);
      } else if (a.stale && !a.competitorAhead) {
        aActiverList.push(a);
      } else {
        activeList.push(a);
      }
    }

    urgentList.sort((a, b) => b.daysIdle - a.daysIdle);
    aActiverList.sort((a, b) => b.daysIdle - a.daysIdle);
    activeList.sort((a, b) => new Date(b.favoritedAt).getTime() - new Date(a.favoritedAt).getTime());

    return { urgentList, aActiverList, activeList };
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    switch (chipFilter) {
      case "urgent": return urgentList;
      case "a_activer": return aActiverList;
      case "actifs": return activeList;
      default: return athletes;
    }
  }, [chipFilter, athletes, urgentList, aActiverList, activeList]);

  if (loading) {
    return <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>;
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Mes favoris</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">{athletes.length} athlète{athletes.length !== 1 ? "s" : ""} suivi{athletes.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/recruteur/recherche" className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-2.5 font-head font-bold text-[12px] uppercase tracking-widest transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 active:scale-95 self-start">
          Rechercher
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
        </Link>
      </div>

      {athletes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
          </div>
          <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucun favori</h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed mb-6">Explore les athlètes et clique le coeur pour commencer à bâtir ta liste.</p>
          <Link href="/recruteur/recherche" className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-head font-bold text-[13px] uppercase tracking-widest transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 active:scale-95">
            Rechercher des athlètes
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      ) : (
        <>
          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {([
              { key: "tous" as FilterChip, label: "Tous", count: athletes.length, dot: null },
              { key: "urgent" as FilterChip, label: "Urgent", count: urgentList.length, dot: "#E63946" },
              { key: "a_activer" as FilterChip, label: "À activer", count: aActiverList.length, dot: "#F59E0B" },
              { key: "actifs" as FilterChip, label: "Actifs", count: activeList.length, dot: "#22C55E" },
            ]).map(chip => {
              const isActive = chipFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setChipFilter(chip.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border transition-all ${
                    isActive ? "border-white/20 bg-white/10 text-white" : "border-transparent bg-transparent text-[#6b7280] hover:text-[#9CA3AF]"
                  }`}
                >
                  {chip.dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: chip.dot, opacity: chip.count > 0 ? 1 : 0.3 }} />}
                  {chip.label} <span className={isActive ? "text-white/60" : "text-[#4a4d56]"}>{chip.count}</span>
                </button>
              );
            })}
          </div>

          {chipFilter === "tous" ? (
            <>
              {urgentList.length > 0 && (
                <div>
                  <SectionHeader color="#E63946" label="Urgent" count={urgentList.length} />
                  <div className="space-y-3">
                    {urgentList.map(a => <FavoriCard key={a.id} a={a} onUnfavorite={handleUnfavorite} />)}
                  </div>
                </div>
              )}
              {aActiverList.length > 0 && (
                <div>
                  <SectionHeader color="#F59E0B" label="À activer" count={aActiverList.length} />
                  <div className="space-y-3">
                    {aActiverList.map(a => <FavoriCard key={a.id} a={a} onUnfavorite={handleUnfavorite} />)}
                  </div>
                </div>
              )}
              <div>
                <SectionHeader color="#22C55E" label="Actifs" count={activeList.length} />
                {activeList.length > 0 ? (
                  <div className="space-y-3">
                    {activeList.map(a => <FavoriCard key={a.id} a={a} onUnfavorite={handleUnfavorite} />)}
                  </div>
                ) : (
                  <p className="text-[14px] text-[#6b7280] py-4 text-center">Tous tes favoris nécessitent une action.</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {filteredAthletes.length === 0 ? (
                <p className="text-[14px] text-[#6b7280] py-8 text-center">Aucun athlète dans cette catégorie.</p>
              ) : filteredAthletes.map(a => <FavoriCard key={a.id} a={a} onUnfavorite={handleUnfavorite} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
