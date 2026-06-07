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
      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as SchoolListItem[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
