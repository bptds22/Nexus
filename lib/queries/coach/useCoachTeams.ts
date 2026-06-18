/* ═══════════════════════════════════════════════════════════════
   useCoachTeams — TanStack hook for the coach's team list.

   Mirrors the desktop /coach/equipes loadTeams() shape :
   team_coaches WHERE coach_id=me → teams WHERE id IN (..) AND
   is_active=true, joins sports/team_coaches/team_athletes for
   sport name + coach roles + athlete count. Coach names resolved
   via a secondary users lookup (no FK alias is on team_coaches).

   Also returns rosterCount (athletes whose coach_id=me) — the
   migration prompt banner needs it to differentiate empty-state
   from migrate-state.

   Cache key : ["coach-teams", userId]. Invalidate after createTeam
   / joinTeam / detail mutations that affect the user's team set.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { getCurrentSeason } from "@/lib/utils/season";

export interface CoachTeamRow {
  id: string;
  name: string;
  ageGroup: string;
  division: string;
  league: string;
  season: string;
  sportName: string;
  athleteCount: number;
  coaches: { id: string; name: string; role: string }[];
}

export interface CoachTeamsResult {
  schoolId: string | null;
  /** True when the coach's users.context === 'ligue_civile'. Drives
   *  civil-aware defaults in the create modal (e.g. league empty
   *  instead of "RSEQ" — RSEQ is école-specific). */
  isCivil: boolean;
  rosterCount: number;
  teams: CoachTeamRow[];
}

const EMPTY: CoachTeamsResult = { schoolId: null, isCivil: false, rosterCount: 0, teams: [] };

export function useCoachTeams() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<CoachTeamsResult>({
    queryKey: ["coach-teams", userId],
    queryFn: async () => {
      if (!userId) return EMPTY;
      const supabase = createClient();

      const { data: profile } = await supabase
        .from("users")
        .select("school_id, context")
        .eq("id", userId)
        .single();
      const schoolId = (profile?.school_id as string | null) ?? null;
      const isCivil = (profile?.context as string | null) === "ligue_civile";

      const { data: myRows } = await supabase
        .from("team_coaches")
        .select("team_id")
        .eq("coach_id", userId);
      const myTeamIds = (myRows || []).map((r) => (r as { team_id: string }).team_id);

      const { count } = await supabase
        .from("athletes")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", userId);
      const rosterCount = count || 0;

      if (myTeamIds.length === 0) {
        return { schoolId, isCivil, rosterCount, teams: [] };
      }

      const { data: teamsData } = await supabase
        .from("teams")
        .select(
          "id, name, age_group, division, league, season, sport_id, sports!sport_id(nom), team_coaches(coach_id, role), team_athletes(id)",
        )
        .in("id", myTeamIds)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const rows = (teamsData as unknown as Record<string, unknown>[]) || [];

      // Resolve coach names in one query
      const coachIds = new Set<string>();
      for (const t of rows) {
        for (const tc of (t.team_coaches as { coach_id?: string }[]) || []) {
          if (tc.coach_id) coachIds.add(tc.coach_id);
        }
      }
      const nameMap = new Map<string, string>();
      if (coachIds.size > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .in("id", Array.from(coachIds));
        for (const u of (users || []) as { id: string; first_name?: string; last_name?: string }[]) {
          nameMap.set(u.id, `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Coach");
        }
      }

      const teams: CoachTeamRow[] = rows.map((t) => {
        const sportRel = t.sports as unknown;
        const sport = Array.isArray(sportRel)
          ? (sportRel[0] as { nom?: string } | undefined)
          : (sportRel as { nom?: string } | undefined);
        const tcs = (t.team_coaches as { coach_id: string; role: string }[]) || [];
        return {
          id: t.id as string,
          name: (t.name as string) || "",
          ageGroup: (t.age_group as string | null) || "",
          division: (t.division as string | null) || "",
          league: (t.league as string | null) || "",
          season: (t.season as string | null) || getCurrentSeason(),
          sportName: sport?.nom || "",
          athleteCount: ((t.team_athletes as unknown[]) || []).length,
          coaches: tcs.map((tc) => ({
            id: tc.coach_id,
            name: nameMap.get(tc.coach_id) || "Coach",
            role: tc.role,
          })),
        };
      });

      return { schoolId, isCivil, rosterCount, teams };
    },
    enabled: !!userId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}
