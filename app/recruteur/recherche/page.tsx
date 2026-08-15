"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SearchAthlete } from "../_data/mockSearchAthletes";
import NxIcon from "@/components/ui/NxIcon";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import AthletePhoto from "@/components/shared/AthletePhoto";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { useAthleteSearch } from "@/lib/queries/recruiter/useAthleteSearch";
import { usePositionsBySport } from "@/lib/queries/recruiter/usePositionsBySport";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { useFavorites } from "@/lib/queries/shared/useFavorites";
import { useFavoriteCounts } from "@/lib/queries/shared/useFavoriteCounts";
import { useRegions } from "@/lib/queries/shared/useRegions";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { HeartButton } from "@/components/mobile/HeartButton";
import { LOCKED_NAME_LABEL } from "@/lib/queries/shared/recruiterAthleteCards";
import { RecruteurRechercheMobile } from "@/components/shared/RecruteurRechercheMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* identityVisible : décision SERVEUR (recruiter_search_athletes). Quand il
   est faux, firstName / lastName / photo / jersey arrivent vides — le client
   n'a rien à recalculer, seulement à rendre le placeholder verrouillé.
   ouvert{Demenager,Prive,Anglophone} retirés : la RPC ne les projette pas
   (ce sont des filtres, pas des colonnes) et rien ne les lisait. */
type ExtendedAthlete = SearchAthlete & { identityVisible: boolean; academicBadges: string[]; stars: number; recruitmentStatus: string | null; heightWeight: string; gpa: number; committedSchoolName: string | null; openToOffers: boolean | null; jersey: string; sportName: string; createdAt: string; lastValidation?: string | null; noTeam: boolean; context: string | null };
import { useSubscription } from "@/lib/hooks/useSubscription";

import { TEAM_GENDER_FILTER_OPTIONS } from "@/lib/config/gender";
/* ═══════════════════════════════════════════════════════════════
   Recherche d'athlètes — Filterable card grid
   Core value page for recruiters.
═══════════════════════════════════════════════════════════════ */

const SPORTS = [
  { value: "", label: "Tous les sports" },
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "soccer", label: "Soccer" },
  { value: "hockey", label: "Hockey" },
  { value: "volleyball", label: "Volleyball" },
  { value: "athlétisme", label: "Athlétisme" },
  { value: "badminton", label: "Badminton" },
  { value: "baseball", label: "Baseball" },
  { value: "cheerleading", label: "Cheerleading" },
  { value: "cross-country", label: "Cross-country" },
  { value: "flag_football", label: "Flag football" },
  { value: "futsal", label: "Futsal" },
  { value: "natation", label: "Natation" },
  { value: "rugby", label: "Rugby" },
  { value: "ultimate_frisbee", label: "Ultimate frisbee" },
  { value: "autre", label: "Autre" },
];

const PROMOTIONS = ["2026", "2027", "2028"];

const sportLabel = (value: string): string => {
  const found = SPORTS.find((s) => s.value === value);
  return found ? found.label : value;
};

/* Filter classes — styled via globals.css .nx-filter-* */

/* ── Athlete Search Card ──────────────────────────────────── */

function AthleteSearchCard({ a, onToggleFav, favDisabled, favDisabledReason }: {
  a: ExtendedAthlete;
  onToggleFav: (id: string) => void;
  favDisabled: boolean;
  favDisabledReason: string;
}) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 ease-out group flex flex-col">
      {/* Photo area */}
      <Link href={`/recruteur/athletes/${a.id}`} className="relative block h-[180px] bg-[#2F3440] overflow-hidden cursor-pointer">
        {/* identityVisible=false → LockedIdentityPlaceholder, PAS un flou.
            Une photo floutée est toujours la photo : elle a transité, elle
            est dans le cache disque et un filtre CSS se retire en une ligne
            de devtools. Ici il n'y a rien à défloumeter — photo_url est NULL
            dans la réponse. */}
        <AthletePhotoFill
          photoUrl={a.photo}
          firstName={a.firstName}
          lastName={a.lastName}
          identityVisible={a.identityVisible}
          initialsFontSize={72}
          className="object-[center_15%]"
        />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }} />

        {/* Top left — verified check + favorite heart */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          {(() => {
            const active = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });
            return (
              <svg width="28" height="28" viewBox="0 0 24 24" fill={active ? "#3B82F6" : "#4a4d56"} stroke="none">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke={active ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            );
          })()}
          {/* HeartButton premium (iter 5.4) */}
          <div
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            title={favDisabled ? favDisabledReason : undefined}
          >
            <HeartButton
              isFavorited={a.isFavorited}
              onToggle={() => onToggleFav(a.id)}
              size="sm"
              disabled={favDisabled}
            />
          </div>
        </div>

        {/* Top right — star rating always visible */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : a.stars >= i + 0.5 ? "#F59E0B" : "#4a4d56"} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
        </div>

      </Link>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        {/* Name + position pill + jersey */}
        <div className="flex items-center gap-2 flex-wrap">
          {!a.identityVisible ? (
            /* Libellé partagé avec les 6 surfaces déjà basculées
               (displayFullName) — même masquage, même mot à l'écran. */
            <span className="inline-flex items-center gap-1.5" title={LOCKED_NAME_LABEL}>
              <span className="text-[17px] font-bold text-[#9CA3AF]">{LOCKED_NAME_LABEL}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </span>
          ) : (
            <Link href={`/recruteur/athletes/${a.id}`} className="text-[17px] font-bold text-white hover:text-[#E63946] transition-colors">
              {a.firstName} {a.lastName}
            </Link>
          )}
          {a.position && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[12px] font-bold uppercase tracking-wider">
              {a.position}
            </span>
          )}
          {a.jersey && <span className="text-[13px] font-black text-[#E63946]">#{a.jersey}</span>}
        </div>

        {/* Height/Weight */}
        {a.heightWeight && (
          <p className="text-[13px] text-[#9CA3AF] mt-0.5">{a.heightWeight}</p>
        )}

        {/* Recruitment Status */}
        <div className="mt-1.5">
          <RecruitmentStatusBadge
            status={a.recruitmentStatus as GlobalRecruitmentStatus}
            committedSchoolName={a.committedSchoolName ?? undefined}
            openToOffers={a.openToOffers}
            size="sm"
          />
        </div>

        {/* Badges */}
        {a.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {a.badges.map((b) => (
              <span key={b.badgeId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[10px] font-bold text-[#E63946]">
                <NxIcon name={b.icon} size={10} className="text-[#E63946]" /> {b.label}
              </span>
            ))}
          </div>
        )}

        {/* Footer — school · year left, voir le profil right */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-[#2D3748]/60">
          <span className="text-[12px] text-[#6b7280] truncate flex items-center gap-2 min-w-0">
            {a.noTeam ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] shrink-0">
                Ligue Civile
              </span>
            ) : (
              <span className="truncate">{a.school}</span>
            )}
            <span className="text-[#4a4d56] shrink-0">·</span>
            <span className="shrink-0">{a.graduationYear}</span>
          </span>
          <Link href={`/recruteur/athletes/${a.id}`} className="text-[13px] font-semibold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1 shrink-0">
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

function AthleteSearchRow({ a, onToggleFav, favDisabled, favDisabledReason }: {
  a: ExtendedAthlete;
  onToggleFav: (id: string) => void;
  favDisabled: boolean;
  favDisabledReason: string;
}) {
  return (
    <div className="bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] transition-all duration-300 ease-out flex items-center px-4 py-3 gap-4">

      {/* Avatar + verified badge */}
      <Link href={`/recruteur/athletes/${a.id}`} className="relative w-12 h-12 shrink-0 block" style={{ overflow: "visible" }}>
        <AthletePhoto
          photoUrl={a.photo}
          firstName={a.firstName}
          lastName={a.lastName}
          identityVisible={a.identityVisible}
          size={48}
        />
        <div className="absolute -top-1 -right-1 z-10">
          {(() => {
            const active = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });
            return (
              <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#3B82F6" : "#4a4d56"} stroke="none">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke={active ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            );
          })()}
        </div>
      </Link>

      {/* Name + school + stars */}
      <div className="min-w-[180px] max-w-[220px]">
        {!a.identityVisible ? (
          <span className="inline-flex items-center gap-1.5" title={LOCKED_NAME_LABEL}>
            <span className="text-[15px] font-bold text-[#9CA3AF]">{LOCKED_NAME_LABEL}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </span>
        ) : (
          <Link href={`/recruteur/athletes/${a.id}`} className="text-[15px] font-bold text-white hover:text-[#E63946] transition-colors truncate block">
            {a.firstName} {a.lastName}
          </Link>
        )}
        {a.noTeam ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
            Ligue Civile
          </span>
        ) : (
          <p className="text-[13px] text-[#9CA3AF] truncate">{a.school}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
            <span className="text-[11px] font-bold text-[#F59E0B] ml-0.5">{a.stars.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Sport + Position pills */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E63946] text-white text-[11px] font-bold uppercase tracking-wider">
          {sportLabel(a.sport)}
        </span>
        {a.position && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">
            {a.position}
          </span>
        )}
      </div>

      {/* Region */}
      <span className="text-[13px] text-[#9CA3AF] min-w-[140px] shrink-0">
        {a.region}
        {a.heightWeight && <span className="block text-[11px] text-[#6b7280] mt-0.5">{a.heightWeight}</span>}
      </span>

      {/* Promotion */}
      <span className="text-[13px] text-[#9CA3AF] shrink-0 w-[50px]">{a.graduationYear}</span>

      {/* Badges */}
      <div className="flex gap-1.5 flex-1 min-w-0">
        {a.badges.map((b) => (
          <span key={b.badgeId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[10px] font-bold text-[#E63946] whitespace-nowrap">
            <NxIcon name={b.icon} size={10} className="text-[#E63946]" /> {b.label}
          </span>
        ))}
      </div>

      {/* Fav toggle */}
      {/* HeartButton premium (iter 5.4) */}
      <div
        className="shrink-0 bg-[#13151a] border border-[#2D3748] rounded-full flex items-center justify-center"
        style={{ width: 32, height: 32 }}
        title={favDisabled ? favDisabledReason : undefined}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <HeartButton
          isFavorited={a.isFavorited}
          onToggle={() => onToggleFav(a.id)}
          size="sm"
          disabled={favDisabled}
        />
      </div>

      {/* View link */}
      <Link href={`/recruteur/athletes/${a.id}`} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors flex items-center gap-1 shrink-0">
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
  return <Suspense><RechercheContent /></Suspense>;
}

function RechercheContent() {
  if (IS_CAPACITOR) return <RecruteurRechercheMobile />;

  const searchParams = useSearchParams();
  /* maxSearchResults n'est plus lu ici : le plafond de résultats est mort
     avec la bascule RPC (p_limit NULL = illimité, tous tiers confondus).
     `tier` sert encore à deux choses, aucune n'étant un test d'identité :
     la portée du cache de useAthleteSearch, et le gel du champ de recherche
     par nom (fonction Pro, pas règle de confidentialité — le serveur
     neutralise p_search de son côté quoi qu'il arrive). */
  const { maxFavorites, tier, loading: tierLoading } = useSubscription();
  const isFreeRecruiter = tier === "free";
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [position, setPosition] = useState("");
  const [region, setRegion] = useState("");
  const [promotion, setPromotion] = useState("");
  const [orgType, setOrgType] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withVideoOnly, setWithVideoOnly] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [withSportBadge, setWithSportBadge] = useState(false);
  const [withAcademicBadge, setWithAcademicBadge] = useState(false);
  const [hideFavorites, setHideFavorites] = useState(false);
  const [filterOuvertDemenager, setFilterOuvertDemenager] = useState(false);
  const [filterOuvertPrive, setFilterOuvertPrive] = useState(false);
  const [filterOuvertAnglophone, setFilterOuvertAnglophone] = useState(false);
  const [filterNewOnly, setFilterNewOnly] = useState(searchParams.get("nouveau") === "true");
  const [minGpa, setMinGpa] = useState("");
  const [sortBy, setSortBy] = useState("rating_desc");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  // Migration TanStack (iter 5.3b) — états fetch-related délégués aux hooks.
  // Cache TanStack → navigation tab→Recherche instantanée avec mêmes filtres.
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data: favoritesArr = [] } = useFavorites();
  const { data: favCounts = {} } = useFavoriteCounts();
  const { data: regions = [] } = useRegions();
  // favorites en Set pour préserver l'API utilisée par les useMemo/cartes
  const favorites = useMemo(() => new Set(favoritesArr), [favoritesArr]);
  // Debounce du search text uniquement (iter 5.3b). Autres filtres = instantané.
  const debouncedSearch = useDebouncedValue(search, 250);
  // Positions dynamiques selon le sport sélectionné
  const { data: posData } = usePositionsBySport(sport || null);
  const sportId = posData?.sportId ?? null;
  const dynamicPositions = posData?.positions ?? [];

  // Ex useEffect "init one-shot" (favorites + favCounts + regions) retiré en iter 5.3b
  // — la donnée vit dans useFavorites / useFavoriteCounts / useRegions.

  // Migration TanStack (iter 5.3b) — la main athlete query vit dans
  // useAthleteSearch avec keepPreviousData : pendant un refetch sur changement
  // de filtre, l'ancienne grille reste affichée (UX Instagram-like).
  // orgType + favorites composition appliqués dans le useMemo `filtered`
  // ci-dessous pour stabilité du cache (un changement de favori ne refetch pas).
  const { data: athletes = [], isLoading: athletesLoading, isFetching: athletesFetching } = useAthleteSearch({
    search: debouncedSearch,
    sport,
    promotion,
    verifiedOnly,
    withVideoOnly,
    minRating,
    filterOuvertDemenager,
    filterOuvertPrive,
    filterOuvertAnglophone,
    filterNewOnly,
    minGpa,
    sortBy,
    sportId,
    tier,
  });
  const loading = tierLoading || athletesLoading;

  // Reset position quand le sport change (legacy behavior)
  useEffect(() => { if (!sport) setPosition(""); }, [sport]);

  // Ex mega-useEffect (main athlete query, 200+ lignes) retiré en iter 5.3b.
  // Ex useEffect load positions (lignes 586-613) retiré, remplacé par usePositionsBySport.
  // Bloc legacy supprimé ↓

  // Client-side residual filters. Server-side filters (search, sport, promotion,
  // verified, video, GPA, minRating, ouvert_*, filterNewOnly) have déjà été
  // appliqués par la RPC ; on ne garde ici que ceux qu'elle n'exprime pas.
  //
  // L'ancienne « LIMITATION for Free users » est levée : la RPC ne plafonne
  // plus (p_limit NULL), donc ces filtres résiduels travaillent sur TOUS les
  // athlètes actifs et non sur une fenêtre de 10 lignes. Un Free qui filtre
  // par région obtient désormais la vraie réponse, pas le sous-ensemble des
  // 10 premiers.
  const filtered = useMemo(() => {
    let list = [...athletes];
    // orgType client-side (déplacé du legacy useEffect en iter 5.3b pour stabiliser
    // le cache : un changement d'orgType ne refetch pas, juste filtre)
    if (orgType) {
      list = list.filter((a) =>
        a.orgType === orgType ||
        (a.noTeam && (a.context === "ligue_civile" ? "ligue_civile" : "scolaire") === orgType)
      );
    }
    if (position) list = list.filter((a) => a.position === position);
    if (region) list = list.filter((a) => a.region === region);
    // Genre d'ÉQUIPE (teams.gender), pas athletes.genre. Un athlète sans équipe
    // a teamGender null → il sort des résultats dès qu'un genre est choisi.
    if (genderFilter) list = list.filter((a) => a.teamGender === genderFilter);
    if (withSportBadge) list = list.filter((a) => a.badges.length > 0);
    if (withAcademicBadge) list = list.filter((a) => a.academicBadges && a.academicBadges.length > 0);
    if (hideFavorites) list = list.filter((a) => !favorites.has(a.id));

    // favorites_desc sort is a client-side refinement of the returned page
    // (the DB query already applied rating_desc as a fallback ordering).
    if (sortBy === "favorites_desc") {
      list = [...list].sort((a, b) => (favCounts[b.id] || 0) - (favCounts[a.id] || 0));
    }

    return list.map((a) => ({ ...a, isFavorited: favorites.has(a.id), favorites: favCounts[a.id] || 0 }));
  }, [athletes, orgType, position, region, genderFilter, withSportBadge, withAcademicBadge, hideFavorites, sortBy, favorites, favCounts]);

  const toggleFav = async (id: string) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const userId = session.user.id;

    // Check if already favorited
    const { data: existing } = await supabase
      .from("recruiter_favorites")
      .select("id")
      .eq("recruiter_id", userId)
      .eq("athlete_id", id)
      .maybeSingle();

    if (existing) {
      // Already favorited → DELETE (unfavorite)
      await supabase.from("recruiter_favorites").delete().eq("id", existing.id);
    } else {
      // Not favorited → INSERT (favorite only; pipeline entries are created
      // by explicit user action on the Kanban page, not as a side-effect here)
      await supabase.from("recruiter_favorites").insert({ recruiter_id: userId, athlete_id: id });
    }
    // Invalidations TanStack — favorites/counts/dashboard se rafraîchissent (iter 5.3b)
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
    queryClient.invalidateQueries({ queryKey: ["favoriteCounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
  };

  const hasFilters = sport || position || region || promotion || verifiedOnly || withVideoOnly || orgType || minRating || withSportBadge || withAcademicBadge || minGpa || hideFavorites || filterOuvertDemenager || filterOuvertPrive || filterOuvertAnglophone || filterNewOnly || sortBy !== "rating_desc";

  const resetFilters = () => {
    setSport(""); setGenderFilter(""); setPosition(""); setRegion(""); setPromotion(""); setVerifiedOnly(false); setWithVideoOnly(false); setOrgType(""); setMinRating(""); setWithSportBadge(false); setWithAcademicBadge(false); setMinGpa(""); setHideFavorites(false); setFilterOuvertDemenager(false); setFilterOuvertPrive(false); setFilterOuvertAnglophone(false); setFilterNewOnly(false); setSortBy("rating_desc");
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

      {/* Search bar + primary filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder={isFreeRecruiter ? "Recherche par nom (Pro)" : "Rechercher par nom..."}
            value={isFreeRecruiter ? "" : search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isFreeRecruiter}
            title={isFreeRecruiter ? "La recherche par nom est réservée aux recruteurs Pro" : undefined}
            className={`w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors${isFreeRecruiter ? " opacity-60 cursor-not-allowed" : ""}`}
          />
        </div>

        {/* Primary filters — always visible */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select value={sport} onChange={(e) => { setSport(e.target.value); setPosition(""); }} className={`nx-filter-select${sport ? " nx-filter-active" : ""}`}>
            {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Genre d'ÉQUIPE (teams.gender) — placé entre Sport et Position.
              Un athlète sans équipe est exclu dès qu'un genre est choisi. */}
          <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className={`nx-filter-select${genderFilter ? " nx-filter-active" : ""}`} aria-label="Genre d&apos;équipe">
            {TEAM_GENDER_FILTER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>

          <select value={position} onChange={(e) => setPosition(e.target.value)} className={`nx-filter-select${position ? " nx-filter-active" : ""}`} disabled={!sport}>
            <option value="">{sport ? "Toutes les positions" : "Sélectionner un sport d\u0027abord"}</option>
            {dynamicPositions.map((p) => <option key={p.abbr} value={p.abbr}>{p.abbr} — {p.label}</option>)}
          </select>

          <select value={promotion} onChange={(e) => setPromotion(e.target.value)} className={`nx-filter-select${promotion ? " nx-filter-active" : ""}`}>
            <option value="">Toutes les promotions</option>
            {PROMOTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

          {/* Sort */}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="nx-filter-select">
            <option value="rating_desc">Trier: Meilleure cote</option>
            <option value="rating_asc">Trier: Cote croissante</option>
            <option value="favorites_desc">Trier: Plus favorisés</option>
            <option value="grad_asc">Trier: Graduation proche</option>
            <option value="grad_desc">Trier: Graduation éloignée</option>
            <option value="name_asc">Trier: Nom A-Z</option>
          </select>

          <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
              showAdvanced ? "bg-[#E63946]/10 text-[#E63946] border border-[#E63946]/30" : "text-[#9CA3AF] hover:text-white border border-[#2D3748]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Filtres avancés
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {hasFilters && (
            <button type="button" onClick={resetFilters} className="nx-filter-reset flex items-center gap-1.5 text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors ml-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
              Réinitialiser
            </button>
          )}
        </div>

        {/* Quick preset chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMinRating(minRating === "4" ? "" : "4")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${minRating === "4" ? "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={minRating === "4" ? "#F59E0B" : "#6b7280"} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            4+ étoiles
          </button>
          <button type="button" onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${verifiedOnly ? "bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={verifiedOnly ? "#3B82F6" : "none"} stroke={verifiedOnly ? "#3B82F6" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            Vérifié
          </button>
          <button type="button" onClick={() => setWithVideoOnly(!withVideoOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${withVideoOnly ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={withVideoOnly ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
            Avec vidéo
          </button>
          <button type="button" onClick={() => setWithSportBadge(!withSportBadge)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${withSportBadge ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={withSportBadge ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" /></svg>
            Avec distinction
          </button>
          <button type="button" onClick={() => setHideFavorites(!hideFavorites)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${hideFavorites ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={hideFavorites ? "#E63946" : "none"} stroke={hideFavorites ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
            Masquer favoris
          </button>
        </div>

        {/* Advanced filters — collapsible */}
        {showAdvanced && (
          <div className="flex flex-wrap items-center gap-2.5 bg-[#13151a] border border-[#2a2d36] rounded-lg p-3">
            <select value={region} onChange={(e) => setRegion(e.target.value)} className={`nx-filter-select${region ? " nx-filter-active" : ""}`}>
              <option value="">Toutes les régions</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <select value={orgType} onChange={(e) => setOrgType(e.target.value)} className={`nx-filter-select${orgType ? " nx-filter-active" : ""}`}>
              <option value="">Toutes les organisations</option>
              <option value="scolaire">Scolaire</option>
              <option value="ligue_civile">Ligue civile</option>
            </select>

            <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className={`nx-filter-select${minRating ? " nx-filter-active" : ""}`}>
              <option value="">Toutes les cotes</option>
              <option value="1">★ 1+</option>
              <option value="2">★★ 2+</option>
              <option value="3">★★★ 3+</option>
              <option value="4">★★★★ 4+</option>
              <option value="5">★★★★★ 5</option>
            </select>

            <select value={minGpa} onChange={(e) => setMinGpa(e.target.value)} className={`nx-filter-select${minGpa ? " nx-filter-active" : ""}`}>
              <option value="">Toutes les moyennes</option>
              <option value="60">60%+</option>
              <option value="70">70%+</option>
              <option value="80">80%+</option>
              <option value="85">85%+</option>
              <option value="90">90%+</option>
            </select>

            <div className="w-px h-6 bg-[#2D3748] mx-1" />

            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={withAcademicBadge} onChange={(e) => setWithAcademicBadge(e.target.checked)} className="sr-only" />
              <div className={`nx-filter-checkbox${withAcademicBadge ? " checked" : ""}`}>
                {withAcademicBadge && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                )}
              </div>
              <span className={`text-[13px] font-semibold transition-colors ${withAcademicBadge ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Mention académique</span>
            </label>

            <div className="w-px h-6 bg-[#2D3748] mx-1" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Préférences</span>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={filterOuvertDemenager} onChange={(e) => setFilterOuvertDemenager(e.target.checked)} className="sr-only" />
              <div className={`nx-filter-checkbox${filterOuvertDemenager ? " checked" : ""}`}>
                {filterOuvertDemenager && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <span className={`text-[13px] font-semibold transition-colors ${filterOuvertDemenager ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Ouvert à déménager</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={filterOuvertPrive} onChange={(e) => setFilterOuvertPrive(e.target.checked)} className="sr-only" />
              <div className={`nx-filter-checkbox${filterOuvertPrive ? " checked" : ""}`}>
                {filterOuvertPrive && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <span className={`text-[13px] font-semibold transition-colors ${filterOuvertPrive ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Ouvert au privé</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={filterOuvertAnglophone} onChange={(e) => setFilterOuvertAnglophone(e.target.checked)} className="sr-only" />
              <div className={`nx-filter-checkbox${filterOuvertAnglophone ? " checked" : ""}`}>
                {filterOuvertAnglophone && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <span className={`text-[13px] font-semibold transition-colors ${filterOuvertAnglophone ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Ouvert anglophone</span>
            </label>

            <div className="w-px h-6 bg-[#2D3748] mx-1" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Nouveautés</span>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={filterNewOnly} onChange={(e) => setFilterNewOnly(e.target.checked)} className="sr-only" />
              <div className={`nx-filter-checkbox${filterNewOnly ? " checked" : ""}`}>
                {filterNewOnly && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <span className={`text-[13px] font-semibold transition-colors ${filterNewOnly ? "text-white" : "text-[#9CA3AF] group-hover:text-[#c0c0c0]"}`}>Nouveaux profils (10 derniers jours)</span>
            </label>
          </div>
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
          {(() => {
            // favorites.size is the recruiter's current favorite count — the
            // DB still enforces the cap via RLS; this just blocks the click
            // UX before it fires and surfaces a clearer message.
            const atFavCap = maxFavorites !== -1 && favorites.size >= maxFavorites;
            const favDisabledReason = `Limite de ${maxFavorites} favoris atteinte. Passez à Pro pour plus.`;
            return viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((a) => (
                  <AthleteSearchCard
                    key={a.id}
                    a={a}
                    onToggleFav={toggleFav}
                    favDisabled={atFavCap && !a.isFavorited}
                    favDisabledReason={favDisabledReason}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((a) => (
                  <AthleteSearchRow
                    key={a.id}
                    a={a}
                    onToggleFav={toggleFav}
                    favDisabled={atFavCap && !a.isFavorited}
                    favDisabledReason={favDisabledReason}
                  />
                ))}
              </div>
            );
          })()}

          {/* UpgradeMoreBanner retiré (Lot A). Elle annonçait « N athlètes
              affichés — d'autres correspondent » là où la requête tronquait
              volontairement à N. La RPC ne tronque plus : la bannière serait
              devenue un mensonge, et le composant avec elle. */}
        </>
      )}
    </div>
  );
}
