/* ═══════════════════════════════════════════════════════════════
   useRecruiterLists — TanStack hook (iter 7.15 Sprint 1)
   Charge les listes du recruteur courant + count membres + sport
   dominant en UN seul round-trip via embed PostgREST. Calculs
   d'agrégation faits client-side (count, sport dominant).
   queryKey ["recruiter-lists", userId], staleTime 30s.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface RecruiterListSummary {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
  athleteCount: number;
  /** Nom du sport le plus représenté dans la liste (null si vide ou aucun sport). */
  dominantSport: string | null;
}

interface ListRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  recruiter_list_members: Array<{
    athlete_id: string | null;
    athletes:
      | { sports: { nom: string | null } | { nom: string | null }[] | null }
      | { sports: { nom: string | null } | { nom: string | null }[] | null }[]
      | null;
  }> | null;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function computeDominantSport(members: ListRow["recruiter_list_members"]): string | null {
  if (!members || members.length === 0) return null;
  const counts = new Map<string, number>();
  members.forEach((m) => {
    const athlete = pickOne(m.athletes);
    if (!athlete) return;
    const sport = pickOne(athlete.sports);
    const nom = sport?.nom;
    if (!nom) return;
    counts.set(nom, (counts.get(nom) ?? 0) + 1);
  });
  if (counts.size === 0) return null;
  let topSport: string | null = null;
  let topCount = 0;
  counts.forEach((count, nom) => {
    if (count > topCount) {
      topCount = count;
      topSport = nom;
    }
  });
  return topSport;
}

export function useRecruiterLists() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<RecruiterListSummary[]>({
    queryKey: ["recruiter-lists", userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recruiter_lists")
        .select(`
          id, name, description, color, created_at, updated_at,
          recruiter_list_members(
            athlete_id,
            athletes(sports!sport_id(nom))
          )
        `)
        .eq("recruiter_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = (data as ListRow[] | null) ?? [];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        color: r.color || "#E63946",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        athleteCount: r.recruiter_list_members?.length ?? 0,
        dominantSport: computeDominantSport(r.recruiter_list_members),
      }));
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}
