"use client";

import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   deleteMyAccount — suppression de compte DÉFINITIVE.
   (Loi 25 option B : anonymisation/purge serveur + Apple §5.1.1(v) :
    l'app doit offrir une vraie suppression de compte.)

   Appelle la RPC delete_my_account() — SECURITY DEFINER, keyée sur
   auth.uid() : elle supprime TOUJOURS l'appelant (aucun paramètre
   user_id). Puis :
     - succès → signOut IMMÉDIAT. Le JWT reste valide après le delete
       jusqu'à son expiration ; sans signOut, l'app croit l'utilisateur
       connecté à un compte qui n'existe plus. Ensuite redirection DURE
       (window.location) : on repart d'un contexte JS propre, aucun
       provider (useCurrentUser / SubscriptionProvider) ne pointe encore
       vers un compte mort.
     - erreur → onError(message) pour un toast côté appelant ; AUCUN
       signOut, AUCUNE redirection (l'utilisateur reste connecté).

   Helper partagé par les 3 portails (athlète / coach / recruteur),
   mobile + desktop. NE PAS confondre avec deactivate_my_account
   (désactivation RÉVERSIBLE, conservation des données) — distincte.
═══════════════════════════════════════════════════════════════ */

export async function deleteMyAccount(opts?: {
  /** Destination après suppression réussie. Défaut "/auth". */
  redirectTo?: string;
  /** Appelé si la RPC échoue (pas de signOut, pas de redirection). */
  onError?: (message: string) => void;
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    opts?.onError?.(error.message);
    return false;
  }
  try { localStorage.removeItem("nexus_user"); } catch { /* no-op */ }
  await supabase.auth.signOut();
  if (typeof window !== "undefined") {
    window.location.assign(opts?.redirectTo ?? "/auth");
  }
  return true;
}
