"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   TeamSearchOrCreate — search existing civil teams by name within
   the coach's chosen sport. Standalone component for 5.4g-i; not
   yet wired into the onboarding wizard (that's 5.4g-iv).

   Mental model: a civil coach is looking for *their team*, not their
   league. The league is an attribute of the team, not a top-level
   selector. The component flips the order of the old wizard step:
   show team results first, with the league name as a secondary
   subtitle on each row.

   Search behavior:
   - 250ms debounce
   - min 2 chars before query fires
   - LIMIT 20 server-side
   - filtered to civil-level leagues only (league.level = 'Civil')
   - filtered to the coach's chosen sport (sport_id from step 0)

   Result rows render: team name, age_group + gender pills, league
   name (atténué), coach count signal. Teams with 0 coaches are
   intentionally surfaced — the orphan signal helps the user decide
   whether to join (likely the original creator left) or start fresh.

   Empty states:
   - Initial (no search): just the prominent "+ Créer ma nouvelle
     équipe" button — no result list visible
   - After search with 0 hits: "Aucune équipe trouvée pour [search]"
     + the same Créer button

   Performance: relies on seq scan + LIMIT 20 today. P3 logged for
   pg_trgm + GIN on league_teams.name when team count grows.

   Race condition: not relevant for 5.4g-i (search-only). Find-or-
   create comes in 5.4g-iii with a UNIQUE(LOWER(name), sport_id,
   level) constraint on leagues.
═══════════════════════════════════════════════════════════════ */

export interface TeamSearchRow {
  id: string;
  name: string;
  age_group: string | null;
  gender: string | null;
  division: string | null;
  league_id: string;
  league_name: string;
  coach_count: number;
}

export interface TeamSearchOrCreateProps {
  sportId: string;
  selectedTeam: TeamSearchRow | null;
  onSelect: (team: TeamSearchRow) => void;
  onCreate: () => void;
  className?: string;
}

interface RawRow {
  id: string;
  name: string;
  age_group: string | null;
  gender: string | null;
  division: string | null;
  league_id: string;
  leagues: { id: string; name: string; level: string | null } | { id: string; name: string; level: string | null }[] | null;
  league_coaches: { coach_id: string }[] | null;
}

const inputCls =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";

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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = search.trim();
    if (trimmed.length < 2 || !sportId) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("league_teams")
        .select(
          "id, name, age_group, gender, division, league_id, leagues!league_id(id, name, level), league_coaches(coach_id)"
        )
        .ilike("name", `%${trimmed}%`)
        .eq("sport_id", sportId)
        .order("name")
        .limit(20);

      if (queryError) {
        console.error("[TeamSearchOrCreate] search failed:", queryError);
        setError("Erreur de recherche — réessaie dans un instant");
        setResults([]);
        setLoading(false);
        setHasSearched(true);
        return;
      }

      // Filter to civil-level leagues client-side. PostgREST embed
      // can't filter the parent rows on a child table column directly
      // without using `!inner` join syntax — keeping it client-side
      // avoids that complexity for what should be a small result set.
      const civilOnly = (data ?? []).filter((row) => {
        const r = row as unknown as RawRow;
        const league = Array.isArray(r.leagues) ? r.leagues[0] : r.leagues;
        return league?.level === "Civil";
      });

      const mapped: TeamSearchRow[] = civilOnly.map((row) => {
        const r = row as unknown as RawRow;
        const league = Array.isArray(r.leagues) ? r.leagues[0] : r.leagues;
        return {
          id: r.id,
          name: r.name,
          age_group: r.age_group,
          gender: r.gender,
          division: r.division,
          league_id: r.league_id,
          league_name: league?.name ?? "",
          coach_count: r.league_coaches?.length ?? 0,
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
  }, [search, sportId]);

  if (selectedTeam) {
    return (
      <div className={`bg-[#111317] border border-[#22C55E]/30 rounded-lg p-5 space-y-3 ${className}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-head font-black text-lg text-white">{selectedTeam.name}</h3>
              {selectedTeam.age_group && (
                <span className="px-2 py-0.5 rounded-full bg-[#E63946]/10 text-[10px] font-bold text-[#E63946] uppercase border border-[#E63946]/20">
                  {selectedTeam.age_group}
                </span>
              )}
              {selectedTeam.gender && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-[#9CA3AF] uppercase border border-white/10">
                  {selectedTeam.gender}
                </span>
              )}
            </div>
            <p className="text-xs text-[#6B7280] mt-1">{selectedTeam.league_name}</p>
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
  const showInitialEmpty = !hasSearched && trimmed.length < 2;
  const showNoResults = hasSearched && !loading && results.length === 0 && trimmed.length >= 2;

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <input
          type="text"
          placeholder="Cherche ton équipe par nom (ex: Patriotes, Cobras AAA)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputCls}
          aria-label="Rechercher une équipe civile"
        />
        <p className="text-[11px] text-[#6B7280] mt-1.5">
          Tape au moins 2 caractères. Si ton équipe n&apos;existe pas, tu pourras la créer.
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
        <div className="space-y-2">
          {results.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => onSelect(team)}
              className="w-full text-left bg-[#111317] border border-white/10 hover:border-[#E63946]/40 rounded-lg p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white text-sm truncate">{team.name}</p>
                    {team.age_group && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#E63946]/10 text-[10px] font-bold text-[#E63946] uppercase border border-[#E63946]/20">
                        {team.age_group}
                      </span>
                    )}
                    {team.gender && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-[#9CA3AF] uppercase border border-white/10">
                        {team.gender}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-1 truncate">{team.league_name}</p>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${
                    team.coach_count === 0 ? "text-[#6B7280]" : "text-[#9CA3AF]"
                  }`}
                >
                  {team.coach_count === 0
                    ? "Aucun coach inscrit"
                    : `${team.coach_count} coach${team.coach_count === 1 ? "" : "s"}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {(showInitialEmpty || showNoResults) && (
        <div className="bg-[#111317] border border-white/5 rounded-lg p-6 text-center space-y-3">
          {showNoResults && (
            <p className="text-sm text-[#9CA3AF]">
              Aucune équipe trouvée pour <span className="font-bold text-white">&ldquo;{trimmed}&rdquo;</span>.
            </p>
          )}
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
