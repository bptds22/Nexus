"use client";

/* ═══════════════════════════════════════════════════════════════
   TeamPickerSheet — the KEY anti-duplicate surface.

   Bottom sheet that surfaces EXISTING teams at a given school
   (school_id) BEFORE the coach can create a new one. Pattern
   extracted from the civil onboarding's team step :
     - Searchable by team name (and structured label fields).
     - Each row displays civilTeamLabel = "{age} · {division} ·
       {gender}" (fallback to name) — the same display used by the
       civil onboarding's pick mode.
     - Bottom CTA "Aucune équipe — créer une nouvelle équipe" → the
       parent opens the TeamCreateFormBlock.
     - Picking a row calls onPicked(team) ; the parent decides
       whether to join (via lib/queries/coach/createTeam.joinTeam)
       or just record the team_id (e.g. civil onboarding which
       handles join inside its atomic RPC).

   Identity-agnostic ; the sheet itself doesn't write to the DB —
   that's the caller's call. Reuses the canon bottom-sheet idiom
   (portal + slide-up + drag-handle + safe-area).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { formatTeamLabel } from "@/lib/teams/teamLabel";
import { orgNounCe, type SchoolType } from "@/lib/utils/orgLabel";

export interface TeamPickerItem {
  id: string;
  name: string;
  /** Sport name (sports.nom). Needed to tell apart same-named teams:
   *  les équipes scrapées RSEQ portent le NOM DE L'ÉCOLE (5 lignes
   *  « Collège St-Jean-Vianney »), donc seul le quadruplet
   *  sport/âge/division/genre les distingue. */
  sport: string | null;
  ageGroup: string | null;
  division: string | null;
  gender: string | null;
  /** Athlete count for the team (read from team_athletes). */
  athleteCount: number;
  /** Nombre de coachs déjà sur l'équipe. 0 ⇒ équipe orpheline
   *  (scrapée, jamais revendiquée) → le 1er arrivant devient head_coach. */
  coachCount: number;
  /** L'une des équipes DU coach courant (passée via excludeTeamIds). On ne
   *  l'exclut plus (bug #3 : la seule équipe de l'école était masquée) — on
   *  l'affiche marquée « Ton équipe », non rejoignable. */
  isMine: boolean;
}

export interface TeamPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** School / club / ligue id whose teams to surface. */
  schoolId: string | null;
  /** When set, filters teams to that sport. Optional. */
  sportId?: string | null;
  /** Optional season filter. Default : surface every season.
   *  ⚠️ Filtre STRICT : une équipe dont season IS NULL ne matche jamais
   *  (NULL = 'x' est faux). Les équipes scrapées avaient season NULL —
   *  cf. migration 20260717120000_backfill_team_season.sql. */
  season?: string;
  /** Équipes à masquer (typiquement : celles que le coach a déjà).
   *  Évite de proposer « rejoindre » une équipe dont il est membre. */
  excludeTeamIds?: string[];
  /** User chose an existing team → parent decides what next. */
  onPicked: (team: TeamPickerItem) => void;
  /** User confirmed no existing team matches — open the create form.
   *  Optional : when omitted (e.g. école onboarding whose RPC only
   *  supports joining an existing team), the bottom CTA is hidden. */
  onCreateNew?: () => void;
  /** Sheet title. Defaults to "Choisir une équipe". */
  title?: string;
  /** Custom hint paragraph under the title. */
  hint?: string;
}

/* Label = formatTeamLabel partagé (lib/teams/teamLabel) : "Sport ·
   Catégorie · Division · Genre", champs vides retirés, repli sur le nom.
   MÊME source que les pickers d'onboarding (école/civil/Programme) — la
   sheet affichait auparavant son propre libellé SANS le sport, ce qui
   rendait indiscernables les 5 équipes scrapées d'une même école. */

export function TeamPickerSheet({
  open, onClose, schoolId, sportId, season, excludeTeamIds,
  onPicked, onCreateNew,
  title = "Choisir une équipe",
  hint,
}: TeamPickerSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [teams, setTeams] = useState<TeamPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dragOffset, setDragOffset] = useState(0);
  // Type de l'org ciblée (école / club / cégep) → vocabulaire type-aware.
  const [orgType, setOrgType] = useState<SchoolType | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setSearch(""); setDragOffset(0); } }, [open]);

  /* Clé stable : sans ça, un appelant qui passe un tableau littéral
     (`excludeTeamIds={ids}` recréé à chaque rendu) relancerait le fetch
     en boucle. On dépend de la VALEUR, pas de l'identité du tableau. */
  const excludeKey = (excludeTeamIds ?? []).join(",");

  /* Load existing teams whenever the sheet opens with a school_id. */
  useEffect(() => {
    if (!open || !schoolId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      // Type de l'org ciblée pour le vocabulaire (école vs club vs cégep).
      supabase.from("schools").select("type").eq("id", schoolId).maybeSingle().then(({ data: s }) => {
        if (!cancelled) setOrgType((s as { type?: SchoolType } | null)?.type ?? null);
      });
      let q = supabase
        .from("teams")
        .select("id, name, age_group, division, gender, season, sport_id, sports!sport_id(nom), team_athletes(id), team_coaches(coach_id)")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (sportId) q = q.eq("sport_id", sportId);
      if (season)  q = q.eq("season", season);
      const { data } = await q;
      if (cancelled) return;
      const exclude = new Set(excludeKey ? excludeKey.split(",") : []);
      // Bug #3 : on N'EXCLUT PLUS les équipes du coach (sinon sa seule équipe
      // masque toute la liste → « Aucune équipe existante »). On les garde et
      // on les marque isMine pour les afficher « Ton équipe », non rejoignables.
      const mapped: TeamPickerItem[] = (data || [])
        .map((r: Record<string, unknown>) => {
          // L'embed peut arriver en objet ou en tableau selon la relation.
          const sportRel = Array.isArray(r.sports) ? r.sports[0] : r.sports;
          return {
            id: r.id as string,
            name: (r.name as string) || "",
            sport: ((sportRel as { nom?: string } | null)?.nom as string | null) ?? null,
            ageGroup: (r.age_group as string | null) ?? null,
            division: (r.division as string | null) ?? null,
            gender: (r.gender as string | null) ?? null,
            athleteCount: ((r.team_athletes as unknown[]) || []).length,
            coachCount: ((r.team_coaches as unknown[]) || []).length,
            isMine: exclude.has(r.id as string),
          };
        });
      setTeams(mapped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, schoolId, sportId, season, excludeKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) =>
      t.name.toLowerCase().includes(q)
      || (t.sport ?? "").toLowerCase().includes(q)
      || (t.ageGroup ?? "").toLowerCase().includes(q)
      || (t.division ?? "").toLowerCase().includes(q)
      || (t.gender ?? "").toLowerCase().includes(q),
    );
  }, [teams, search]);

  if (!mounted || !open) return null;

  let touchStartY = 0;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70]"
        style={{
          background: `rgba(0,0,0,${Math.max(0.2, 0.6 - dragOffset / 300)})`,
          animation: "nx-modal-fade 200ms ease-out forwards",
        }}
        onClick={onClose}
        aria-hidden
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl flex flex-col"
        style={{
          maxHeight: "min(85vh, calc(100dvh - env(safe-area-inset-top, 0px)))",
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: `translateY(${dragOffset}px)`,
          transition: dragOffset === 0 ? "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab"
          onTouchStart={(e) => { touchStartY = e.touches[0].clientY; }}
          onTouchMove={(e) => {
            const dy = Math.max(0, e.touches[0].clientY - touchStartY);
            setDragOffset(dy);
          }}
          onTouchEnd={() => {
            if (dragOffset > 100) onClose();
            setDragOffset(0);
          }}
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Title */}
        <div className="px-5 pb-3 shrink-0">
          <h2 className="font-head text-[17px] font-black text-white uppercase tracking-tight text-center">
            {title}
          </h2>
          <p className="text-[12px] text-[#9CA3AF] text-center mt-1">
            {hint ?? "Vérifie si ton équipe existe déjà avant d'en créer une nouvelle."}
          </p>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 px-3 h-10 rounded-2xl bg-white/[0.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              inputMode="search"
              placeholder="Rechercher une équipe"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none"
            />
          </div>
        </div>

        {/* Body — existing teams list */}
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {loading ? (
            <div className="space-y-2 pt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[64px] rounded-2xl bg-[#111317] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#111317] border border-white/10 flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <p className="text-[14px] font-bold text-white">
                {teams.length === 0 ? "Aucune équipe existante" : "Aucun résultat"}
              </p>
              <p className="text-[12px] text-white/55 mt-1 max-w-xs">
                {teams.length === 0
                  ? `Sois la première personne à créer une équipe à ${orgNounCe(orgType)}.`
                  : "Essaie un autre nom ou crée une nouvelle équipe."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={t.isMine ? undefined : () => onPicked(t)}
                    disabled={t.isMine}
                    className={`w-full flex items-center gap-3 p-3 bg-[#111317] rounded-2xl transition-colors text-left ${t.isMine ? "opacity-60 cursor-default" : "active:bg-[#22262e]"}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-white truncate">{t.name}</p>
                      <p className="text-[12px] text-white/55 truncate">
                        {formatTeamLabel(t.sport, t.ageGroup, t.division, t.gender, t.name)}
                        {t.athleteCount > 0 ? ` · ${t.athleteCount} athlète${t.athleteCount > 1 ? "s" : ""}` : ""}
                      </p>
                      {/* Équipe orpheline (scrapée, jamais revendiquée) : le 1er
                          arrivant en devient head_coach — on l'annonce. */}
                      {!t.isMine && t.coachCount === 0 && (
                        <p className="text-[11px] text-[#22C55E] font-bold mt-0.5">
                          Aucun entraîneur — tu en deviendras responsable
                        </p>
                      )}
                    </div>
                    {t.isMine ? (
                      <span className="text-[10px] font-black uppercase tracking-wider text-white/70 bg-white/10 rounded-full px-2 py-1 flex-shrink-0">
                        Ton équipe
                      </span>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sticky CTA — create new. Hidden when onCreateNew is undefined
            (école onboarding : RPC only supports join-existing). */}
        {onCreateNew && (
          <div className="px-4 pt-2 pb-3 shrink-0 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onCreateNew}
              className="w-full h-12 rounded-2xl bg-[#E63946] text-white text-[14px] font-bold uppercase tracking-wider active:bg-[#D42B22] transition-colors flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Créer une nouvelle équipe
            </button>
          </div>
        )}
      </div>
      <style jsx global>{`
        @keyframes nx-modal-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
      `}</style>
    </>,
    document.body,
  );
}
