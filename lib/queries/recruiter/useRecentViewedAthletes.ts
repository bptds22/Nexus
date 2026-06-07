/* ═══════════════════════════════════════════════════════════════
   useRecentViewedAthletes — TanStack hook (iter 6.0a)
   N derniers athlètes consultés par le recruteur courant (dédup
   par athlete_id si vues multiples). staleTime 2 min.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface RecentViewedAthlete {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  sport: string | null;
  position: string | null;
  school: string | null;
  viewedAt: string;
}

export function useRecentViewedAthletes(limit = 3) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<RecentViewedAthlete[]>({
    queryKey: ["recentViewedAthletes", userId, limit],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recruiter_athlete_views")
        .select(`
          athlete_id, viewed_at,
          athletes!athlete_id(
            id, first_name, last_name, photo_url,
            sports!sport_id(nom),
            positions!position_id(abreviation),
            schools!school_id(name)
          )
        `)
        .eq("recruiter_id", userId)
        .order("viewed_at", { ascending: false })
        .limit(limit * 3);
      if (error) throw error;

      const seen = new Set<string>();
      const out: RecentViewedAthlete[] = [];
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const aid = row.athlete_id as string;
        if (seen.has(aid)) continue;
        seen.add(aid);
        const aRaw = row.athletes;
        const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as Record<string, unknown> | null;
        if (!a) continue;
        const sportRel = a.sports; const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
        const posRel = a.positions; const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
        const schoolRel = a.schools; const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string } | null;
        out.push({
          id: a.id as string,
          firstName: (a.first_name as string) ?? "",
          lastName: (a.last_name as string) ?? "",
          photoUrl: (a.photo_url as string) ?? null,
          sport: sport?.nom ?? null,
          position: pos?.abreviation ?? null,
          school: school?.name ?? null,
          viewedAt: row.viewed_at as string,
        });
        if (out.length >= limit) break;
      }
      return out;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}
