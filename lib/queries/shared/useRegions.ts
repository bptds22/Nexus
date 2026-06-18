/* ═══════════════════════════════════════════════════════════════
   useRegions — TanStack hook (iter 5.2)
   Liste des régions distinctes (depuis schools.region) pour les
   dropdowns de filtres. Données quasi-statiques → staleTime 1h.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useRegions() {
  return useQuery<string[]>({
    queryKey: ["regions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("schools")
        .select("region");
      if (error) throw error;
      return Array.from(
        new Set(((data ?? []) as { region: string }[]).map((s) => s.region).filter(Boolean)),
      ).sort();
    },
    staleTime: 60 * 60 * 1000,
    gcTime: Infinity,
  });
}
