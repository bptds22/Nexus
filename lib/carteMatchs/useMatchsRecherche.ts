/* ═══════════════════════════════════════════════════════════════
   useMatchsRecherche — la carte des matchs, lot B (BP 2026-10-07).

   · useMatchsRecherche : la RPC matchs_recherche (tous les matchs d'une
     plage de 7 jours au plus, filtrés par sport, type et texte). La page ne
     l'appelle pas tant que la plage est invalide.
   · useBasculerCalendrier : « + » ajoute le match au calendrier PARTAGÉ de
     l'unité (matchs_ajoutes) ; « ✓ » le retire. Le client n'envoie que
     game_id : l'unité et l'auteur sont posés par la base.
   · useSportsCarte : la liste des sports (filtre « Sport »).

   Partageable avec le mobile.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MatchRecherche, TypeMatch } from "@/lib/carteMatchs/carteMatchs";

export interface CriteresRecherche {
  debut: string;
  fin: string;
  sport: string;
  types: TypeMatch[];
  texte: string;
}

const CLE = ["carte-matchs", "recherche"] as const;

export function useMatchsRecherche(c: CriteresRecherche, enabled: boolean) {
  const types = [...c.types].sort();
  const texte = c.texte.trim();
  return useQuery<MatchRecherche[]>({
    queryKey: [...CLE, c.debut, c.fin, c.sport, types.join(","), texte],
    enabled: enabled && types.length > 0,
    staleTime: 60_000,
    placeholderData: (avant) => avant,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("matchs_recherche", {
        p_debut: c.debut,
        p_fin: c.fin,
        p_sport: c.sport || null,
        p_types: types,
        p_texte: texte || null,
      });
      if (error) throw error;
      return ((data ?? []) as MatchRecherche[]).map((m) => ({
        ...m,
        lat: m.lat === null ? null : Number(m.lat),
        lon: m.lon === null ? null : Number(m.lon),
      }));
    },
  });
}

/** + / ✓ : ajoute ou retire un match du calendrier de l'unité. Rafraîchit la
 *  recherche ET le Calendrier (le match y apparaît ou en sort). */
export function useBasculerCalendrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gameId, ajouter }: { gameId: string; ajouter: boolean }) => {
      const supabase = createClient();
      if (ajouter) {
        const { error } = await supabase.from("matchs_ajoutes").insert({ game_id: gameId });
        // Déjà ajouté (par un collègue, ou double clic) : l'état voulu est atteint.
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase.from("matchs_ajoutes").delete().eq("game_id", gameId);
        if (error) throw error;
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: CLE });
      void qc.invalidateQueries({ queryKey: ["recruiting-calendar", "unite"] });
    },
  });
}

export function useSportsCarte(enabled: boolean) {
  return useQuery<string[]>({
    queryKey: ["carte-matchs", "sports"],
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await createClient().from("sports").select("nom").order("nom");
      if (error) throw error;
      return ((data ?? []) as { nom: string }[]).map((s) => s.nom).filter((n) => n && n !== "Autre");
    },
  });
}
