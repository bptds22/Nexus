"use client";

/* ═══════════════════════════════════════════════════════════════
   AuthSync — listener auth racine, additif (levier #1 du diagnostic
   session/free).

   Problème réparé : useCurrentUser repose sur auth.getUser() (réseau)
   avec staleTime: Infinity et AUCUN re-fetch automatique. Si getUser()
   échoue/retourne null au boot ou au resume (réveil, réseau pas prêt),
   la query se fige en erreur → userId reste undefined → dashboard vide +
   tier "free", sans recovery hors cold restart.

   Ce composant s'abonne UNE fois à onAuthStateChange et invalide
   ["currentUser"] dès que la session redevient disponible
   (INITIAL_SESSION émis à l'abonnement, SIGNED_IN, TOKEN_REFRESHED,
   USER_UPDATED). invalidateQueries force un re-fetch même sur une query
   en erreur ; la cascade fait le reste seule : userId undefined → réel
   ré-active les queries dashboard (enabled:!!userId) et re-tire le tier
   via le useEffect de SubscriptionProvider (refresh dépend de userId).

   ⚠️ On n'appelle AUCUNE méthode supabase.auth.* DANS le callback
   (risque de deadlock sur le lock GoTrue). invalidateQueries/removeQueries
   sont des appels React Query → sûrs.

   Single-instance : monté une seule fois dans le root layout, à côté de
   SocialLoginInit/PushRegistrar. Rendu null — effet de bord seul.
═══════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function AuthSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        // PAS d'appel supabase.auth.* ici (deadlock GoTrue). React Query only.
        if (event === "SIGNED_OUT") {
          queryClient.removeQueries({ queryKey: ["currentUser"] });
          return;
        }
        if (
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          queryClient.invalidateQueries({ queryKey: ["currentUser"] });
        }
      },
    );

    return () => { subscription.unsubscribe(); };
  }, [queryClient]);

  return null;
}
