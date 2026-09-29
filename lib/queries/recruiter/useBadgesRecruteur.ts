/* ═══════════════════════════════════════════════════════════════
   useBadgesRecruteur — les pastilles Messages et Activités de la barre
   latérale recruteur (web).

   Avant (bug du 2026-09-28) : un useEffect au montage, sans dépendance —
   chargées UNE fois, jamais relues. Lire un message ou ouvrir Activités ne
   les faisait pas bouger avant un rechargement complet.

   Maintenant elles se relisent :
   - quand un geste les change (événement `notifications-updated`, émis par
     le fil de messages et la page Activités — signalerCompteursAJour) ;
   - au retour sur l'onglet (refetchOnWindowFocus) ;
   - au plus tard toutes les minutes (refetchInterval).
   La clé ["badges-recruteur"] n'est JAMAIS persistée (QueryProvider) : un
   compteur réhydraté de sessionStorage serait faux dès le rechargement.

   Messages : la règle unique de lib/messaging/nonLusRecruteur.ts.
   Activités : recruiter_activity_log non lues de l'utilisateur (is_read =
   false) — inchangé ; la page Activités les marque lues à l'ouverture.
   Rapprochements (lot D) : propositions carte ↔ profil OUVERTES de l'unité
   (rapprochements_unite, Pro seulement). Une erreur — fonction absente
   parce que le web précède la migration, compte gratuit — vaut 0 et ne
   casse jamais les deux autres pastilles.
═══════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { compterNonLusRecruteur, EVENEMENT_COMPTEURS } from "@/lib/messaging/nonLusRecruteur";

export interface BadgesRecruteur {
  messages: number;
  activites: number;
  rapprochements: number;
}

export const CLE_BADGES_RECRUTEUR = "badges-recruteur";

export function useBadgesRecruteur() {
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  const queryClient = useQueryClient();

  useEffect(() => {
    const relire = () => { void queryClient.invalidateQueries({ queryKey: [CLE_BADGES_RECRUTEUR] }); };
    window.addEventListener(EVENEMENT_COMPTEURS, relire);
    return () => window.removeEventListener(EVENEMENT_COMPTEURS, relire);
  }, [queryClient]);

  return useQuery<BadgesRecruteur>({
    queryKey: [CLE_BADGES_RECRUTEUR, moi],
    enabled: !!moi,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const [messages, activitesRes, rapprochementsRes] = await Promise.all([
        compterNonLusRecruteur(supabase, moi!),
        supabase
          .from("recruiter_activity_log")
          .select("id", { count: "exact", head: true })
          .eq("recruiter_id", moi!)
          .eq("is_read", false),
        supabase.rpc("rapprochements_unite"),
      ]);
      if (activitesRes.error) throw activitesRes.error;
      const rapprochements = rapprochementsRes.error ? 0 : ((rapprochementsRes.data ?? []) as unknown[]).length;
      return { messages, activites: activitesRes.count ?? 0, rapprochements };
    },
  });
}
