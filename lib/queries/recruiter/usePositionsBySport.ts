/* ═══════════════════════════════════════════════════════════════
   usePositionsBySport — TanStack hook (iter 5.3b)
   Retourne le sportId + les positions dynamiques quand un sport
   est sélectionné dans le dropdown Recherche.
   Données quasi-statiques → staleTime infini.

   Format des positions : { abbr, label } pour matcher exactement le
   format attendu par la page Recherche (line 621-624 du legacy).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface PositionOption {
  abbr: string;
  label: string;
}

export interface PositionsBySportResult {
  sportId: string | null;
  positions: PositionOption[];
}

const EMPTY: PositionsBySportResult = { sportId: null, positions: [] };

export function usePositionsBySport(sportName: string | null) {
  return useQuery<PositionsBySportResult>({
    queryKey: ["positionsBySport", sportName],
    queryFn: async (): Promise<PositionsBySportResult> => {
      if (!sportName) return EMPTY;
      const supabase = createClient();

      const { data: sportRow } = await supabase
        .from("sports")
        .select("id")
        .ilike("nom", sportName.replace(/_/g, " "))
        .single();
      if (!sportRow) return EMPTY;

      const { data: posRows } = await supabase
        .from("positions")
        .select("nom, abreviation")
        .eq("sport_id", sportRow.id as string)
        .order("nom");

      return {
        sportId: sportRow.id as string,
        positions: (posRows ?? []).map((p: { nom: string; abreviation: string }) => ({
          abbr: p.abreviation,
          label: p.nom,
        })),
      };
    },
    enabled: !!sportName,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
