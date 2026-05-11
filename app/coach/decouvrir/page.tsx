"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Découvrir — orphan athlete search for civil coaches.
   Civil-only. Pulls athletes with school_id IS NULL AND
   league_team_id IS NULL AND status='ACTIF', scoped to the coach's
   sport (resolved via league_coaches → leagues.sport_id).
   Read-only for 5.5e-ii — the invite button is a disabled
   placeholder; the real mutation ships in 5.5e-iv after the
   team_invitations migration (5.5e-iii).

   Rich row visual reuses the 5.5d-iii-redux pattern from
   /coach/equipes/[teamId]. Inline-copied per spec; the eventual
   <CoachAthleteRow> extraction is logged P3.
═══════════════════════════════════════════════════════════════ */

interface OrphanAthlete {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  verified: boolean;
  position: string;       // abreviation
  positionId: string | null;
  region: string;
  heightWeight: string;
  gradYear: number | null;
  stars: number;          // 0-5 scale
  recruitmentStatus: GlobalRecruitmentStatus | null;
  committedSchoolName: string | null;
  openToOffers: boolean | null;
}

interface PositionOption {
  id: string;
  abreviation: string;
  nom: string;
}

function formatHeightWeight(pieds: number | null, pouces: number | null, lbs: number | null): string {
  const parts: string[] = [];
  if (pieds != null) {
    const inches = pouces ?? 0;
    parts.push(`${pieds}'${inches}"`);
  }
  if (lbs != null) {
    parts.push(`${lbs} lbs`);
  }
  return parts.join(" · ");
}

export default function DecouvrirPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<"no_league" | null>(null);
  const [sportName, setSportName] = useState<string>("");
  const [orphans, setOrphans] = useState<OrphanAthlete[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);

  // Filter state
  const [filterPosition, setFilterPosition] = useState<string>("");
  const [filterYears, setFilterYears] = useState<Set<number>>(new Set());
  const [filterVerified, setFilterVerified] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // Debounce search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();

      // Auth gate
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth");
        return;
      }

      // Civil-only gate. Read context; redirect any non-civil to dashboard.
      const { data: profile } = await supabase
        .from("users")
        .select("context")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.context !== "ligue_civile") {
        router.replace("/coach/tableau-de-bord");
        return;
      }

      // Resolve coach's sport via league_coaches → leagues.sport_id.
      // Coach may have multiple league_coaches rows (multi-team edge);
      // first row drives the sport for MVP. P3-tracked for switcher.
      const { data: leagueCoach } = await supabase
        .from("league_coaches")
        .select(`
          league_id,
          leagues!league_id(
            sport_id,
            sports!sport_id(id, nom)
          )
        `)
        .eq("coach_id", user.id)
        .limit(1)
        .maybeSingle();

      const leagueRel = leagueCoach && (leagueCoach as Record<string, unknown>).leagues;
      const league = (Array.isArray(leagueRel) ? leagueRel[0] : leagueRel) as
        | { sport_id?: string; sports?: { id?: string; nom?: string } | { id?: string; nom?: string }[] }
        | null;
      const sportRel = league?.sports;
      const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
      const sportId = sport?.id || league?.sport_id || null;

      if (!sportId) {
        // Civil coach without a league_coaches row OR without a sport
        // on their league → can't scope the search.
        setAuthError("no_league");
        setLoading(false);
        return;
      }

      setSportName(sport?.nom || "");

      // Load positions for this sport (drives the position filter dropdown).
      const { data: posRows } = await supabase
        .from("positions")
        .select("id, abreviation, nom")
        .eq("sport_id", sportId)
        .order("abreviation");
      setPositions((posRows ?? []) as PositionOption[]);

      // Load orphans of this sport. ORDER BY rating DESC NULLS LAST,
      // then last_name ASC for stable secondary sort.
      const { data: rows } = await supabase
        .from("athletes")
        .select(`
          id, first_name, last_name, verified,
          position_id, positions!position_id(abreviation, nom),
          annee_diplomation, taille_pieds, taille_pouces, poids_lbs,
          cote_globale_entraineur, statut_recrutement_override,
          open_to_offers, committed_school_id,
          committed_school:schools!committed_school_id(name),
          user_id, users!athletes_user_id_fkey(region)
        `)
        .eq("sport_id", sportId)
        .is("league_team_id", null)
        .is("school_id", null)
        .eq("status", "ACTIF")
        .order("cote_globale_entraineur", { ascending: false, nullsFirst: false })
        .order("last_name", { ascending: true });

      const mapped: OrphanAthlete[] = (rows ?? []).map((row) => {
        const a = row as Record<string, unknown>;
        const posRel = a.positions as { abreviation?: string } | { abreviation?: string }[] | null;
        const pos = Array.isArray(posRel) ? posRel[0] : posRel;
        const userRel = a.users as { region?: string } | { region?: string }[] | null;
        const userRow = Array.isArray(userRel) ? userRel[0] : userRel;
        const committedRel = a.committed_school as { name?: string } | { name?: string }[] | null;
        const committed = Array.isArray(committedRel) ? committedRel[0] : committedRel;
        const cote = a.cote_globale_entraineur as number | null | undefined;
        const fn = (a.first_name as string) || "";
        const ln = (a.last_name as string) || "";
        return {
          id: a.id as string,
          name: `${fn} ${ln}`.trim(),
          firstName: fn,
          lastName: ln,
          verified: a.verified === true,
          position: pos?.abreviation || "",
          positionId: (a.position_id as string | null) ?? null,
          region: userRow?.region || "",
          heightWeight: formatHeightWeight(
            (a.taille_pieds as number | null | undefined) ?? null,
            (a.taille_pouces as number | null | undefined) ?? null,
            (a.poids_lbs as number | null | undefined) ?? null,
          ),
          gradYear: typeof a.annee_diplomation === "number" ? (a.annee_diplomation as number) : null,
          stars: cote != null ? Number(cote) / 2 : 0,
          recruitmentStatus: ((a.statut_recrutement_override as string | null) ?? null) as GlobalRecruitmentStatus | null,
          committedSchoolName: committed?.name || null,
          openToOffers: (a.open_to_offers as boolean | null) ?? null,
        };
      });
      setOrphans(mapped);
      setLoading(false);
    })();
  }, [router]);

  // Distinct grad years from the loaded pool, sorted ASC.
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const a of orphans) if (a.gradYear != null) set.add(a.gradYear);
    return Array.from(set).sort((a, b) => a - b);
  }, [orphans]);

  // Apply all filters client-side.
  const filtered = useMemo(() => {
    return orphans.filter((a) => {
      if (filterPosition && a.positionId !== filterPosition) return false;
      if (filterYears.size > 0 && (a.gradYear == null || !filterYears.has(a.gradYear))) return false;
      if (filterVerified && !a.verified) return false;
      if (filterOpen && a.openToOffers !== true) return false;
      if (searchDebounced.length > 0) {
        const hay = `${a.firstName} ${a.lastName}`.toLowerCase();
        if (!hay.includes(searchDebounced)) return false;
      }
      return true;
    });
  }, [orphans, filterPosition, filterYears, filterVerified, filterOpen, searchDebounced]);

  function toggleYear(year: number) {
    setFilterYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  function resetFilters() {
    setFilterPosition("");
    setFilterYears(new Set());
    setFilterVerified(false);
    setFilterOpen(false);
    setSearchInput("");
  }

  const hasActiveFilters =
    filterPosition !== "" ||
    filterYears.size > 0 ||
    filterVerified ||
    filterOpen ||
    searchDebounced.length > 0;

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#1A1D24] rounded w-72" />
          <div className="h-16 bg-[#1A1D24] rounded-xl" />
          <div className="h-20 bg-[#1A1D24] rounded-lg" />
          <div className="h-20 bg-[#1A1D24] rounded-lg" />
          <div className="h-20 bg-[#1A1D24] rounded-lg" />
        </div>
      </div>
    );
  }

  if (authError === "no_league") {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h2 className="font-head text-lg font-black text-white uppercase mb-1">Complète ton onboarding</h2>
          <p className="text-[13px] text-[#9CA3AF] mb-5 max-w-md">
            Tu dois avoir une équipe civile active pour découvrir des athlètes.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 bg-[#E63946] hover:bg-[#D42B22] text-white px-5 py-2.5 rounded-lg font-head font-bold text-[12px] uppercase tracking-wider transition-colors"
          >
            Aller à l&apos;onboarding
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Découvrir des athlètes</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          {sportName ? `${sportName} · ` : ""}{filtered.length} athlète{filtered.length !== 1 ? "s" : ""} disponible{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Search */}
          <div>
            <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1.5">Recherche</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Prénom ou nom"
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#4a4d56] focus:outline-none focus:border-[#E63946]/50 transition-colors"
            />
          </div>
          {/* Position */}
          <div>
            <label htmlFor="filter-position" className="block text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1.5">Position</label>
            <select
              id="filter-position"
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50 transition-colors"
            >
              <option value="">Toutes positions</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.abreviation} — {p.nom}
                </option>
              ))}
            </select>
          </div>
          {/* Toggles */}
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterVerified}
                onChange={(e) => setFilterVerified(e.target.checked)}
                className="w-4 h-4 accent-[#E63946]"
              />
              <span className="text-[12px] text-[#c0c4cc]">Vérifié</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterOpen}
                onChange={(e) => setFilterOpen(e.target.checked)}
                className="w-4 h-4 accent-[#E63946]"
              />
              <span className="text-[12px] text-[#c0c4cc]">Ouvert aux offres</span>
            </label>
          </div>
        </div>

        {/* Promo chips */}
        {availableYears.length > 0 && (
          <div>
            <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1.5">Année de graduation</label>
            <div className="flex flex-wrap gap-2">
              {availableYears.map((y) => {
                const selected = filterYears.has(y);
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => toggleYear(y)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                      selected
                        ? "bg-[#E63946]/15 border border-[#E63946] text-[#E63946]"
                        : "bg-[#13151a] border border-[#2a2d36] text-[#9CA3AF] hover:border-[#4a4d56]"
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {hasActiveFilters && (
          <div>
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] font-bold text-[#6b7280] hover:text-white transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-12 text-center">
          <p className="text-[14px] text-[#9CA3AF]">
            {orphans.length === 0
              ? "Aucun athlète disponible pour le moment."
              : "Aucun résultat pour ces filtres."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 transition-all duration-200 ease-out flex items-center px-4 py-3 gap-3 group">
              {/* Avatar + verified */}
              <Link href={`/coach/athletes/${a.id}`} className="relative w-10 h-10 shrink-0 block">
                <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center">
                  <span className="text-[11px] font-bold text-[#9CA3AF]">
                    {a.name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2) || "?"}
                  </span>
                </div>
                {a.verified && (
                  <div className="absolute -top-0.5 -right-0.5 z-10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </div>
                )}
              </Link>
              {/* Name */}
              <div className="w-[180px] shrink-0">
                <Link href={`/coach/athletes/${a.id}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate block">
                  {a.name || "—"}
                </Link>
              </div>
              {/* Position */}
              <div className="w-[50px] shrink-0">
                {a.position ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{a.position}</span>
                ) : <span className="text-[#4a4d56]">—</span>}
              </div>
              {/* Status badge */}
              <div className="w-[140px] shrink-0">
                <RecruitmentStatusBadge
                  status={(a.recruitmentStatus || "OUVERT") as GlobalRecruitmentStatus}
                  committedSchoolName={a.committedSchoolName || undefined}
                  openToOffers={a.openToOffers}
                  size="sm"
                />
              </div>
              {/* Region + h/w */}
              <div className="w-[130px] shrink-0">
                {a.region && <span className="text-[12px] text-[#9CA3AF] block truncate">{a.region}</span>}
                {a.heightWeight && <span className="text-[11px] text-[#6b7280]">{a.heightWeight}</span>}
              </div>
              {/* Year */}
              <div className="w-[45px] shrink-0">
                {a.gradYear != null ? (
                  <span className="text-[13px] text-[#9CA3AF]">{a.gradYear}</span>
                ) : <span className="text-[#4a4d56]">—</span>}
              </div>
              {/* Stars */}
              <div className="w-[110px] shrink-0">
                {a.stars > 0 ? (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={a.stars >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                    <span className="text-[11px] font-bold text-[#F59E0B] ml-0.5">{a.stars.toFixed(1)}</span>
                  </div>
                ) : <span />}
              </div>
              {/* Actions: Voir + disabled Inviter */}
              <div className="flex-1 flex items-center justify-end gap-3">
                <Link href={`/coach/athletes/${a.id}`} className="text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1 shrink-0">
                  Voir <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                </Link>
                <button
                  type="button"
                  disabled
                  title="Bientôt disponible (5.5e-iv)"
                  className="text-[12px] font-bold text-[#6b7280] cursor-not-allowed opacity-50 px-3 py-1.5 rounded-lg border border-[#2D3748] shrink-0"
                >
                  Inviter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
