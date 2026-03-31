"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SEARCH_ATHLETES, SPORT_POSITIONS, REGIONS } from "../_data/mockSearchAthletes";
import type { SearchAthlete } from "../_data/mockSearchAthletes";
import { getAthleteTracking } from "../_data/mockPipelineData";
import RecruitmentStatusBadge from "../_components/RecruitmentStatusBadge";
import NxIcon from "@/components/ui/NxIcon";
import FeatureGate from "@/components/subscription/FeatureGate";

/* ═══════════════════════════════════════════════════════════════
   Recherche d'athlètes — Filterable card grid
   Core value page for recruiters.
═══════════════════════════════════════════════════════════════ */

const SPORTS = [
  { value: "", label: "Tous les sports" },
  { value: "football", label: "Football" },
  { value: "volleyball", label: "Volleyball" },
  { value: "basketball", label: "Basketball" },
  { value: "soccer", label: "Soccer" },
  { value: "hockey", label: "Hockey" },
  { value: "cross_country", label: "Cross-country" },
  { value: "natation", label: "Natation" },
  { value: "athletisme", label: "Athlétisme" },
  { value: "badminton", label: "Badminton" },
];

const PROMOTIONS = ["2026", "2027", "2028"];

/* Filter classes — styled via globals.css .nx-filter-* */

/* ── Athlete Search Card ──────────────────────────────────── */

function AthleteSearchCard({ a, onToggleFav }: { a: SearchAthlete; onToggleFav: (id: string) => void }) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 ease-out group flex flex-col">
      {/* Photo area */}
      <div className="relative h-[180px] bg-[#2F3440] overflow-hidden">
        {a.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.photo} alt={`${a.firstName} ${a.lastName}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[48px] font-head font-black text-white/5 tracking-wide">
              {a.firstName[0]}{a.lastName[0]}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }} />

        {/* Favorite */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onToggleFav(a.id); }}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors z-10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={a.isFavorited ? "#E63946" : "none"} stroke={a.isFavorited ? "#E63946" : "#6B7280"} strokeWidth="2" strokeLinecap="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>

        {/* Position chip */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider">
            {a.position}
          </span>
        </div>

        {/* Verified badge */}
        {a.isVerified && (
          <div className="absolute top-3 left-3 z-10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1 gap-1">
        {/* Name */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/recruteur/athletes/${a.id}`} className="text-[17px] font-bold text-white hover:text-[#E63946] transition-colors">
            {a.firstName} {a.lastName}
          </Link>
          {(() => {
            const tracking = getAthleteTracking(a.id);
            return tracking ? <RecruitmentStatusBadge status={tracking.status} size="sm" /> : null;
          })()}
        </div>

        {/* School / Org */}
        <p className="text-[14px] text-[#c0c4cc] flex items-center gap-1.5">
          {a.school}
          {a.orgLevel && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${a.orgLevel === "AAA" ? "bg-[#DAB65A]/15 text-[#DAB65A]" : a.orgLevel === "AA" ? "bg-[#B4BCC8]/15 text-[#B4BCC8]" : "bg-[#6b7280]/15 text-[#6b7280]"}`}>{a.orgLevel}</span>
          )}
        </p>

        {/* Region · Promotion */}
        <p className="text-[13px] text-[#9CA3AF]">
          {a.region} <span className="mx-1 text-[#4a4d56]">·</span> Promotion {a.graduationYear}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-1.5 min-h-[28px]">
          {a.badges.slice(0, 2).map((b) => (
            <span key={b.badgeId} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2D3748] text-[12px] font-semibold text-white">
              <NxIcon name={b.icon} size={13} className="text-[#9CA3AF]" /> {b.label}
            </span>
          ))}
        </div>

        {/* Footer — pinned bottom */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-[#2D3748]/60">
          {a.favorites > 0 ? (
            <div className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#E63946" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              <span className="text-[13px] font-bold text-[#c0c4cc]">{a.favorites}</span>
            </div>
          ) : <div />}

          <Link href={`/recruteur/athletes/${a.id}`} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors flex items-center gap-1">
            Voir le profil
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

/* ── Athlete Search Row (list view) ─────────────────────────── */

function AthleteSearchRow({ a, onToggleFav }: { a: SearchAthlete; onToggleFav: (id: string) => void }) {
  return (
    <div
      className="bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] transition-all duration-300 ease-out items-center px-4 py-3 gap-x-4"
      style={{
        display: "grid",
        gridTemplateColumns: "48px 1fr 72px 110px 56px 200px 52px 32px 64px",
      }}
    >
      {/* Avatar — verified badge on top-right, visible */}
      <div className="relative w-12 h-12 rounded-full bg-[#2F3440] shrink-0" style={{ overflow: "visible" }}>
        <div className="w-full h-full rounded-full overflow-hidden">
          {a.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.photo} alt={`${a.firstName} ${a.lastName}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[14px] font-head font-black text-white/10">{a.firstName[0]}{a.lastName[0]}</span>
            </div>
          )}
        </div>
        {a.isVerified && (
          <div className="absolute -top-1 -right-1 z-10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        )}
      </div>

      {/* Name + school */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/recruteur/athletes/${a.id}`} className="text-[15px] font-bold text-white hover:text-[#E63946] transition-colors truncate">
            {a.firstName} {a.lastName}
          </Link>
          {(() => {
            const tracking = getAthleteTracking(a.id);
            return tracking ? <RecruitmentStatusBadge status={tracking.status} size="sm" /> : null;
          })()}
        </div>
        <p className="text-[13px] text-[#9CA3AF] truncate flex items-center gap-1.5">
          {a.school}
          {a.orgLevel && (
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${a.orgLevel === "AAA" ? "bg-[#DAB65A]/15 text-[#DAB65A]" : a.orgLevel === "AA" ? "bg-[#B4BCC8]/15 text-[#B4BCC8]" : "bg-[#6b7280]/15 text-[#6b7280]"}`}>{a.orgLevel}</span>
          )}
        </p>
      </div>

      {/* Position */}
      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-[#E63946] text-white text-[11px] font-bold uppercase tracking-wider">
        {a.position}
      </span>

      {/* Region */}
      <span className="text-[13px] text-[#9CA3AF] truncate">{a.region}</span>

      {/* Promotion */}
      <span className="text-[13px] text-[#9CA3AF]">{a.graduationYear}</span>

      {/* Badges */}
      <div className="flex gap-1.5">
        {a.badges.slice(0, 2).map((b) => (
          <span key={b.badgeId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2D3748] text-[11px] font-semibold text-white whitespace-nowrap">
            <NxIcon name={b.icon} size={12} className="text-[#9CA3AF]" /> {b.label}
          </span>
        ))}
      </div>

      {/* Favorites count */}
      <div className="flex items-center gap-1 justify-center">
        {a.favorites > 0 ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#E63946" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <span className="text-[12px] font-bold text-[#c0c4cc]">{a.favorites}</span>
          </>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        )}
      </div>

      {/* Fav toggle */}
      <button
        type="button"
        title="Favori"
        onClick={(e) => { e.preventDefault(); onToggleFav(a.id); }}
        className="w-8 h-8 rounded-full bg-[#13151a] border border-[#2D3748] flex items-center justify-center hover:bg-[#2D3748] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={a.isFavorited ? "#E63946" : "none"} stroke={a.isFavorited ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      </button>

      {/* View link */}
      <Link href={`/recruteur/athletes/${a.id}`} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors flex items-center gap-1 justify-end">
        Voir
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function RecherchePage() {
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [region, setRegion] = useState("");
  const [promotion, setPromotion] = useState("");
  const [orgType, setOrgType] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withVideoOnly, setWithVideoOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [athletes, setAthletes] = useState<SearchAthlete[]>([]);
  const [loading, setLoading] = useState(true);

  const positions = sport && SPORT_POSITIONS[sport] ? SPORT_POSITIONS[sport] : [];

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("athletes")
      .select(`
        id,
        first_name,
        last_name,
        photo_url,
        verified,
        profile_completion,
        numero_jersey,
        annee_diplomation,
        video_faits_saillants_url,
        consentement_parental,
        sports!athletes_sport_id_fkey(nom),
        positions!athletes_position_id_fkey(nom, abreviation)
      `)
      .eq("status", "ACTIF")
      .eq("verified", true)
      .then(({ data, error }) => {
        console.log("Athletes loaded:", data?.length, error);
        if (data) {
          const mapped: SearchAthlete[] = data.map((a: Record<string, unknown>) => {
            const sportRel = Array.isArray(a.sports) ? a.sports[0] : a.sports;
            const posRel = Array.isArray(a.positions) ? a.positions[0] : a.positions;
            return {
              id: a.id as string,
              firstName: a.first_name as string,
              lastName: a.last_name as string,
              photo: (a.photo_url as string) || "",
              sport: ((sportRel as Record<string, string> | null)?.nom || "").toLowerCase().replace(/ /g, "_") as SearchAthlete["sport"],
              position: (posRel as Record<string, string> | null)?.abreviation || "",
              school: "",
              region: "",
              graduationYear: (a.annee_diplomation as number) || 0,
              niveau: "Sec. 5" as const,
              heightDisplay: "",
              weightDisplay: "",
              isVerified: a.verified as boolean,
              isFavorited: favorites.has(a.id as string),
              hasVideo: !!a.video_faits_saillants_url,
              badges: [],
              favorites: 0,
              views: 0,
              stars: 0,
              commitmentStatus: "aucun",
              orgType: "scolaire" as const,
            };
          });
          setAthletes(mapped);
        }
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = [...athletes];

    if (search.trim().length >= 3) {
      const q = search.toLowerCase();
      list = list.filter((a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q));
    }
    if (sport) list = list.filter((a) => a.sport === sport);
    if (position) list = list.filter((a) => a.position === position);
    if (region) list = list.filter((a) => a.region === region);
    if (promotion) list = list.filter((a) => a.graduationYear === parseInt(promotion));
    if (verifiedOnly) list = list.filter((a) => a.isVerified);
    if (withVideoOnly) list = list.filter((a) => a.hasVideo);
    if (orgType === "scolaire") list = list.filter((a) => !a.orgType || a.orgType === "scolaire");
    if (orgType === "ligue_civile") list = list.filter((a) => a.orgType === "ligue_civile");

    return list.map((a) => ({ ...a, isFavorited: favorites.has(a.id) }));
  }, [search, sport, position, region, promotion, verifiedOnly, withVideoOnly, orgType, favorites]);

  const toggleFav = async (id: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isFav = favorites.has(id);

    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (isFav) {
      await supabase
        .from("pipeline")
        .delete()
        .eq("recruiter_id", user.id)
        .eq("athlete_id", id);
    } else {
      await supabase
        .from("pipeline")
        .upsert({
          recruiter_id: user.id,
          athlete_id: id,
          status: "IDENTIFIE",
          favorited_at: new Date().toISOString(),
        });
    }
  };

  const hasFilters = sport || position || region || promotion || verifiedOnly || withVideoOnly || orgType;

  const resetFilters = () => {
    setSport(""); setPosition(""); setRegion(""); setPromotion(""); setVerifiedOnly(false); setWithVideoOnly(false); setOrgType("");
  };

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Recherche d&apos;athlètes</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">Explore les profils d&apos;athlètes à travers le Québec</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-[#6b7280]">{filtered.length} athlète{filtered.length !== 1 ? "s" : ""} trouvé{filtered.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center bg-[#13151a] border border-[#2a2d36] rounded-lg overflow-hidden">
            <button
              type="button"
              title="Vue grille"
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              title="Vue liste"
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher par nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select value={sport} onChange={(e) => { setSport(e.target.value); setPosition(""); }} className={`nx-filter-select${sport ? " nx-filter-active" : ""}`}>
          {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select value={position} onChange={(e) => setPosition(e.target.value)} className={`nx-filter-select${position ? " nx-filter-active" : ""}`} disabled={!sport}>
          <option value="">{sport ? "Toutes les positions" : "Sélectionner un sport d\u0027abord"}</option>
          {positions.map((p) => <option key={p.abbr} value={p.abbr}>{p.abbr} — {p.label}</option>)}
        </select>

        <select value={region} onChange={(e) => setRegion(e.target.value)} className={`nx-filter-select${region ? " nx-filter-active" : ""}`}>
          <option value="">Toutes les régions</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <select value={promotion} onChange={(e) => setPromotion(e.target.value)} className={`nx-filter-select${promotion ? " nx-filter-active" : ""}`}>
          <option value="">Toutes les promotions</option>
          {PROMOTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={orgType} onChange={(e) => setOrgType(e.target.value)} className={`nx-filter-select${orgType ? " nx-filter-active" : ""}`}>
          <option value="">Toutes les organisations</option>
          <option value="scolaire">Scolaire</option>
          <option value="ligue_civile">Ligue civile</option>
        </select>

        {/* Divider */}
        <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

        {/* Toggle checkboxes */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="sr-only" />
          <div className={`nx-filter-checkbox${verifiedOnly ? " checked" : ""}`}>
            {verifiedOnly && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            )}
          </div>
          <span className={`text-[13px] font-semibold transition-colors ${verifiedOnly ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Vérifié seulement</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer group">
          <input type="checkbox" checked={withVideoOnly} onChange={(e) => setWithVideoOnly(e.target.checked)} className="sr-only" />
          <div className={`nx-filter-checkbox${withVideoOnly ? " checked" : ""}`}>
            {withVideoOnly && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            )}
          </div>
          <span className={`text-[13px] font-semibold transition-colors ${withVideoOnly ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Avec vidéo</span>
        </label>

        {hasFilters && (
          <button type="button" onClick={resetFilters} className="nx-filter-reset flex items-center gap-1.5 text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors ml-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
            Réinitialiser
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-[#6B7280] text-sm">Chargement des athlètes...</div>
        </div>
      )}

      {/* Results grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucun athlète trouvé</h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed">
            Aucun athlète ne correspond à tes critères. Essaie d&apos;élargir ta recherche.
          </p>
        </div>
      ) : (
        <>
          {/* First 5 results — always visible */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.slice(0, 5).map((a) => (
                <AthleteSearchCard key={a.id} a={a} onToggleFav={toggleFav} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.slice(0, 5).map((a) => (
                <AthleteSearchRow key={a.id} a={a} onToggleFav={toggleFav} />
              ))}
            </div>
          )}

          {/* Remaining results — gated behind Recruteur Pro */}
          {filtered.length > 5 && (
            <FeatureGate feature="unlimited_profiles" requiredTier="pro">
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filtered.slice(5).map((a) => (
                    <AthleteSearchCard key={a.id} a={a} onToggleFav={toggleFav} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.slice(5).map((a) => (
                    <AthleteSearchRow key={a.id} a={a} onToggleFav={toggleFav} />
                  ))}
                </div>
              )}
            </FeatureGate>
          )}
        </>
      )}
    </div>
  );
}
