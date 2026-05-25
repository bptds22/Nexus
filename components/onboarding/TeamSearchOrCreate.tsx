"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { genderLabel } from "@/lib/config/gender";

/* ═══════════════════════════════════════════════════════════════
   TeamSearchOrCreate — civil-coach team search.

   UX model (post-redesign): the coach types ONLY the team name.
   Division / league / age / gender are scraper values that decorate
   each card to help the coach recognize their team — never typed or
   selected. Multi-word input (e.g. "Wildcats Bantam AA") triggers
   token matching: each token must appear somewhere across the
   team's name/age_group/division/league/gender fields. Single-token
   input behaves as a name contains-match. Empty input lists all
   civil-league teams for the chosen sport.

   Sport: defaults to the prop sportId (resolved upstream from
   localStorage.sport_principal — the coach's declared sport) but a
   local <select> at the top lets the coach re-scope the search to a
   different sport without altering their declared sport (the
   selector is search-scope-only; finish() still saves the
   step-0 sport_principal unchanged).

   Results render as paginated cards (5/page mobile, 8/page desktop)
   with swipe-left/right + prev/next + page indicator. No silent
   result cap — pagination scrolls through everything.

   Sport scope filter: .eq('sport_id', searchSportId).
   Civil filter: client-side schools.type === 'LIGUE_CIVILE'
     (PostgREST embed can't filter parent on child column without
     a more invasive refactor; small candidate set keeps this fine).
═══════════════════════════════════════════════════════════════ */

export interface TeamSearchRow {
  id: string;
  name: string;
  age_group: string | null;
  gender: string | null;
  division: string | null;
  league: string | null;
  school_id: string;
  school_name: string;
  coach_count: number;
}

export interface TeamSearchOrCreateProps {
  sportId: string;
  selectedTeam: TeamSearchRow | null;
  onSelect: (team: TeamSearchRow) => void;
  onCreate: () => void;
  className?: string;
}

interface SportOption { id: string; nom: string }

interface RawRow {
  id: string;
  name: string;
  age_group: string | null;
  gender: string | null;
  division: string | null;
  league: string | null;
  school_id: string;
  schools: { id: string; name: string; type: string | null } | { id: string; name: string; type: string | null }[] | null;
  team_coaches: { coach_id: string }[] | null;
}

const inputCls =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";
const labelCls =
  "block text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-1.5";

// Lowercase + NFD-strip diacritics so "Nemesis" matches "Némésis"
// and "chateauguay" matches "Châteauguay" in token filters. The
// regex range U+0300-U+036F is the Unicode "combining diacritical
// marks" block — NFD decomposes "é" → "e" + U+0301, then strip.
function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
}

const SWIPE_THRESHOLD_PX = 50;

export default function TeamSearchOrCreate({
  sportId,
  selectedTeam,
  onSelect,
  onCreate,
  className = "",
}: TeamSearchOrCreateProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TeamSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local search-scope sport. Seeded from the prop (the coach's
  // declared sport from step 0). Never written back — finish() reads
  // sport_principal from localStorage, which this selector doesn't
  // touch.
  const [searchSportId, setSearchSportId] = useState<string>(sportId);
  const [sportOptions, setSportOptions] = useState<SportOption[]>([]);

  // Pagination + responsive page size.
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  // Fetch sport list once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("sports").select("id, nom").order("nom");
      if (cancelled) return;
      setSportOptions((data ?? []) as SportOption[]);
    })();
    return () => { cancelled = true; };
  }, []);

  // Responsive page size: 5 on narrow viewports, 8 on md+.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setPageSize(mq.matches ? 8 : 5);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Reset to page 0 whenever the result set changes shape.
  useEffect(() => {
    setCurrentPage(0);
  }, [search, searchSportId]);

  // Fetch + token-filter results whenever search or sport changes.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchSportId) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const trimmed = search.trim();
      const tokens = trimmed.length > 0
        ? trimmed.split(/\s+/).filter(Boolean)
        : [];

      // Candidate fetch. The FIRST token is the user's most-likely
      // name token (people type the team name first, then modifiers).
      // Server-side .ilike narrows the candidate set; full token
      // matching happens client-side across all fields.
      let query = supabase
        .from("teams")
        .select(
          "id, name, age_group, gender, division, league, school_id, schools!school_id(id, name, type), team_coaches(coach_id)"
        )
        .eq("sport_id", searchSportId)
        .order("name")
        .limit(500);

      if (tokens.length > 0) {
        query = query.ilike("name", `%${tokens[0]}%`);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error("[TeamSearchOrCreate] search failed:", queryError);
        setError("Erreur de recherche — réessaie dans un instant");
        setResults([]);
        setLoading(false);
        setHasSearched(true);
        return;
      }

      // Civil-only filter (schools.type embed).
      const civilOnly = (data ?? []).filter((row) => {
        const r = row as unknown as RawRow;
        const school = Array.isArray(r.schools) ? r.schools[0] : r.schools;
        return school?.type === "LIGUE_CIVILE";
      });

      // Token narrowing: build per-team haystack from name + helper
      // fields, require every token to be a substring (normalized).
      // Empty input → tokens is [] → no filter applied (show all).
      const normTokens = tokens.map(normalize);
      const matched = civilOnly.filter((row) => {
        if (normTokens.length === 0) return true;
        const r = row as unknown as RawRow;
        const haystack = [r.name, r.age_group, r.division, r.league, r.gender]
          .map(normalize)
          .join(" ");
        return normTokens.every((t) => haystack.includes(t));
      });

      const mapped: TeamSearchRow[] = matched.map((row) => {
        const r = row as unknown as RawRow;
        const school = Array.isArray(r.schools) ? r.schools[0] : r.schools;
        return {
          id: r.id,
          name: r.name,
          age_group: r.age_group,
          gender: r.gender,
          division: r.division,
          league: r.league,
          school_id: r.school_id,
          school_name: school?.name ?? "",
          coach_count: r.team_coaches?.length ?? 0,
        };
      });

      setResults(mapped);
      setError(null);
      setLoading(false);
      setHasSearched(true);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, searchSportId]);

  // Pagination derived state. Clamp currentPage if results shrink.
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const pageIndex = Math.min(currentPage, totalPages - 1);
  const pagedResults = useMemo(() => {
    const start = pageIndex * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, pageIndex, pageSize]);

  function goPage(next: number) {
    setCurrentPage(Math.max(0, Math.min(totalPages - 1, next)));
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX == null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const dx = endX - startX;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    // Swipe left (dx < 0) → next page; swipe right → prev page.
    if (dx < 0) goPage(pageIndex + 1);
    else goPage(pageIndex - 1);
  }

  // Selected-team confirmation UI (post-pick). Preserved from the
  // prior component shape so the wizard's existing select handler
  // chains in unchanged — just enriched with the new pills.
  if (selectedTeam) {
    const genderText = selectedTeam.gender ? genderLabel(selectedTeam.gender) : null;
    return (
      <div className={`bg-[#111317] border border-[#22C55E]/30 rounded-lg p-5 space-y-3 ${className}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-head font-black text-lg text-white">{selectedTeam.name}</h3>
              {selectedTeam.division && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/70 uppercase border border-white/10">
                  {selectedTeam.division}
                </span>
              )}
              {selectedTeam.age_group && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/70 uppercase border border-white/10">
                  {selectedTeam.age_group}
                </span>
              )}
              {genderText && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/70 uppercase border border-white/10">
                  {genderText}
                </span>
              )}
            </div>
            {selectedTeam.league && (
              <p className="text-[11px] text-[#9CA3AF] mt-2">{selectedTeam.league}</p>
            )}
            <p className="text-xs text-[#6B7280] mt-1">{selectedTeam.school_name}</p>
            <p className="text-[11px] text-[#22C55E] font-bold mt-2 flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              C&apos;est mon équipe
            </p>
          </div>
        </div>
      </div>
    );
  }

  const trimmed = search.trim();
  const showNoResults = hasSearched && !loading && results.length === 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Sport selector — search-scope only, never written back. */}
      <div>
        <label htmlFor="team-search-sport" className={labelCls}>Sport</label>
        <select
          id="team-search-sport"
          value={searchSportId}
          onChange={(e) => setSearchSportId(e.target.value)}
          className={`${inputCls} appearance-none cursor-pointer`}
          aria-label="Sport pour la recherche d'équipe"
        >
          {sportOptions.length === 0 && (
            <option value={searchSportId}>Chargement...</option>
          )}
          {sportOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>
        <p className="text-[11px] text-[#6B7280] mt-1.5">
          Change le sport pour chercher une équipe d&apos;un autre sport — ça ne modifie pas ton sport déclaré.
        </p>
      </div>

      {/* Name search input. */}
      <div>
        <label htmlFor="team-search-input" className={labelCls}>Nom de l&apos;équipe</label>
        <input
          id="team-search-input"
          type="text"
          placeholder="Cherche ton équipe par nom (ex: Wildcats, Cobras AAA)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputCls}
          aria-label="Rechercher une équipe civile par nom"
        />
        <p className="text-[11px] text-[#6B7280] mt-1.5">
          Tape le nom de ton équipe — tu peux ajouter d&apos;autres mots (catégorie, division) pour préciser.
        </p>
      </div>

      {error && <p className="text-[12px] text-[#EF4444]">{error}</p>}

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[#111317] border border-white/5 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-2/3 mb-2" />
              <div className="h-3 bg-white/5 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          {/* Swipeable card grid. Touch handlers on the wrapper let
              users swipe between pages on mobile; the buttons +
              indicator below cover desktop / non-touch. */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-2 touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {pagedResults.map((team) => {
              const genderText = team.gender ? genderLabel(team.gender) : null;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => onSelect(team)}
                  className="text-left bg-[#111317] border border-white/10 hover:border-[#E63946]/40 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{team.name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {team.division && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/70 uppercase border border-white/10">
                            {team.division}
                          </span>
                        )}
                        {team.age_group && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/70 uppercase border border-white/10">
                            {team.age_group}
                          </span>
                        )}
                        {genderText && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/70 uppercase border border-white/10">
                            {genderText}
                          </span>
                        )}
                      </div>
                      {team.league && (
                        <p className="text-[11px] text-[#9CA3AF] mt-2 truncate">{team.league}</p>
                      )}
                      <p className="text-[11px] text-[#6B7280] mt-1 truncate">{team.school_name}</p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${
                        team.coach_count === 0 ? "text-[#6B7280]" : "text-[#9CA3AF]"
                      }`}
                    >
                      {team.coach_count === 0
                        ? "Aucun coach"
                        : `${team.coach_count} coach${team.coach_count === 1 ? "" : "s"}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination controls — visible even when only one page so
              the user always knows the result count. */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => goPage(pageIndex - 1)}
                disabled={pageIndex === 0}
                className="h-9 px-3 rounded-lg border border-white/10 text-[12px] font-bold text-[#9CA3AF] hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Page précédente"
              >
                ← Précédent
              </button>
              <div className="flex items-center gap-1.5" aria-label={`Page ${pageIndex + 1} sur ${totalPages}`}>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i === pageIndex ? "bg-[#E63946]" : "bg-white/15"}`}
                  />
                ))}
                <span className="ml-2 text-[11px] text-[#6B7280] tabular-nums">
                  {pageIndex + 1} / {totalPages}
                </span>
              </div>
              <button
                type="button"
                onClick={() => goPage(pageIndex + 1)}
                disabled={pageIndex >= totalPages - 1}
                className="h-9 px-3 rounded-lg border border-white/10 text-[12px] font-bold text-[#9CA3AF] hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Page suivante"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}

      {showNoResults && (
        <div className="bg-[#111317] border border-white/5 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-[#9CA3AF]">
            {trimmed.length > 0 ? (
              <>Aucune équipe trouvée pour <span className="font-bold text-white">&ldquo;{trimmed}&rdquo;</span>. Vérifie le nom ou crée ton équipe.</>
            ) : (
              <>Aucune équipe civile pour ce sport. Crée la tienne.</>
            )}
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Créer ma nouvelle équipe
          </button>
        </div>
      )}
    </div>
  );
}
