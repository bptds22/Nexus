/* Parcours d'équipes — shared helpers (sort, parse, validate) for the
   declarative team-history feature. Used by TeamHistoryBlock (display),
   TeamHistoryEditor (edit), and the load/save plumbing. */

import type { TeamHistoryEntry } from "@/lib/types/models";

export const MAX_TEAM_HISTORY = 10;
export const MIN_TEAM_YEAR = 1990;

/** year_end null/absent = current team (équipe actuelle). */
export const isCurrentEntry = (e: TeamHistoryEntry): boolean => e.year_end == null;

/** Ordre d'affichage : entrées courantes d'abord, puis départ le plus récent.
 *
 *  ⚠ POURQUOI left_at ET NON year_start.
 *  Les entrées SYSTÈME tirent year_start / year_end de `teams.season`
 *  (« 2025-2026 » → 2025 / 2026). Trois transferts dans la même saison
 *  produisent donc TROIS entrées aux années IDENTIQUES, que l'ancien
 *  comparateur ne pouvait pas départager : l'ordre retombait sur celui du
 *  tableau. On voyait alors un sport en tête du parcours qui contredisait
 *  l'équipe actuelle.
 *  `left_at` est horodaté à la seconde et écrit à chaque départ : c'est le seul
 *  champ qui ordonne réellement. Il n'existe que sur les entrées système, d'où
 *  le repli sur year_start pour celles déclarées à la main. */
export function sortTeamHistory(entries: TeamHistoryEntry[]): TeamHistoryEntry[] {
  const quitteLe = (e: TeamHistoryEntry): number => {
    const t = e.left_at ? Date.parse(e.left_at) : NaN;
    return Number.isFinite(t) ? t : -Infinity;
  };
  return [...entries].sort((a, b) => {
    const ac = isCurrentEntry(a);
    const bc = isCurrentEntry(b);
    if (ac !== bc) return ac ? -1 : 1;
    const qa = quitteLe(a), qb = quitteLe(b);
    if (qa !== qb && Number.isFinite(qa) && Number.isFinite(qb)) return qb - qa;
    return (b.year_start || 0) - (a.year_start || 0);
  });
}

/** Coerce raw JSONB (array | stringified array | junk) into clean entries. */
export function parseTeamHistory(raw: unknown): TeamHistoryEntry[] {
  let arr: unknown = raw;
  if (typeof arr === "string") {
    try { arr = JSON.parse(arr); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_TEAM_HISTORY).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const ys = Number(o.year_start);
    const yeRaw = o.year_end;
    const ye = yeRaw == null || yeRaw === "" ? null : Number(yeRaw);
    /* Les quatre derniers champs étaient JETÉS ici, alors que
       _apply_team_attachment_core les écrit à chaque transfert. Conséquences
       observées : le parcours ne pouvait pas s'ordonner (left_at perdu) ni
       afficher un libellé distinctif (season perdue), et deux équipes
       homonymes de clubs différents restaient indiscernables (school_name
       perdu). On les conserve en optionnel : les entrées déclarées à la main
       par l'athlète ne les portent pas. */
    const txt = (v: unknown): string | null =>
      typeof v === "string" && v.trim() !== "" ? v : null;
    return {
      team_name: typeof o.team_name === "string" ? o.team_name : "",
      sport: typeof o.sport === "string" ? o.sport : "",
      ligue: typeof o.ligue === "string" ? o.ligue : "",
      division: typeof o.division === "string" ? o.division : "",
      year_start: Number.isFinite(ys) ? ys : 0,
      year_end: ye != null && Number.isFinite(ye) ? ye : null,
      left_at: txt(o.left_at),
      school_name: txt(o.school_name),
      season: txt(o.season),
      source: txt(o.source),
    };
  });
}

export interface EntryError { team_name?: string; year_start?: string; year_end?: string; }

export function validateEntry(e: TeamHistoryEntry, maxYear: number): EntryError {
  const err: EntryError = {};
  if (!e.team_name.trim()) err.team_name = "Nom d'équipe requis";
  if (!e.year_start || e.year_start < MIN_TEAM_YEAR || e.year_start > maxYear) {
    err.year_start = `Année entre ${MIN_TEAM_YEAR} et ${maxYear}`;
  }
  if (e.year_end != null) {
    if (e.year_end < MIN_TEAM_YEAR || e.year_end > maxYear) err.year_end = `Année entre ${MIN_TEAM_YEAR} et ${maxYear}`;
    else if (e.year_start && e.year_end < e.year_start) err.year_end = "Fin avant début";
  }
  return err;
}

export const entryHasError = (err: EntryError): boolean => !!(err.team_name || err.year_start || err.year_end);

/** True when every entry is valid and the cap is respected. */
export function isTeamHistoryValid(entries: TeamHistoryEntry[], maxYear: number): boolean {
  return entries.length <= MAX_TEAM_HISTORY && entries.every((e) => !entryHasError(validateEntry(e, maxYear)));
}
