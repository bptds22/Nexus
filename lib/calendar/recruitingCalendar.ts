/* ═══════════════════════════════════════════════════════════════
   recruitingCalendar — modèle partagé du Calendrier de recrutement.

   Desktop (app/recruteur/calendrier) et mobile
   (components/shared/RecruteurCalendrierMobile) consomment ces mêmes
   fonctions : compteurs, semaines, « fort potentiel » et grille
   mensuelle sont calculés une seule fois, au même endroit.

   Sémantique des filtres : les filtres réduisent les CIBLES. Un match
   s'affiche dès qu'au moins une cible filtrée y joue, et son compteur
   est recalculé sur les cibles restantes.
═══════════════════════════════════════════════════════════════ */

import type { CalendarGame, CalendarTarget } from "@/lib/queries/recruiter/useRecruitingCalendar";
import { parseGameDate } from "@/lib/queries/recruiter/useRecruitingCalendar";

/* ── Filtres ───────────────────────────────────────────────── */

export interface CalendarFilters {
  /** Slug sport ("football", "flag_football"). */
  sport: string;
  /** Abréviation de position — inopérant tant qu'aucun sport n'est choisi. */
  position: string;
  /** Multi-sélection : une cible passe si son année est dans la liste. */
  promotions: string[];
  region: string;
  orgType: string;
  minRating: string;
  minGpa: string;
  /** Stage recruiter_pipeline. */
  stage: string;
  /** Multi-sélection : union (la cible est dans AU MOINS une des listes). */
  listIds: string[];
  verifiedOnly: boolean;
  withVideoOnly: boolean;
  /** Seuil de densité appliqué au compteur du match APRÈS les filtres de
   *  cibles ci-dessus. 1 = pas de seuil (tout match ayant au moins une
   *  cible filtrée). Ce n'est PAS un filtre de cible : il ne retire
   *  personne du décompte, il masque les matchs sous le seuil. */
  minTargets: number;
}

export const EMPTY_FILTERS: CalendarFilters = {
  sport: "",
  position: "",
  promotions: [],
  region: "",
  orgType: "",
  minRating: "",
  minGpa: "",
  stage: "",
  listIds: [],
  verifiedOnly: false,
  withVideoOnly: false,
  minTargets: 1,
};

export function hasActiveFilters(f: CalendarFilters): boolean {
  return (
    !!f.sport || !!f.position || f.promotions.length > 0 || !!f.region ||
    !!f.orgType || !!f.minRating || !!f.minGpa || !!f.stage ||
    f.listIds.length > 0 || f.verifiedOnly || f.withVideoOnly ||
    f.minTargets > 1
  );
}

export function filterTargets(targets: CalendarTarget[], f: CalendarFilters): CalendarTarget[] {
  return targets.filter((t) => {
    if (f.sport && t.sport !== f.sport) return false;
    if (f.sport && f.position && t.position !== f.position) return false;
    if (f.promotions.length && !f.promotions.includes(String(t.graduationYear))) return false;
    if (f.region && t.region !== f.region) return false;
    if (f.orgType && t.orgType !== f.orgType) return false;
    if (f.minRating && t.stars < parseFloat(f.minRating)) return false;
    if (f.minGpa && t.gpa < parseFloat(f.minGpa)) return false;
    if (f.stage && t.pipelineStage !== f.stage) return false;
    // Union : la cible doit appartenir à au moins une des listes cochées.
    if (f.listIds.length && !t.listIds.some((id) => f.listIds.includes(id))) return false;
    if (f.verifiedOnly && !t.verified) return false;
    if (f.withVideoOnly && !t.hasVideo) return false;
    return true;
  });
}

/* ── Matchs ────────────────────────────────────────────────── */

export interface MatchView {
  game: CalendarGame;
  homeTargets: CalendarTarget[];
  visitorTargets: CalendarTarget[];
  /** Cibles des DEUX équipes, combinées — c'est le badge de la carte. */
  count: number;
  /** Plus haute densité de sa semaine, minimum 2 cibles. */
  hot: boolean;
}

export type CalendarSort = "date" | "density";

/** Construit les matchs visibles à partir des cibles filtrées.
 *  Un match sans aucune cible filtrée disparaît.
 *
 *  `minTargets` est appliqué APRÈS le décompte, donc après les filtres de
 *  cibles : un match n'apparaît que si son compte de cibles FILTRÉES
 *  atteint le seuil. Le seuil est appliqué AVANT `markHotMatches`, sinon
 *  un match masqué continuerait de fixer le maximum de sa semaine et
 *  aucun match visible ne serait « fort potentiel ». */
export function buildMatches(
  games: CalendarGame[],
  targets: CalendarTarget[],
  sort: CalendarSort = "date",
  minTargets: number = 1,
): MatchView[] {
  // Index teams.id → cibles, construit une fois : la boucle sur les
  // matchs reste en O(matchs), pas en O(matchs × cibles).
  // Une seule clé, donc au plus UN appariement par (match, cible) : pas
  // de double comptage possible dans `count`.
  const byTeam = new Map<string, CalendarTarget[]>();
  targets.forEach((t) => {
    const cur = byTeam.get(t.teamId) ?? [];
    cur.push(t);
    byTeam.set(t.teamId, cur);
  });

  const views: MatchView[] = [];
  games.forEach((game) => {
    const homeTargets = (game.homeTeamId && byTeam.get(game.homeTeamId)) || [];
    const visitorTargets = (game.visitorTeamId && byTeam.get(game.visitorTeamId)) || [];
    const count = homeTargets.length + visitorTargets.length;
    if (count === 0) return;
    if (count < Math.max(1, minTargets)) return;
    views.push({ game, homeTargets, visitorTargets, count, hot: false });
  });

  sortMatches(views, sort);
  markHotMatches(views);
  return views;
}

/** Tri par défaut : date ASC, densité DESC en second critère.
 *  Tri « densité » : densité DESC, puis date ASC. */
function sortMatches(views: MatchView[], sort: CalendarSort): void {
  views.sort((a, b) => {
    if (sort === "density") {
      if (b.count !== a.count) return b.count - a.count;
      return a.game.gameDate.localeCompare(b.game.gameDate);
    }
    if (a.game.gameDate !== b.game.gameDate) {
      return a.game.gameDate.localeCompare(b.game.gameDate);
    }
    return b.count - a.count;
  });
}

/** « Match à fort potentiel » = plus haute densité de SA semaine, avec un
 *  plancher de 2 cibles. Une semaine dont le meilleur match n'a qu'une
 *  cible n'en désigne aucun. En cas d'égalité au sommet, tous les
 *  ex æquo sont marqués — arbitrer arbitrairement serait mentir. */
function markHotMatches(views: MatchView[]): void {
  const maxByWeek = new Map<string, number>();
  views.forEach((v) => {
    const wk = weekKey(v.game.gameDate);
    maxByWeek.set(wk, Math.max(maxByWeek.get(wk) ?? 0, v.count));
  });
  views.forEach((v) => {
    const max = maxByWeek.get(weekKey(v.game.gameDate)) ?? 0;
    v.hot = max >= 2 && v.count === max;
  });
}

/* ── Semaines ──────────────────────────────────────────────── */

export interface WeekGroup {
  /** "YYYY-MM-DD" du lundi. */
  key: string;
  /** « Semaine du 12 octobre ». */
  label: string;
  matches: MatchView[];
  matchCount: number;
  /** Somme des compteurs des matchs de la semaine (comme la réf). */
  targetCount: number;
}

function isoOf(d: Date): string {
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Lundi de la semaine du match (semaine ISO, lundi → dimanche). */
export function weekKey(gameDate: string): string {
  const d = parseGameDate(gameDate);
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - dow);
  return isoOf(d);
}

const DAY_MONTH = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long" });
const MONTH_YEAR = new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric" });
const SHORT_MONTH = new Intl.DateTimeFormat("fr-CA", { month: "short" });

export function weekLabel(mondayIso: string): string {
  return `Semaine du ${DAY_MONTH.format(parseGameDate(mondayIso))}`;
}

/** « Octobre 2026 » — première lettre capitalisée. */
export function monthLabel(year: number, month: number): string {
  const raw = MONTH_YEAR.format(new Date(year, month, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** « OCT » pour le bloc date de la carte. */
export function shortMonthLabel(gameDate: string): string {
  return SHORT_MONTH.format(parseGameDate(gameDate)).replace(".", "");
}

export function dayNumber(gameDate: string): number {
  return parseGameDate(gameDate).getDate();
}

export function groupByWeek(views: MatchView[]): WeekGroup[] {
  const groups = new Map<string, MatchView[]>();
  views.forEach((v) => {
    const k = weekKey(v.game.gameDate);
    const cur = groups.get(k) ?? [];
    cur.push(v);
    groups.set(k, cur);
  });
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, matches]) => ({
      key,
      label: weekLabel(key),
      matches,
      matchCount: matches.length,
      targetCount: matches.reduce((sum, m) => sum + m.count, 0),
    }));
}

/* ── Grille mensuelle ──────────────────────────────────────── */

export interface CalendarCell {
  /** "YYYY-MM-DD" — clé de sélection. */
  iso: string;
  day: number;
  /** Hors du mois affiché (débord de grille). */
  outside: boolean;
  isToday: boolean;
  /** Au moins un match à cibles ce jour-là → point rouge. */
  hasMatch: boolean;
  /** Au moins un « fort potentiel » ce jour-là → ★ rouge, qui remplace
   *  le point. La grille ne porte plus de compteur : le détail vit dans
   *  les cartes rendues sous la grille. */
  hasHot: boolean;
}

/** Grille lundi → dimanche couvrant tout le mois, débords compris. */
export function buildMonthGrid(
  year: number,
  month: number,
  views: MatchView[],
  todayIsoStr: string,
): CalendarCell[] {
  const matchDays = new Set<string>();
  const hotDays = new Set<string>();
  views.forEach((v) => {
    matchDays.add(v.game.gameDate);
    if (v.hot) hotDays.add(v.game.gameDate);
  });

  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // lundi = 0
  const start = new Date(year, month, 1 - lead);

  const last = new Date(year, month + 1, 0);
  const trail = 6 - ((last.getDay() + 6) % 7);
  const total = lead + last.getDate() + trail;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = isoOf(d);
    cells.push({
      iso,
      day: d.getDate(),
      outside: d.getMonth() !== month,
      isToday: iso === todayIsoStr,
      hasMatch: matchDays.has(iso),
      hasHot: hotDays.has(iso),
    });
  }
  return cells;
}

/** Matchs d'un jour donné — rendus sous la grille, même carte que la liste. */
export function matchesOnDay(views: MatchView[], iso: string): MatchView[] {
  return views.filter((v) => v.game.gameDate === iso);
}

/** « Mis à jour le 24 juillet 2026 ». */
export function formatLastUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric", month: "long", year: "numeric",
  }).format(d);
}
