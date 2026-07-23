/* ═══════════════════════════════════════════════════════════════
   loadSchoolStaff — same-school staff the caller (a coach/director)
   may open a COACH_COACH thread with. Mirrors is_same_school_staff()
   (migration 20260723120100) so the picker never offers a target the
   RLS INSERT would reject :
     school_coaches WHERE school_id ∈ my schools
       AND role IN (COACH, DIRECTEUR, DIRECTEUR_INTERIM)   -- excl. PENDING
     minus self, deduped by coach_id (director role wins the label).

   Directors are NOT a separate type — a director is a coach whose
   school_coaches.role is DIRECTEUR/DIRECTEUR_INTERIM. `isDirector`
   drives the "Directeur" tile filter + label only.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface StaffMember {
  id: string;
  name: string;
  photoUrl: string | null;
  roleLabel: "Directeur" | "Entraîneur";
  isDirector: boolean;
  /** Context line — sport(s) + team(s) they coach (from team_coaches).
   *  null for directors (role only) and coaches with no team. */
  context: string | null;
}

const DIRECTOR_ROLES = ["DIRECTEUR", "DIRECTEUR_INTERIM"];
const ACTIVE_ROLES = ["COACH", "DIRECTEUR", "DIRECTEUR_INTERIM"];

export async function loadSchoolStaff(
  supabase: SupabaseClient,
  selfId: string,
): Promise<StaffMember[]> {
  // 1. My school(s) via school_coaches (RLS "coach_read_own").
  const { data: mine } = await supabase
    .from("school_coaches")
    .select("school_id")
    .eq("coach_id", selfId);
  const schoolIds = [...new Set((mine ?? []).map((r) => (r as { school_id: string }).school_id).filter(Boolean))];
  if (schoolIds.length === 0) return [];

  // 2. All staff at those schools (RLS "coaches read school roster").
  const { data: rows } = await supabase
    .from("school_coaches")
    .select("coach_id, role")
    .in("school_id", schoolIds);

  // Dedup by coach_id, keep the strongest role (director beats coach), drop self + PENDING.
  const roleMap = new Map<string, string>();
  for (const r of (rows ?? []) as { coach_id: string; role: string }[]) {
    if (r.coach_id === selfId || !ACTIVE_ROLES.includes(r.role)) continue;
    const cur = roleMap.get(r.coach_id);
    if (!cur || DIRECTOR_ROLES.includes(r.role)) roleMap.set(r.coach_id, r.role);
  }
  const ids = [...roleMap.keys()];
  if (ids.length === 0) return [];

  // 3. Resolve names/photos (RLS "authenticated read coaches").
  const { data: users } = await supabase
    .from("users")
    .select("id, first_name, last_name, photo_url, avatar_url")
    .in("id", ids);

  // 3b. Sport(s) + team(s) each coaches — team_coaches is school-scoped
  //     readable ("team_coaches scoped select"), so peers' teams are visible.
  const { data: tcRows } = await supabase
    .from("team_coaches")
    .select("coach_id, teams!team_id(name, is_active, sports!sport_id(nom))")
    .in("coach_id", ids);
  const teamMap = new Map<string, { sports: Set<string>; teams: string[] }>();
  for (const tc of (tcRows ?? []) as { coach_id: string; teams: unknown }[]) {
    const team = (Array.isArray(tc.teams) ? tc.teams[0] : tc.teams) as
      { name?: string; is_active?: boolean; sports?: unknown } | null;
    if (!team || team.is_active === false) continue;
    const sport = (Array.isArray(team.sports) ? team.sports[0] : team.sports) as { nom?: string } | null;
    const entry = teamMap.get(tc.coach_id) ?? { sports: new Set<string>(), teams: [] };
    if (sport?.nom) entry.sports.add(sport.nom);
    if (team.name) entry.teams.push(team.name);
    teamMap.set(tc.coach_id, entry);
  }

  // "Football · Titans M18, Cadets M15 (+1)" — sports, then up to 2 team names.
  function buildContext(coachId: string): string | null {
    const e = teamMap.get(coachId);
    if (!e || e.teams.length === 0) return null;
    const sports = [...e.sports].join(", ");
    const head = e.teams.slice(0, 2).join(", ");
    const extra = e.teams.length > 2 ? ` (+${e.teams.length - 2})` : "";
    const teams = `${head}${extra}`;
    return sports ? `${sports} · ${teams}` : teams;
  }

  const staff: StaffMember[] = (users ?? []).map((u) => {
    const uu = u as { id: string; first_name?: string; last_name?: string; photo_url?: string; avatar_url?: string };
    const isDirector = DIRECTOR_ROLES.includes(roleMap.get(uu.id) || "");
    const name = `${uu.first_name ?? ""} ${uu.last_name ?? ""}`.trim();
    return {
      id: uu.id,
      name: name || "Membre du personnel",
      photoUrl: uu.photo_url ?? uu.avatar_url ?? null,
      roleLabel: isDirector ? "Directeur" : "Entraîneur",
      isDirector,
      // Directors keep role only; coaches get their sport(s) + team(s).
      context: isDirector ? null : buildContext(uu.id),
    };
  });

  // Directors first, then alphabetical.
  staff.sort((a, b) => {
    if (a.isDirector !== b.isDirector) return a.isDirector ? -1 : 1;
    return a.name.localeCompare(b.name, "fr");
  });
  return staff;
}
