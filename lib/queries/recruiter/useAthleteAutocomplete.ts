/* ═══════════════════════════════════════════════════════════════
   useAthleteAutocomplete — TanStack hook (iter 6.0a)
   Suggestions légères pendant la frappe (8-10 matches). Payload
   minimal pour rapidité. enabled si query.length >= 2.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AutocompleteAthlete {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  jersey: string | null;
  sport: string | null;
  position: string | null;
  school: string | null;
}

export function useAthleteAutocomplete(query: string) {
  const trimmed = query.trim();
  return useQuery<AutocompleteAthlete[]>({
    queryKey: ["athleteAutocomplete", trimmed.toLowerCase()],
    queryFn: async () => {
      if (trimmed.length < 2) return [];
      const supabase = createClient();
      const q = trimmed.replace(/[%,]/g, "");
      const { data, error } = await supabase
        .from("athletes")
        .select(`
          id, first_name, last_name, photo_url, numero_jersey,
          sports!sport_id(nom),
          positions!position_id(abreviation),
          schools!school_id(name)
        `)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .eq("status", "ACTIF")
        .limit(10);
      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((a) => {
        const sportRel = a.sports; const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
        const posRel = a.positions; const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
        const schoolRel = a.schools; const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string } | null;
        return {
          id: a.id as string,
          firstName: (a.first_name as string) ?? "",
          lastName: (a.last_name as string) ?? "",
          photoUrl: (a.photo_url as string) ?? null,
          jersey: (a.numero_jersey as string) ?? null,
          sport: sport?.nom ?? null,
          position: pos?.abreviation ?? null,
          school: school?.name ?? null,
        };
      });
    },
    enabled: trimmed.length >= 2,
    staleTime: 60 * 1000,
  });
}
