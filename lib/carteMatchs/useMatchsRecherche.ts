/* ═══════════════════════════════════════════════════════════════
   useMatchsRecherche — la carte des matchs, lot B (BP 2026-10-07).

   · useMatchsRecherche : la RPC matchs_recherche (tous les matchs d'une
     plage de 31 jours au plus, filtrés par sport, type et texte), appelée
     par fenêtres de 7 jours (plafond PostgREST). La page ne l'appelle pas
     tant que la plage est invalide.
   · useBasculerCalendrier : « + » ajoute le match au calendrier PARTAGÉ de
     l'unité (matchs_ajoutes) ; « ✓ » le retire. Le client n'envoie que
     game_id : l'unité et l'auteur sont posés par la base.
   · useSourcesMatchs : la source de chaque match, dérivée comme au
     Calendrier (sourceDuMatch), lue dans `games` par paquets d'ids.
   · useSportsCarte : la liste des sports (filtre « Sport »).

   Partageable avec le mobile.
═══════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  COLONNES_SOURCE, JOURS_SAISON, PLAFOND_LIGNES, fenetres, jourDecale, moities, paquets, sourcesParMatch, suggestionsLisibles,
  type PastilleCarte,
  type LigneSource, type MatchRecherche, type TypeMatch,
} from "@/lib/carteMatchs/carteMatchs";
import type { SourceMatch } from "@/lib/calendar/sourceMatch";

export interface CriteresRecherche {
  debut: string;
  fin: string;
  sport: string;
  types: TypeMatch[];
  texte: string;
  /** Pastilles Équipe / Terrain (ids d'équipe, clés de terrain). Au moins une →
   *  la saison à venir entière, `fin` ignorée. */
  equipes?: string[];
  lieux?: string[];
}

const CLE = ["carte-matchs", "recherche"] as const;

export function useMatchsRecherche(c: CriteresRecherche, enabled: boolean) {
  const types = [...c.types].sort();
  const texte = c.texte.trim();
  const equipes = [...(c.equipes ?? [])].sort();
  const lieux = [...(c.lieux ?? [])].sort();
  const saison = equipes.length + lieux.length > 0;
  return useQuery<MatchRecherche[]>({
    queryKey: [...CLE, c.debut, saison ? "saison" : c.fin, c.sport, types.join(","), texte, equipes.join(","), lieux.join(",")],
    enabled: enabled && types.length > 0,
    staleTime: 60_000,
    placeholderData: (avant) => avant,
    queryFn: async () => {
      const supabase = createClient();
      const appeler = async (debut: string, fin: string): Promise<MatchRecherche[]> => {
        const { data, error } = await supabase.rpc("matchs_recherche", {
          p_debut: debut,
          p_fin: fin,
          p_sport: c.sport || null,
          p_types: types,
          p_texte: texte || null,
          // Seulement s'il y en a : l'appel reste celui d'avant pour la recherche sans pastille.
          ...(equipes.length ? { p_equipes: equipes } : {}),
          ...(lieux.length ? { p_lieux: lieux } : {}),
        });
        if (error) throw error;
        const lignes = (data ?? []) as MatchRecherche[];
        // Réponse au plafond : peut-être coupée. On redemande en deux moitiés.
        if (lignes.length >= PLAFOND_LIGNES && debut !== fin) {
          return (await Promise.all(moities(debut, fin).map(([d, f]) => appeler(d, f)))).flat();
        }
        return lignes;
      };
      // Sans pastille : une fenêtre de 7 jours par appel — sur 31 jours, une seule
      // réponse dépasserait le plafond de PostgREST (1 000 lignes, coupure SILENCIEUSE).
      // Avec pastille : la saison entière d'un coup (une équipe, quelques dizaines de matchs).
      const plages = saison
        ? [[c.debut, jourDecale(new Date(`${c.debut}T12:00:00`), JOURS_SAISON - 1)] as [string, string]]
        : fenetres(c.debut, c.fin, 7);
      const parFenetre = await Promise.all(plages.map(([d, f]) => appeler(d, f)));
      return parFenetre.flat().map((m) => ({
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

/** La source de chaque match affiché (BP 2026-10-09) — les colonnes que le
 *  Calendrier lit déjà dans `games` (lecture ouverte aux authentifiés), sans
 *  toucher la RPC. Lue par paquets ; la clé suit l'ensemble des ids.
 *
 *  Le cache garde les LIGNES, pas la Map : il est persisté en sessionStorage
 *  (JSON), où une Map devient `{}`. Au rechargement, `sources.get` n'existait
 *  plus et la page plantait (« Application error », BP 2026-10-09). La Map est
 *  dérivée au rendu ; la clé « sources-lignes » ignore les `{}` déjà stockés. */
export function useSourcesMatchs(ids: string[], enabled: boolean) {
  const tries = [...ids].sort();
  const requete = useQuery<LigneSource[]>({
    queryKey: ["carte-matchs", "sources-lignes", tries.join(",")],
    enabled: enabled && tries.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: (avant) => avant,
    queryFn: async () => {
      const supabase = createClient();
      const reponses = await Promise.all(paquets(tries, 150).map((p) =>
        supabase.from("games").select(COLONNES_SOURCE).in("id", p)));
      const lignes: LigneSource[] = [];
      for (const r of reponses) {
        if (r.error) throw r.error;
        lignes.push(...((r.data ?? []) as LigneSource[]));
      }
      return lignes;
    },
  });
  const sources: Map<string, SourceMatch> = useMemo(() => sourcesParMatch(requete.data), [requete.data]);
  return { data: sources };
}

/** Suggestions du champ « Équipe, terrain… » (RPC matchs_suggestions) : équipes
 *  et terrains ayant un match à venir, dans le sport et les types choisis — une
 *  suggestion mène toujours à des résultats avec les filtres en place. À partir de 2
 *  caractères. Loi 25 : la RPC ne lit aucune table d'athlètes. */
export function useSuggestionsCarte(texte: string, sport: string, types: TypeMatch[], enabled: boolean) {
  const t = texte.trim();
  const tries = [...types].sort();
  const requete = useQuery<PastilleCarte[]>({
    queryKey: ["carte-matchs", "suggestions", t.toLowerCase(), sport, tries.join(",")],
    enabled: enabled && t.length >= 2,
    staleTime: 60_000,
    placeholderData: (avant) => avant,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("matchs_suggestions", { p_texte: t, p_sport: sport || null, p_types: tries });
      if (error) throw error;
      return (data ?? []) as PastilleCarte[];
    },
  });
  const suggestions = useMemo(() => suggestionsLisibles(requete.data), [requete.data]);
  return { suggestions, isFetching: requete.isFetching, isError: requete.isError, pret: requete.isSuccess };
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
