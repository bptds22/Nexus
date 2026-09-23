"use client";

/* ═══════════════════════════════════════════════════════════════
   useCiblesSurMonCegep — quels athlètes ont ciblé MON cégep.

   Source unique de la tuile « Te ciblent » du tableau de bord (le bloc
   détaillé du lot 2 a été retiré le 2026-09-23), de la pastille
   « Te cible » de la fiche athlète (lot 3) et du filtre « Te ciblent » de
   la recherche (lot 5, qui a retiré la pastille des cartes). Un seul appel
   réseau, un seul cache TanStack : les surfaces lisent la même vérité au
   même instant — le compte du filtre ne peut pas contredire celui de la tuile.

   CE QUE LA RPC REND, ET CE QU'ELLE NE REND PAS.
   `athletes_targeting_my_cegep()` (migration 20260922171500) ne projette
   QUE `athlete_id` et la date. Aucune identité n'y transite — c'est
   voulu : le masquage Loi 25 reste entier chez `recruiter_athlete_cards`,
   qui seule applique `athlete_identity_ok()`. Conséquence pratique pour
   tout appelant : **ne jamais afficher un nom depuis ce hook**, il n'en
   a pas. On croise ses ids avec des cartes déjà hydratées.

   POURQUOI `enabled` DÉPEND DE school_id.
   Sans cégep rattaché la RPC rend zéro ligne (elle ne lève pas, par
   conception). Mais un zéro ne distingue pas « aucun cégep » de « aucune
   cible » : c'est à l'UI de trancher, et elle le fait en relisant
   `users.school_id`. On coupe donc la requête en amont — un appel qui ne
   peut rien rendre n'a pas à partir. `aUnCegepRattache` est exporté pour
   que les surfaces MASQUENT leur bloc plutôt que d'afficher un vide
   trompeur (même règle que la garde `monCegepAUnCatalogue` du filtre
   « Programme offert chez nous »).
═══════════════════════════════════════════════════════════════ */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface CibleSurMonCegep {
  athleteId: string;
  /** ISO — `athlete_targets.created_at`, la date du ciblage. */
  targetedAt: string;
}

interface RpcRow {
  athlete_id: string;
  targeted_at: string;
}

/**
 * @param actif  Faux coupe la requête. Sert aux surfaces PARTAGÉES qui ne sont
 *   pas toujours regardées par un recruteur — la fiche athlète est aussi vue
 *   en mode « preview » (l'athlète qui se relit) et « partner ». Là, la RPC
 *   rendrait zéro (garde `role = 'RECRUTEUR'`), mais autant ne pas partir :
 *   un athlète qui se relit porte un `school_id` d'école secondaire, donc la
 *   garde `aUnCegepRattache` ne suffirait pas à l'arrêter.
 */
export function useCiblesSurMonCegep(actif = true) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const aUnCegepRattache = !!currentUser?.profile.school_id;

  const query = useQuery<CibleSurMonCegep[]>({
    queryKey: ["recruteur", "cibles-mon-cegep", userId],
    enabled: actif && !!userId && aUnCegepRattache,
    // 1 min, comme useActivityFeed : un ciblage n'est pas une urgence à la
    // seconde, et la page se remonte souvent.
    staleTime: 60_000,
    queryFn: async (): Promise<CibleSurMonCegep[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("athletes_targeting_my_cegep");
      if (error) throw error;
      // La RPC trie déjà `created_at desc` — on ne retrie pas côté client,
      // sinon deux surfaces pourraient diverger sur les ex æquo.
      return ((data as RpcRow[] | null) ?? []).map((r) => ({
        athleteId: r.athlete_id,
        targetedAt: r.targeted_at,
      }));
    },
  });

  return { ...query, aUnCegepRattache };
}

/**
 * Index athleteId → date de ciblage, pour les surfaces qui testent
 * l'appartenance d'un athlète (fiche athlète). Une Map plutôt qu'un
 * `.find()` dans le rendu.
 *
 * Rend une Map VIDE tant que la requête n'a pas répondu, ou si le compte
 * n'a pas de cégep. Une pastille absente est le bon défaut : on n'affirme
 * « te cible » que sur une donnée reçue, jamais par optimisme.
 */
export function useCiblesParAthleteId(actif = true): Map<string, string> {
  const { data } = useCiblesSurMonCegep(actif);
  return React.useMemo(
    () => new Map((data ?? []).map((c) => [c.athleteId, c.targetedAt])),
    [data],
  );
}
