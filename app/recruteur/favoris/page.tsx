"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import NxIcon from "@/components/ui/NxIcon";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import AthletePhoto from "@/components/shared/AthletePhoto";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { useFavoriteAthletes } from "@/lib/queries/recruiter/useFavoriteAthletes";
import { HeartButton } from "@/components/mobile/HeartButton";
import { RecruteurFavorisMobile } from "@/components/shared/RecruteurFavorisMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Mes Favoris — Grid/List view with filters
   Same layout as coach "Mes Athlètes"
═══════════════════════════════════════════════════════════════ */

interface FavoriAthlete {
  id: string;
  firstName: string;
  lastName: string;
  photo: string;
  position: string;
  sport: string;
  sportName: string;
  school: string;
  region: string;
  graduationYear: number;
  stars: number;
  isVerified: boolean;
  lastValidation?: string | null;
  hasVideo: boolean;
  heightWeight: string;
  favoritedAt: string;
  pipelineStage: string | null;
  pipelineMovedAt: string | null;
  daysIdle: number;
  favCount: number;
  jersey: string;
  recruitmentStatus: string;
  committedSchoolName: string;
  openToOffers: boolean | null;
  badges: { badgeId: string; label: string; icon: string }[];
  // "Ligue Civile" = no school anchor on the athlete row. Post-Phase
  // 6.1 civil athletes are anchored via school_id to a LIGUE_CIVILE
  // school, so noTeam only fires for orphans (school_id NULL).
  noTeam: boolean;
}

/* ── Grid Card (same as coach Mes Athlètes) ──────────────── */

function FavoriGridCard({ a, onUnfavorite }: { a: FavoriAthlete; onUnfavorite: (id: string) => void }) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 ease-out group flex flex-col">
      {/* Photo */}
      <div className="relative h-[180px] bg-[#2F3440] overflow-hidden">
        <AthletePhotoFill
          photoUrl={a.photo}
          firstName={a.firstName}
          lastName={a.lastName}
          initialsFontSize={72}
          className="object-[center_15%]"
        />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }} />

        {/* Top left — verified + unfavorite */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          {(() => {
            const active = a.isVerified && !isValidationExpired({
              verified: !!a.isVerified,
              last_profile_validation: a.lastValidation ?? null,
            });
            return (
              <svg width="28" height="28" viewBox="0 0 24 24" fill={active ? "#3B82F6" : "#4a4d56"} stroke="none">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke={active ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            );
          })()}
          {a.favCount > 1 && (
            <span className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
              <span className="text-[11px] font-bold text-white">{a.favCount}</span>
            </span>
          )}
        </div>

        {/* Top right — stars */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#4a4d56"} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        {/* Name + position + jersey */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/recruteur/athletes/${a.id}`} className="text-[17px] font-bold text-white hover:text-[#E63946] transition-colors">
            {a.firstName} {a.lastName}
          </Link>
          {a.position && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[12px] font-bold uppercase tracking-wider">{a.position}</span>
          )}
          {a.jersey && <span className="text-[13px] font-black text-[#E63946]">#{a.jersey}</span>}
        </div>

        {/* Recruitment status */}
        <div className="mt-1.5">
          <RecruitmentStatusBadge
            status={(a.recruitmentStatus || "OUVERT") as GlobalRecruitmentStatus}
            committedSchoolName={a.committedSchoolName || undefined}
            size="sm"
          />
        </div>

        {/* School · Promotion (or "Ligue Civile" badge) */}
        <p className="text-[13px] text-[#c0c4cc] mt-1 flex items-center gap-2 flex-wrap">
          {a.noTeam ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Ligue Civile
            </span>
          ) : (
            <span>{a.school}</span>
          )}
          {a.graduationYear > 0 && <><span className="text-[#4a4d56]">·</span><span>Promotion {a.graduationYear}</span></>}
        </p>

        {/* Height / Weight */}
        {a.heightWeight && (
          <p className="text-[13px] text-[#9CA3AF]">{a.heightWeight}</p>
        )}

        {/* Badges */}
        {a.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {a.badges.slice(0, 2).map((b) => (
              <span key={b.badgeId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[12px] font-bold text-[#E63946]">
                <NxIcon name={b.icon} size={12} className="text-[#E63946]" /> {b.label}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-[#2D3748]/60">
          <span className="text-[12px] text-[#6b7280]">{a.region}</span>
          <div className="flex items-center gap-3">
            {/* HeartButton premium (iter 5.4) */}
            <HeartButton isFavorited={true} onToggle={() => onUnfavorite(a.id)} size="sm" />
            <Link href={`/recruteur/athletes/${a.id}`} className="text-[13px] font-semibold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1">
              Voir <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── List Row ────────────────────────────────────────────────── */

function FavoriListRow({ a, onUnfavorite }: { a: FavoriAthlete; onUnfavorite: (id: string) => void }) {
  return (
    <div className="bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] transition-all duration-300 ease-out flex items-center px-4 py-3 gap-4">
      {/* Avatar */}
      <div className="relative w-12 h-12 shrink-0" style={{ overflow: "visible" }}>
        <AthletePhoto
          photoUrl={a.photo}
          firstName={a.firstName}
          lastName={a.lastName}
          size={48}
        />
        <div className="absolute -top-1 -right-1 z-10">
          {(() => {
            const active = a.isVerified && !isValidationExpired({
              verified: !!a.isVerified,
              last_profile_validation: a.lastValidation ?? null,
            });
            return (
              <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#3B82F6" : "#4a4d56"} stroke="none">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke={active ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            );
          })()}
        </div>
      </div>

      {/* Name + school (or "Ligue Civile" badge) — fixed width */}
      <div className="w-[200px] shrink-0">
        <Link href={`/recruteur/athletes/${a.id}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate block">
          {a.firstName} {a.lastName}
        </Link>
        <p className="text-[12px] text-[#6b7280] truncate flex items-center gap-1.5">
          {a.noTeam ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Ligue Civile
            </span>
          ) : (
            <span className="truncate">{a.school}</span>
          )}
          <span>· {a.graduationYear}</span>
        </p>
      </div>

      {/* Position — fixed width */}
      <div className="w-[50px] shrink-0">
        {a.position ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{a.position}</span>
        ) : <span />}
      </div>

      {/* Status — fixed width */}
      <div className="w-[140px] shrink-0">
        <RecruitmentStatusBadge status={(a.recruitmentStatus || "OUVERT") as GlobalRecruitmentStatus} size="sm" />
      </div>

      {/* Stars — fixed width */}
      <div className="w-[120px] shrink-0">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
          <span className="text-[11px] font-bold text-[#F59E0B] ml-0.5">{a.stars.toFixed(1)}</span>
        </div>
      </div>

      {/* Height/weight — fixed width */}
      <div className="w-[100px] shrink-0">
        <span className="text-[12px] text-[#6b7280]">{a.heightWeight || ""}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* HeartButton premium (iter 5.4) */}
      <div className="shrink-0">
        <HeartButton isFavorited={true} onToggle={() => onUnfavorite(a.id)} size="sm" />
      </div>
      <Link href={`/recruteur/athletes/${a.id}`} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors flex items-center gap-1 shrink-0">
        Voir <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function FavorisPage() {
  // Iter 7.9 Section 8 — dispatch IS_CAPACITOR vers la version mobile dédiée.
  if (IS_CAPACITOR) return <RecruteurFavorisMobile />;
  return (
    <Suspense fallback={<div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>}>
      <FavorisContent />
    </Suspense>
  );
}

function FavorisContent() {
  // `tierLoading` inclus dans le garde `loading` plus bas : le Provider défaute
  // tier→"free" (maxFavorites=10) avant le fetch — sans ça, un All Star (illimité)
  // verrait « X / 10 » flasher au login. On attend le tier avant d'afficher le cap.
  const { maxFavorites, loading: tierLoading } = useSubscription();
  // Migration TanStack (iter 5.3a) — fetch + transformation déléguées
  const { athletes, isLoading: dataLoading } = useFavoriteAthletes();
  const loading = dataLoading || tierLoading;
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");
  const [region, setRegion] = useState("");
  const [promotion, setPromotion] = useState("");
  const [minRating, setMinRating] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withVideoOnly, setWithVideoOnly] = useState(false);
  const [withSportBadge, setWithSportBadge] = useState(false);
  const [withAcademicBadge, setWithAcademicBadge] = useState(false);

  // Mutation : retirer un favori + invalider les caches concernés (iter 5.3a)
  const handleUnfavorite = useCallback(async (athleteId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase
      .from("recruiter_favorites")
      .select("id")
      .eq("recruiter_id", user.id)
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (existing) {
      await supabase.from("recruiter_favorites").delete().eq("id", existing.id);
    }
    // Invalidations TanStack : la liste des favoris + counts globaux + KPI dashboard
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
    queryClient.invalidateQueries({ queryKey: ["favoriteCounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
  }, [queryClient]);

  // Derived filter options
  const sports = useMemo(() => {
    const s = new Set(athletes.map(a => a.sportName).filter(Boolean));
    return Array.from(s).sort();
  }, [athletes]);

  const regions = useMemo(() => {
    const r = new Set(athletes.map(a => a.region).filter(Boolean));
    return Array.from(r).sort();
  }, [athletes]);

  const promotions = useMemo(() => {
    const p = new Set(athletes.map(a => a.graduationYear).filter(Boolean));
    return Array.from(p).sort().map(String);
  }, [athletes]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = [...athletes];
    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(a => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q));
    }
    if (sport) list = list.filter(a => a.sport === sport);
    if (region) list = list.filter(a => a.region === region);
    if (promotion) list = list.filter(a => a.graduationYear === parseInt(promotion));
    if (minRating) list = list.filter(a => a.stars >= parseFloat(minRating));
    if (verifiedOnly) list = list.filter(a => a.isVerified);
    if (withVideoOnly) list = list.filter(a => a.hasVideo);
    if (withSportBadge) list = list.filter(a => a.badges.length > 0);
    if (withAcademicBadge) list = list.filter(a => false); // no academic badges on FavoriAthlete yet
    list.sort((a, b) => b.stars - a.stars);
    return list;
  }, [athletes, search, sport, region, promotion, minRating, verifiedOnly, withVideoOnly, withSportBadge, withAcademicBadge]);

  if (loading) {
    return <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>;
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Mes favoris</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">
            {maxFavorites === -1
              ? <>Favoris&nbsp;: <span className="font-bold text-white">{athletes.length}</span></>
              : <>Favoris&nbsp;: <span className={`font-bold ${athletes.length >= maxFavorites ? "text-[#E63946]" : "text-white"}`}>{athletes.length} / {maxFavorites}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-[#6b7280]">{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center bg-[#13151a] border border-[#2a2d36] rounded-lg overflow-hidden">
            <button type="button" title="Vue grille" onClick={() => setViewMode("grid")} className={`p-2 transition-colors ${viewMode === "grid" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
            </button>
            <button type="button" title="Vue liste" onClick={() => setViewMode("list")} className={`p-2 transition-colors ${viewMode === "list" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>
            </button>
          </div>
          <Link href="/recruteur/recherche" className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-5 py-2.5 font-head font-bold text-[12px] uppercase tracking-widest transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 active:scale-95">
            Rechercher <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input type="text" placeholder="Rechercher par nom..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <select value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Sport" className={`nx-filter-select${sport ? " nx-filter-active" : ""}`}>
            <option value="">Tous les sports</option>
            {sports.map(s => <option key={s} value={s.toLowerCase().replace(/ /g, "_")}>{s}</option>)}
          </select>

          <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Région" className={`nx-filter-select${region ? " nx-filter-active" : ""}`}>
            <option value="">Toutes les régions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select value={promotion} onChange={(e) => setPromotion(e.target.value)} aria-label="Promotion" className={`nx-filter-select${promotion ? " nx-filter-active" : ""}`}>
            <option value="">Toutes les promotions</option>
            {promotions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={minRating} onChange={(e) => setMinRating(e.target.value)} aria-label="Cote minimum" className={`nx-filter-select${minRating ? " nx-filter-active" : ""}`}>
            <option value="">Toutes les cotes</option>
            <option value="1">★ 1+</option>
            <option value="2">★★ 2+</option>
            <option value="3">★★★ 3+</option>
            <option value="4">★★★★ 4+</option>
            <option value="5">★★★★★ 5</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={withSportBadge} onChange={(e) => setWithSportBadge(e.target.checked)} className="sr-only" />
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${withSportBadge ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a]"}`}>
              {withSportBadge && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <span className={`text-[13px] font-semibold ${withSportBadge ? "text-white" : "text-[#9CA3AF]"}`}>Avec distinction sportive</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={withAcademicBadge} onChange={(e) => setWithAcademicBadge(e.target.checked)} className="sr-only" />
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${withAcademicBadge ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a]"}`}>
              {withAcademicBadge && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <span className={`text-[13px] font-semibold ${withAcademicBadge ? "text-white" : "text-[#9CA3AF]"}`}>Mention académique</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="sr-only" />
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${verifiedOnly ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a]"}`}>
              {verifiedOnly && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <span className={`text-[13px] font-semibold ${verifiedOnly ? "text-white" : "text-[#9CA3AF]"}`}>Vérifié seulement</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={withVideoOnly} onChange={(e) => setWithVideoOnly(e.target.checked)} className="sr-only" />
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${withVideoOnly ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a]"}`}>
              {withVideoOnly && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
            <span className={`text-[13px] font-semibold ${withVideoOnly ? "text-white" : "text-[#9CA3AF]"}`}>Avec vidéo</span>
          </label>
        </div>
      </div>

      {/* Empty */}
      {athletes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
          </div>
          <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucun favori</h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed mb-6">Explore les athlètes et clique le coeur pour commencer à bâtir ta liste.</p>
          <Link href="/recruteur/recherche" className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-head font-bold text-[13px] uppercase tracking-widest transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 active:scale-95">
            Rechercher des athlètes <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[14px] text-[#6b7280]">Aucun favori ne correspond à tes critères.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(a => <FavoriGridCard key={a.id} a={a} onUnfavorite={handleUnfavorite} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(a => <FavoriListRow key={a.id} a={a} onUnfavorite={handleUnfavorite} />)}
        </div>
      )}
    </div>
  );
}
