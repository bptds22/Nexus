/* ═══════════════════════════════════════════════════════════════
   useOrigineCarte — ce que la carte des matchs lit du recruteur : les
   coordonnées de SON cégep (schools.lat / lng — point de départ des
   distances, décision BP 2026-10-07) et le NOM du sport de son unité
   (sport par défaut, comparé à games.sport). Partageable avec le mobile.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface OrigineCarte {
  cegepNom: string | null;
  /** null quand le cégep n'a pas de coordonnées : pas de distance affichée. */
  cegepLat: number | null;
  cegepLon: number | null;
  sportUnite: string | null;
}

const nombre = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : v === null || v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function useOrigineCarte(enabled: boolean) {
  const { data: currentUser } = useCurrentUser();
  const schoolId = currentUser?.profile?.school_id ?? null;
  const sportId = currentUser?.profile?.sport_id ?? null;
  return useQuery<OrigineCarte>({
    queryKey: ["carte-matchs", "origine", schoolId, sportId],
    enabled: enabled && !!currentUser,
    staleTime: Infinity,
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: ecole }, { data: sport }] = await Promise.all([
        schoolId ? supabase.from("schools").select("name, lat, lng").eq("id", schoolId).maybeSingle() : Promise.resolve({ data: null }),
        sportId ? supabase.from("sports").select("nom").eq("id", sportId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return {
        cegepNom: (ecole?.name as string | undefined) ?? null,
        cegepLat: nombre(ecole?.lat),
        cegepLon: nombre(ecole?.lng),
        sportUnite: (sport?.nom as string | undefined) ?? null,
      };
    },
  });
}
