/* ═══════════════════════════════════════════════════════════════
   useSchoolsList — TanStack hook (iter 5.3a)
   Liste des écoles (id, name) ordonnée alphabétiquement pour les
   dropdowns. Utilisé par Mon Profil + Mon CÉGEP + futures pages
   admin. Données quasi-statiques → staleTime infini.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface SchoolListItem {
  id: string;
  name: string;
}

export function useSchoolsList() {
  return useQuery<SchoolListItem[]>({
    queryKey: ["schools-list"],
    queryFn: async () => {
      const supabase = createClient();
      // Paginate past PostgREST's 1000-row cap (patron 4da34dd) → liste complète.
      const PAGE = 1000;
      const all: SchoolListItem[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("schools")
          .select("id, name")
          .order("name")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as SchoolListItem[]));
        if (data.length < PAGE) break;
      }
      return all;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
