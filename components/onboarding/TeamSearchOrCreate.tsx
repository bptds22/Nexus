"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { filtrerClubs, peutCreerClub } from "@/lib/clubs/clubCorrespond";

/* ═══════════════════════════════════════════════════════════════
   TeamSearchOrCreate — inscription coach civil, ÉTAPE 1 : le CLUB.

   Parcours « club d'abord, puis équipe » (décision BP 2026-10-15, bug
   NLS). Avant, la recherche mêlait les équipes de tous les clubs (en
   tête) et les clubs (après) : sans rien taper, « No Limits Showcases »
   arrivait 328e, derrière ses 107 équipes, et « nls » ne trouvait rien.

   - Étape 1 (ici) : recherche de CLUBS seulement (lib/clubs/clubCorrespond :
     nom, ville ou sigle — « nls » trouve « No Limits Showcases »).
     Choisir un club → étape 2, les équipes de ce club (UmbrellaStep).
   - « Créer » n'apparaît qu'après une recherche tapée SANS aucun club
     correspondant (peutCreerClub) : jamais sur un sigle d'un club connu.

   Sport : le sélecteur (valeur possédée par le parent, workingSportId)
   ne filtre pas les clubs — un club civil n'a pas de sport (schools n'a
   pas de sport_id). Il fixe le sport des équipes de l'étape 2 et de
   l'équipe créée. Il n'écrit jamais users.sport / sport_principal.

   Résultats paginés (5/page étroit, 8/page md+), glisser gauche/droite.
═══════════════════════════════════════════════════════════════ */

export interface TeamSearchRow {
  id: string;
  name: string;
  age_group: string | null;
  gender: string | null;
  division: string | null;
  /** teams.zone — « Nord », « Sud » : partie du nom du groupe (BP 2026-10-09). */
  zone?: string | null;
  league: string | null;
  school_id: string;
  school_name: string;
  coach_count: number;
  /** Sport name (sports.nom). Optional — populated by the school/recruiter
   *  umbrella pickers that surface teams across all sports, so the card can
   *  show the sport. */
  sport?: string | null;
}

export interface ClubSearchRow {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
}

export interface TeamSearchOrCreateProps {
  /**
   * Working sport id — driven by the parent's lifted state. The
   * selector below writes BACK to that parent via onSportChange so
   * the same value scopes the umbrella query and the new-team INSERT
   * sport_id (single source of truth).
   */
  sportId: string;
  onSportChange: (sportId: string) => void;
  onSelectClub: (id: string, name: string) => void;
  onCreate: () => void;
  className?: string;
}

interface SportOption { id: string; nom: string }

const inputCls =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";
const labelCls =
  "block text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-1.5";

const SWIPE_THRESHOLD_PX = 50;

export default function TeamSearchOrCreate({
  sportId,
  onSportChange,
  onSelectClub,
  onCreate,
  className = "",
}: TeamSearchOrCreateProps) {
  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState<ClubSearchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sport options for the working-sport <select>. Selector value is
  // the sportId prop (parent-owned); writes flow through onSportChange.
  const [sportOptions, setSportOptions] = useState<SportOption[]>([]);
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

  // Tous les clubs civils, une fois (≈ 270) ; filtrés ici par clubCorrespond.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await createClient()
        .from("schools")
        .select("id, name, city, region")
        .eq("type", "LIGUE_CIVILE")
        .order("name");
      if (cancelled) return;
      if (e) {
        console.error("[TeamSearchOrCreate] clubs fetch failed:", e);
        setError("Erreur de recherche — réessaie dans un instant");
        setClubs([]);
        return;
      }
      setClubs((data ?? []) as ClubSearchRow[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const results = useMemo(() => (clubs ? filtrerClubs(clubs, search) : []), [clubs, search]);
  const loading = clubs === null;

  // Pagination + responsive page size.
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  // Responsive page size: 5 on narrow viewports, 8 on md+.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setPageSize(mq.matches ? 8 : 5);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Reset to page 0 whenever the search changes.
  useEffect(() => {
    setCurrentPage(0);
  }, [search]);

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

  const trimmed = search.trim();
  // « Créer » : recherche tapée et AUCUN club correspondant (sigle compris).
  const showCreate = !loading && !error && peutCreerClub(search, clubs ?? []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Working-sport selector. Value = the sportId prop (parent's
          workingSportId, seeded from Profil's sport_principal). It scopes
          the step-2 teams and the sport_id of any team created from here —
          NOT the club search: clubs are sport-agnostic by design. */}
      <div>
        <label htmlFor="team-search-sport" className={labelCls}>Sport</label>
        <select
          id="team-search-sport"
          value={sportId}
          onChange={(e) => onSportChange(e.target.value)}
          className={`${inputCls} appearance-none cursor-pointer`}
          aria-label="Sport des équipes du club et de l'équipe créée"
        >
          {sportOptions.length === 0 && (
            <option value={sportId}>Chargement...</option>
          )}
          {sportOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>
        <p className="text-[11px] text-[#6B7280] mt-1.5">
          Pré-rempli depuis ton profil — change-le pour voir ou créer une équipe dans un autre sport. Ne change pas ton sport déclaré.
        </p>
      </div>

      {/* Club search input. */}
      <div>
        <label htmlFor="team-search-input" className={labelCls}>Ton club</label>
        <input
          id="team-search-input"
          type="text"
          placeholder="Nom, ville ou sigle du club (ex : NLS)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputCls}
          aria-label="Rechercher un club civil par nom, ville ou sigle"
        />
        <p className="text-[11px] text-[#6B7280] mt-1.5">
          Choisis d&apos;abord ton club : tu verras ensuite ses équipes.
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
            {pagedResults.map((club) => {
              const cityRegion = [club.city, club.region].filter(Boolean).join(" · ");
              return (
                <button
                  key={`club-${club.id}`}
                  type="button"
                  onClick={() => onSelectClub(club.id, club.name)}
                  className="text-left bg-[#111317] border border-white/10 hover:border-[#E63946]/40 rounded-lg p-4 transition-colors"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Club</p>
                  <p className="font-bold text-white text-sm break-words mt-1">{club.name}</p>
                  {cityRegion && (
                    <p className="text-[11px] text-[#9CA3AF] mt-1 truncate">{cityRegion}</p>
                  )}
                  <p className="text-[11px] text-[#22C55E] font-bold mt-3">Voir les équipes du club →</p>
                </button>
              );
            })}
          </div>

          {/* Pagination controls. */}
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
                <span className="text-[11px] text-[#6B7280] tabular-nums">
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

      {showCreate && (
        <div className="bg-[#111317] border border-white/5 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-[#9CA3AF]">
            Aucun club trouvé pour <span className="font-bold text-white">&ldquo;{trimmed}&rdquo;</span>. Vérifie le nom ou crée ton club et ton équipe.
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
