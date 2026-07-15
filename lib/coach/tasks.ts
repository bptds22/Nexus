/* ═══════════════════════════════════════════════════════════════
   lib/coach/tasks.ts — Coach "à traiter" tasks (data helper).

   ONE source of truth for what counts as an actionable task for a
   coach. Today the logic is duplicated in 3+ places (dashboard
   ActionBar, MobileTabBar badge, web roster À traiter sub-tab) and
   each is its own filter pipeline. This module consolidates the
   definitions so the numbers can never drift across surfaces.

   Three task types — independent, an athlete can appear in multiple:

     1. UNVERIFIED         athletes.verified IS NOT true
                           OR modified_since_verification = true
                           (athlète vérifié mais modifié depuis → à re-vérifier)
     2. MISSING EVAL       missing star AND missing report (see isMissingEval)
                           — a star-only or report-only eval counts as done
     3. PENDING SUGGESTION athlete_suggestions.status='EN_ATTENTE'

   Future migrators (port in lock-step so badges and lists agree) :
     - app/_components/mobile/MobileTabBar.tsx           (à-traiter badge)
     - app/coach/tableau-de-bord/page.tsx + ActionBar    (web dashboard cards)
     - components/shared/CoachDashboardMobile.tsx        (mobile dashboard)
     - app/coach/a-traiter/page.tsx                      (new À traiter page)

   ⚠ Adopting this helper on the badge will INCREASE the displayed
   count, because "missingEval" was not previously included. That
   change is intentional — the badge and the new page must agree.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

/* ── Public types ─────────────────────────────────────────────── */

export interface CoachTaskAthlete {
  id: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  /** position.abreviation (fallback empty). */
  position: string;
  /** 0 if not set on the athlete row. */
  graduationYear: number;
  /** sport.nom (fallback empty). */
  sport: string;
  /** Cote-B : the coach's OWN current evaluation cote (from the
   *  evaluations(coach_id, cote_globale) embed). Null when this
   *  coach hasn't yet evaluated the athlete. Surfaced so the
   *  CoachATraiterMobile EvalQuickSheet can show the cote-change
   *  confirmation modal with the correct originalCote. */
  coteGlobale: number | null;
}

export interface CoachTaskSuggestion {
  id: string;
  athleteId: string;
  athleteName: string;
  champ: string;
  valeurActuelle: string | null;
  valeurProposee: string;
  message: string | null;
  createdAt: string;
}

export interface CoachTasksBreakdown {
  unverified: CoachTaskAthlete[];
  missingEval: CoachTaskAthlete[];
  pendingSuggestions: CoachTaskSuggestion[];
  /** Sum of the three array lengths. An athlete in BOTH unverified
   *  and missingEval contributes 2 — categories are independent and
   *  do NOT dedupe across each other. */
  total: number;
}

export interface CoachTaskCounts {
  unverified: number;
  missingEval: number;
  pendingSuggestions: number;
  total: number;
}

/* ── Internal Supabase join row shapes ────────────────────────── */

interface SportJoin { nom: string | null }
interface PositionJoin { abreviation: string | null }
interface EvalJoinRow {
  coach_id: string | null;
  cote_globale: number | null;
  rapport_entraineur: string | null;
}

interface AthleteRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  modified_since_verification: boolean | null;
  cote_globale_entraineur: number | null;
  sports: SportJoin | SportJoin[] | null;
  positions: PositionJoin | PositionJoin[] | null;
  evaluations: EvalJoinRow[] | null;
}

interface SuggestionRow {
  id: string;
  athlete_id: string;
  champ: string | null;
  valeur_actuelle: string | null;
  valeur_proposee: string | null;
  message: string | null;
  created_at: string | null;
  athletes:
    | { first_name: string | null; last_name: string | null }
    | { first_name: string | null; last_name: string | null }[]
    | null;
}

/* ── Helpers ──────────────────────────────────────────────────── */

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function toTaskAthlete(
  row: AthleteRow,
  myEval: { cote_globale: number | null } | null,
): CoachTaskAthlete {
  const sport = pickFirst(row.sports);
  const position = pickFirst(row.positions);
  return {
    id: row.id,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    photo: row.photo_url ?? null,
    position: position?.abreviation ?? "",
    graduationYear: row.annee_diplomation ?? 0,
    sport: sport?.nom ?? "",
    coteGlobale: myEval?.cote_globale ?? null,
  };
}

/* ── Detection logic — exported for unit tests + per-row UI checks ─ */

/**
 * Is this athlete missing a coach evaluation? AND-logic — an eval is
 * present as soon as there is a star OR a report; it is missing only
 * when BOTH are absent. A star-only eval (the quick-eval sheet lets you
 * save one) is complete, and so is a report-only eval.
 *
 *   missing star   = evaluation.cote_globale IS NULL
 *                    AND athletes.cote_globale_entraineur IS NULL.
 *                    A simplified-mode athlete with cote_globale_entraineur
 *                    set still HAS a star — they are NOT missing.
 *
 *   missing report = NO evaluation row for this coach
 *                    OR rapport_entraineur null / empty after trim.
 *
 * The `evaluation` arg must be the row matching the CURRENT coach
 * (filtered upstream — RLS lets other coaches' evaluations appear in
 * the join because "anyone can read evaluations" is permissive).
 */
export function isMissingEval(
  athlete: { cote_globale_entraineur: number | null },
  evaluation: { cote_globale: number | null; rapport_entraineur: string | null } | null,
): boolean {
  const missingStar =
    (evaluation?.cote_globale ?? null) === null &&
    (athlete.cote_globale_entraineur ?? null) === null;
  const missingReport =
    !evaluation || (evaluation.rapport_entraineur ?? "").trim() === "";
  return missingStar && missingReport;
}

/* ── Main loader ──────────────────────────────────────────────── */

/**
 * Load every "à traiter" task bucket for a coach.
 *
 * Two queries run in parallel:
 *   1. athletes (coach_id=coachUserId, status='ACTIF') with verified
 *      + cote_globale_entraineur + joined evaluations(coach_id,
 *      cote_globale, rapport_entraineur) + joined sports/positions.
 *   2. athlete_suggestions (coach_id=coachUserId, status='EN_ATTENTE')
 *      ordered created_at DESC with joined athletes(first_name, last_name).
 *
 * Mirrors the SELECT shape used by app/coach/athletes/page.tsx
 * (L241-292) — slimmer column set, no new columns invented.
 *
 * On query error, returns an empty breakdown. Errors are console.error'd
 * so the badge / page degrade gracefully (show 0) rather than throwing.
 */
export async function loadCoachTasks(
  supabase: SupabaseClient,
  coachUserId: string,
): Promise<CoachTasksBreakdown> {
  const [athletesRes, suggestionsRes] = await Promise.all([
    supabase
      .from("athletes")
      .select(`
        id,
        first_name,
        last_name,
        photo_url,
        annee_diplomation,
        verified,
        modified_since_verification,
        cote_globale_entraineur,
        sports!sport_id(nom),
        positions!position_id(abreviation),
        evaluations(coach_id, cote_globale, rapport_entraineur)
      `)
      .eq("coach_id", coachUserId)
      .eq("status", "ACTIF"),
    supabase
      .from("athlete_suggestions")
      .select(`
        id,
        athlete_id,
        champ,
        valeur_actuelle,
        valeur_proposee,
        message,
        created_at,
        athletes!athlete_id(first_name, last_name)
      `)
      .eq("coach_id", coachUserId)
      .eq("status", "EN_ATTENTE")
      .order("created_at", { ascending: false }),
  ]);

  if (athletesRes.error) {
    console.error("[loadCoachTasks] athletes query failed:", athletesRes.error.message);
  }
  if (suggestionsRes.error) {
    console.error("[loadCoachTasks] suggestions query failed:", suggestionsRes.error.message);
  }

  const athletes = (athletesRes.data ?? []) as AthleteRow[];
  const suggestions = (suggestionsRes.data ?? []) as SuggestionRow[];

  const unverified: CoachTaskAthlete[] = [];
  const missingEval: CoachTaskAthlete[] = [];

  for (const row of athletes) {
    const evals = (row.evaluations ?? []) as EvalJoinRow[];
    // Pick the evaluation row owned by THIS coach. The permissive
    // "anyone can read evaluations" RLS makes the join return rows
    // owned by other coaches too — we filter explicitly so the gate
    // is coach-scoped, not "any coach who happens to share an athlete".
    const myEval = evals.find((e) => e.coach_id === coachUserId) ?? null;

    const task = toTaskAthlete(row, myEval);

    // Treat null verified as unverified — matches the established
    // MobileTabBar / dashboard reading (filter by truthy `verified`,
    // everything else is unverified). Un athlète vérifié MAIS modifié
    // depuis sa dernière vérif (modified_since_verification) revient aussi
    // dans la file « à vérifier » — symétrique du clear fait à la re-pose.
    if (!row.verified || row.modified_since_verification) {
      unverified.push(task);
    }
    if (isMissingEval({ cote_globale_entraineur: row.cote_globale_entraineur }, myEval)) {
      missingEval.push(task);
    }
  }

  const pendingSuggestions: CoachTaskSuggestion[] = suggestions.map((s) => {
    const athleteJoin = pickFirst(s.athletes);
    const athleteName = athleteJoin
      ? `${athleteJoin.first_name ?? ""} ${athleteJoin.last_name ?? ""}`.trim()
      : "";
    return {
      id: s.id,
      athleteId: s.athlete_id,
      athleteName,
      champ: s.champ ?? "",
      valeurActuelle: s.valeur_actuelle ?? null,
      valeurProposee: s.valeur_proposee ?? "",
      message: s.message ?? null,
      createdAt: s.created_at ?? "",
    };
  });

  const total =
    unverified.length + missingEval.length + pendingSuggestions.length;

  return { unverified, missingEval, pendingSuggestions, total };
}

/* ── Count-only variant ───────────────────────────────────────────
   Delegates to loadCoachTasks and returns lengths. Same filters →
   guaranteed identical numbers, drift impossible. The badge path
   (re-run on route change) eats a small overfetch of columns; if
   this ever becomes a hot path, the partition loop above is small
   enough to fork into an aggregate-only variant.
─────────────────────────────────────────────────────────────────── */

export async function loadCoachTaskCounts(
  supabase: SupabaseClient,
  coachUserId: string,
): Promise<CoachTaskCounts> {
  const breakdown = await loadCoachTasks(supabase, coachUserId);
  return {
    unverified: breakdown.unverified.length,
    missingEval: breakdown.missingEval.length,
    pendingSuggestions: breakdown.pendingSuggestions.length,
    total: breakdown.total,
  };
}
