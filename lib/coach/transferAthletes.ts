import type { SupabaseClient } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════════════════════
   transferAthletes — shared logic for GESTION DES ATHLÈTES.

   Moves athletes.coach_id ownership between coaches at the SAME
   school (or to/from the "Non assigné" pool where coach_id IS NULL).
   Does NOT touch team_athletes — this is ownership only.

   Security boundary is RLS (policy "coaches reassign athletes
   within school"): a coach may only reassign athletes at their own
   school, and only TO a coach at that same school (or to NULL).
═══════════════════════════════════════════════════════════════ */

/** Sentinel used in the UI dropdowns for the coach_id IS NULL pool. */
export const UNASSIGNED_COACH_ID = "__UNASSIGNED__";

/**
 * Pick a sensible initial SOURCE so the transfer panel isn't empty on load:
 *   me (if I have athletes) → "Non assigné" pool (if it has any) →
 *   first coach with athletes → "" (nothing to select).
 */
export function pickInitialSource(coaches: SchoolCoachOption[], selfId: string): string {
  const me = coaches.find((c) => c.id === selfId);
  if (me && me.athleteCount > 0) return me.id;
  const pool = coaches.find((c) => c.id === UNASSIGNED_COACH_ID);
  if (pool && pool.athleteCount > 0) return UNASSIGNED_COACH_ID;
  const firstNonEmpty = coaches.find((c) => c.athleteCount > 0);
  return firstNonEmpty ? firstNonEmpty.id : "";
}

export interface SchoolCoachOption {
  /** Coach user id, or UNASSIGNED_COACH_ID for the unclaimed pool. */
  id: string;
  name: string;
  sport: string;
  athleteCount: number;
}

export interface TransferAthlete {
  id: string;
  firstName: string;
  lastName: string;
  photo?: string | null;
  sport?: string | null;
  position?: string | null;
}

/**
 * Bulk-update coach ownership. `toCoachId` may be a real coach id or
 * UNASSIGNED_COACH_ID (→ coach_id = NULL, i.e. send back to the pool).
 */
export async function transferAthletes(
  supabase: SupabaseClient,
  athleteIds: string[],
  toCoachId: string,
): Promise<{ success: boolean; error?: string }> {
  if (athleteIds.length === 0) {
    return { success: false, error: "Aucun athlète sélectionné." };
  }

  const coachId = toCoachId === UNASSIGNED_COACH_ID ? null : toCoachId;

  // `.select()` so we can count rows ACTUALLY updated. RLS
  // ("Coaches update own team athletes" / own-athlete / claim-unclaimed)
  // limits reassignment to the athlete's owner, its team coach, or a
  // director — a denied row updates silently (no error, 0 rows). Without
  // this check the caller reported a phantom success on athletes it
  // couldn't move.
  const { data, error } = await supabase
    .from("athletes")
    .update({ coach_id: coachId, updated_at: new Date().toISOString() })
    .in("id", athleteIds)
    .select("id");

  if (error) return { success: false, error: error.message };

  const moved = (data ?? []).length;
  if (moved < athleteIds.length) {
    const blocked = athleteIds.length - moved;
    return {
      success: false,
      error:
        `${blocked} athlète${blocked > 1 ? "s" : ""} n'ont pas pu être transféré${blocked > 1 ? "s" : ""}. ` +
        "Tu peux seulement réassigner tes propres athlètes, ceux de tes équipes, ou (en tant que directeur) tous ceux de l'école.",
    };
  }
  return { success: true };
}

/**
 * Coaches at a school + their active-athlete counts, plus a virtual
 * "Non assigné" entry (coach_id IS NULL) at the top.
 */
export async function loadSchoolCoaches(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<SchoolCoachOption[]> {
  const [{ data: scRows }, { data: athRows }] = await Promise.all([
    supabase
      .from("school_coaches")
      .select("coach_id, sport, users!coach_id(first_name, last_name)")
      .eq("school_id", schoolId),
    supabase
      .from("athletes")
      .select("coach_id")
      .eq("school_id", schoolId)
      .eq("status", "ACTIF"),
  ]);

  // coach_id (or null) → active athlete count
  const counts = new Map<string | null, number>();
  (athRows ?? []).forEach((a) => {
    const cid = (a as { coach_id: string | null }).coach_id;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
  });

  const coaches: SchoolCoachOption[] = (scRows ?? []).map((row) => {
    const r = row as {
      coach_id: string;
      sport: string | null;
      users: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
    };
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    const name = `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() || "Coach";
    return {
      id: r.coach_id,
      name,
      sport: r.sport || "—",
      athleteCount: counts.get(r.coach_id) ?? 0,
    };
  });

  // Sort coaches alphabetically for a stable dropdown.
  coaches.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  // Virtual "Non assigné" pool always first.
  coaches.unshift({
    id: UNASSIGNED_COACH_ID,
    name: "Non assigné",
    sport: "—",
    athleteCount: counts.get(null) ?? 0,
  });

  return coaches;
}

/**
 * Active athletes owned by a given coach at a school. Pass
 * UNASSIGNED_COACH_ID to load the unclaimed (coach_id IS NULL) pool.
 */
export async function loadAthletesForCoach(
  supabase: SupabaseClient,
  schoolId: string,
  coachId: string,
): Promise<TransferAthlete[]> {
  let query = supabase
    .from("athletes")
    .select(
      "id, first_name, last_name, photo_url, sports!sport_id(nom), positions!position_id(abreviation)",
    )
    .eq("school_id", schoolId)
    .eq("status", "ACTIF");

  if (coachId === UNASSIGNED_COACH_ID) query = query.is("coach_id", null);
  else query = query.eq("coach_id", coachId);

  const { data } = await query;

  return (data ?? []).map((a) => {
    const row = a as {
      id: string;
      first_name: string;
      last_name: string;
      photo_url: string | null;
      sports: { nom?: string } | { nom?: string }[] | null;
      positions: { abreviation?: string } | { abreviation?: string }[] | null;
    };
    const sport = Array.isArray(row.sports) ? row.sports[0] : row.sports;
    const pos = Array.isArray(row.positions) ? row.positions[0] : row.positions;
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      photo: row.photo_url,
      sport: sport?.nom ?? null,
      position: pos?.abreviation ?? null,
    };
  });
}
