/* ═══════════════════════════════════════════════════════════════
   useAthleteContactable — la période de restriction RSEQ, côté client.

   UI DORMANTE. `public.is_athlete_contactable(p_athlete)` est aujourd'hui
   un STUB qui rend `true` : rien ne se bloque encore. Le jour où la règle
   entre en vigueur, le serveur change la fonction et l'interface suit,
   sans redéploiement d'app — c'est tout l'intérêt de la câbler maintenant,
   pendant qu'un binaire mobile est en préparation.

   AUCUNE LOGIQUE DE DATES ICI, et ce n'est pas une simplification : une
   période de restriction est une règle de LIGUE, versionnée, qui varie par
   sport et par saison. Un client mobile figé dans un binaire ne peut pas la
   porter — il aurait toujours un exemplaire périmé. Le client affiche ce que
   le serveur répond, point.

   REPLI VERS `true` EN CAS D'ÉCHEC. Délibéré : la règle est
   RÉGLEMENTAIRE, pas sécuritaire. Rien de confidentiel ne fuit si un
   recruteur voit un bouton actif à tort — au pire il envoie un message que
   le serveur refusera au moment du send. À l'inverse, bloquer sur une
   coupure réseau punirait l'utilisateur pour un incident qui ne le regarde
   pas. Un verrou de sécurité se fermerait dans l'autre sens ; celui-ci non.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useAthleteContactable(athleteId: string | null | undefined) {
  const q = useQuery<boolean>({
    queryKey: ["athlete-contactable", athleteId],
    enabled: !!athleteId,
    // La réponse ne bouge qu'au rythme d'une décision de ligue : inutile de
    // la redemander à chaque montage.
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_athlete_contactable", {
        p_athlete: athleteId as string,
      });
      if (error) {
        // Bruyant en console, permissif à l'écran — voir le repli ci-dessus.
        console.warn("[is_athlete_contactable] échec, on laisse le contact ouvert", error);
        return true;
      }
      return data !== false;
    },
  });

  /* Pendant le chargement ET en cas d'erreur : contactable. Le bouton ne
     clignote donc jamais de « bloqué » vers « actif » — il ne se ferme que
     sur une réponse serveur explicitement négative. */
  return { contactable: q.data !== false, loading: q.isLoading };
}

/** Message unique, partagé web et mobile.
 *
 *  GÉNÉRIQUE VOLONTAIREMENT : ni sport, ni dates, ni portée. La RPC ne rend
 *  aujourd'hui qu'un booléen — elle ne dit pas POURQUOI. Nommer le sport ici
 *  serait une déduction du client, donc un risque d'affirmer faux le jour où
 *  une restriction porte sur une promotion ou une région plutôt que sur un
 *  sport.
 *
 *  La table à venir portera un `libelle` : c'est LUI qu'on affichera quand il
 *  existera, à la place de cette constante. D'ici là, dire moins et dire vrai. */
export const BLACKOUT_MESSAGE =
  "Contact indisponible — période de restriction RSEQ en vigueur.";
