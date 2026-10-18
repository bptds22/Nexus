/* useRetraits — les raisons de retrait de l'unité (unite_retraits), lues UNE fois et partagées par
   toutes les cartes (React Query). Fonction absente (prod sans la migration) → aucune raison, sans erreur. */
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { cleRetrait, fonctionAbsente, versRetraits, type Retrait } from "@/lib/retraits/retraits";

export const CLE_RETRAITS = ["retraits-unite"] as const;

export function useRetraits() {
  return useQuery({
    queryKey: CLE_RETRAITS,
    queryFn: async (): Promise<Map<string, Retrait>> => {
      const { data, error } = await createClient().rpc("unite_retraits");
      if (error) {
        if (!fonctionAbsente(error)) console.error(`[retraits] lecture : ${error.code ?? ""} ${error.message}`);
        return new Map();
      }
      return versRetraits(data as Record<string, unknown>[]);
    },
    staleTime: 30_000,
  });
}

/** La raison d'un dossier (athlète ou carte), ou null. */
export function useRetrait(id: string | null | undefined, carte: boolean): Retrait | null {
  const { data } = useRetraits();
  return id ? data?.get(cleRetrait(id, carte)) ?? null : null;
}

export function invaliderRetraits(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: CLE_RETRAITS });
}
