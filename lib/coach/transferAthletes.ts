import type { SupabaseClient } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════════════════════
   transferAthletes — shared logic for GESTION DES ATHLÈTES.

   Moves athletes.coach_id ownership between coaches at the SAME
   school (or to/from the "Non assigné" pool where coach_id IS NULL).
   Does NOT touch team_athletes — this is ownership only.

   Security boundary is RLS. DEUX voies, pas une :
     · "coaches reassign athletes within school" — école de l'appelant,
       destination contrainte à un coach de cette école (ou NULL). Son
       USING porte `school_id IS NOT NULL` : elle ne couvre AUCUN civil.
     · "Coaches update own team athletes" — `coach_can_manage_athlete()`,
       purement ÉQUIPE. C'est la seule voie qui couvre un athlète civil
       (school_id NULL), et le périmètre de lecture ci-dessous s'aligne
       strictement dessus. ⚠ Son WITH CHECK ne valide PAS le coach de
       DESTINATION : par cette voie on peut transférer vers un coach hors
       de l'école. Dette connue, pas introduite ici.
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
  /** #EN_ATTENTE : athlète en attente de consentement → liseré « En attente ». */
  isPending?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   PÉRIMÈTRE CIVIL (school_id IS NULL) — pourquoi il existe et où il s'arrête.

   Le filtre `.eq("school_id", …)` des deux requêtes ci-dessous écarte en
   silence tout athlète à school_id NULL (`NULL = x` → UNKNOWN). Les athlètes
   de ligue civile — ancrés par coach_id / équipe, sans école — étaient donc
   invisibles ET dans le compte du dropdown ET dans la liste source.

   La borne retenue n'est PAS « tous les civils du club » : c'est un
   ALIGNEMENT STRICT sur le prédicat RLS réel, `coach_can_manage_athlete()` :

     EXISTS (team_coaches tc JOIN team_athletes ta USING (team_id)
             WHERE tc.coach_id = auth.uid() AND ta.athlete_id = <id>)
     OR  <je suis DIRECTEUR de l'école de l'athlète>   ← inatteignable ici :
         `sc.school_id = NULL` ne matche jamais, un civil n'a pas d'école.

   Reste donc la seule voie ÉQUIPE. Afficher plus large (p. ex. « civil dont
   le propriétaire est un coach du club ») listerait des athlètes que la RLS
   refuse de déplacer : la policy nommée `coaches reassign athletes within
   school` porte `school_id IS NOT NULL` dans son USING, et
   `coaches can update own athletes` a un WITH CHECK qui exige
   `coach_id = auth.uid()` — donc il échoue précisément au moment du
   transfert. Vérifié en cloud le 2026-09-08 : 1 athlète du club tombait dans
   ce trou. On ne liste pas ce qu'on ne peut pas déplacer.

   EXCLUSION DÉLIBÉRÉE — le pool « Non assigné » CIVIL (school_id NULL ET
   coach_id NULL, 10 lignes en prod au 2026-09-08) reste EXCLU, et ce n'est
   plus une question ouverte : décision BP du 2026-09-08, ce pool est la
   SALLE D'ATTENTE DE RÉCLAMATION, pas un marché d'agents libres. On n'y
   entre donc pas par le dropdown de transfert. La réclamation a son propre
   flow coach (« chercher / réclamer mes athlètes »), qui pose coach_id ET
   l'ancrage club ; le retour au pool a le sien (« Libérer l'athlète », avec
   confirmation) — celui qui remplace l'ex-trigger supprimé en 20260908151616.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ids des athlètes CIVILS (school_id NULL) que le user courant peut gérer,
 * c.-à-d. ceux qui sont sur une équipe dont il est coach. Retombe sur [] à la
 * moindre absence de session ou d'équipe — jamais d'exception.
 */
async function loadMyCivilAthleteIds(supabase: SupabaseClient): Promise<string[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return [];

  const { data: tcRows } = await supabase
    .from("team_coaches").select("team_id").eq("coach_id", uid);
  const teamIds = [...new Set((tcRows ?? []).map((r) => (r as { team_id: string }).team_id))];
  if (teamIds.length === 0) return [];

  const { data: taRows } = await supabase
    .from("team_athletes").select("athlete_id").in("team_id", teamIds);
  const athleteIds = [...new Set((taRows ?? []).map((r) => (r as { athlete_id: string }).athlete_id))];
  if (athleteIds.length === 0) return [];

  // `.is("school_id", null)` — le SEUL prédicat qui attrape un NULL en SQL.
  const { data: civilRows } = await supabase
    .from("athletes").select("id")
    .in("id", athleteIds)
    .is("school_id", null)
    .in("status", ["ACTIF", "EN_ATTENTE"]);
  return (civilRows ?? []).map((r) => (r as { id: string }).id);
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
  const [{ data: scRows }, { data: athRows }, civilIds] = await Promise.all([
    supabase
      .from("school_coaches")
      .select("coach_id, sport, users!coach_id(first_name, last_name)")
      .eq("school_id", schoolId),
    supabase
      .from("athletes")
      .select("coach_id")
      .eq("school_id", schoolId)
      // #EN_ATTENTE : un athlète en attente de consentement reste gérable /
      // transférable (décision BP « EN_ATTENTE dans tous les pickers »). Le
      // compte par coach doit matcher la liste source, donc même filtre.
      .in("status", ["ACTIF", "EN_ATTENTE"]),
    loadMyCivilAthleteIds(supabase),
  ]);

  // Volet CIVIL du périmètre (cf. le bloc PÉRIMÈTRE CIVIL plus haut). MÊME
  // spec que loadAthletesForCoach ci-dessous — si les deux divergent, le
  // compte du dropdown ne correspond plus à la liste affichée.
  const { data: civilRows } = civilIds.length
    ? await supabase
        .from("athletes")
        .select("coach_id")
        .in("id", civilIds)
        .in("status", ["ACTIF", "EN_ATTENTE"])
    : { data: [] as { coach_id: string | null }[] };

  // coach_id (or null) → athlete count (ACTIF + EN_ATTENTE)
  const counts = new Map<string | null, number>();
  (athRows ?? []).forEach((a) => {
    const cid = (a as { coach_id: string | null }).coach_id;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
  });
  // Les civils sans propriétaire ne rejoignent PAS le pool « Non assigné » —
  // dette assumée, cf. le bloc PÉRIMÈTRE CIVIL.
  (civilRows ?? []).forEach((a) => {
    const cid = (a as { coach_id: string | null }).coach_id;
    if (cid == null) return;
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
  const COLS =
    "id, first_name, last_name, photo_url, status, sports!sport_id(nom), positions!position_id(abreviation)";

  let query = supabase
    .from("athletes")
    .select(COLS)
    .eq("school_id", schoolId)
    // #EN_ATTENTE inclus (badgé) — la règle d'action (RLS d'update) reste
    // owner/team/directeur ; seul le statut s'élargit, comme les autres pickers.
    .in("status", ["ACTIF", "EN_ATTENTE"]);

  if (coachId === UNASSIGNED_COACH_ID) query = query.is("coach_id", null);
  else query = query.eq("coach_id", coachId);

  // Volet CIVIL — MÊME spec que le compte de loadSchoolCoaches ci-dessus
  // (cf. le bloc PÉRIMÈTRE CIVIL). Le pool « Non assigné » n'en reçoit rien :
  // sur ce sentinel on ne va même pas chercher les civils.
  const civilIds = coachId === UNASSIGNED_COACH_ID ? [] : await loadMyCivilAthleteIds(supabase);
  const [{ data }, { data: civilData }] = await Promise.all([
    query,
    civilIds.length
      ? supabase
          .from("athletes")
          .select(COLS)
          .in("id", civilIds)
          .eq("coach_id", coachId)
          .in("status", ["ACTIF", "EN_ATTENTE"])
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  // Disjoints par construction (school_id = schoolId vs school_id IS NULL),
  // mais on déduplique quand même : une liste à doublons est un bug muet.
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of [...(data ?? []), ...(civilData ?? [])] as Record<string, unknown>[]) {
    byId.set(r.id as string, r);
  }

  return Array.from(byId.values()).map((a) => {
    const row = a as {
      id: string;
      first_name: string;
      last_name: string;
      photo_url: string | null;
      status: string | null;
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
      isPending: row.status === "EN_ATTENTE",
    };
  });
}
