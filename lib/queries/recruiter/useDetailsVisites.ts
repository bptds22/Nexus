/* ═══════════════════════════════════════════════════════════════
   useDetailsVisites — les détails des visites de l'unité (BP 2026-10-18).

   Une seule lecture (visites_details_unite), fusionnée dans le calendrier
   par cleVisite (athlète ou carte prospect). Fonction absente (migration
   20261018120000 pas encore en prod) → disponible = false, aucune erreur
   visible : le calendrier reste comme avant.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import {
  fonctionAbsente, indexerDetails,
  type DetailsVisite, type ParametresEnregistrement,
} from "@/lib/visites/detailsVisite";

export interface DetailsVisitesData {
  disponible: boolean;
  parCle: Map<string, DetailsVisite>;
}

const CLE = "visites-details";

export function useDetailsVisites(enabled: boolean) {
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  return useQuery<DetailsVisitesData>({
    queryKey: [CLE, moi],
    enabled: enabled && !!moi,
    // Partagé par l'unité, comme le calendrier : relu à chaque affichage.
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("visites_details_unite" as never);
      if (error) {
        if (fonctionAbsente(error)) return { disponible: false, parCle: new Map() };
        throw error;
      }
      return { disponible: true, parCle: indexerDetails((data ?? []) as DetailsVisite[]) };
    },
  });
}

export function useEnregistrerDetailsVisite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: ParametresEnregistrement) => {
      const { error } = await createClient().rpc("visite_details_enregistrer" as never, params as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLE] }),
  });
}
