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

  // ─── INSTRUMENTATION TEMPORAIRE (à RETIRER après diagnostic) ───────────
  // But : voir sur device si la session est déjà morte AVANT l'appel RPC
  // (→ auth.uid() NULL côté serveur) ou si c'est la RPC qui rejette.
  try {
    const { data: sess } = await supabase.auth.getSession();
    const { data: usr, error: usrErr } = await supabase.auth.getUser();
    console.error("[delete][diag] AVANT rpc", {
      hasSession: !!sess?.session,
      accessTokenPresent: !!sess?.session?.access_token,
      sessionUserId: sess?.session?.user?.id ?? null,
      getUserId: usr?.user?.id ?? null,
      getUserError: usrErr?.message ?? null,
    });
  } catch (e) {
    console.error("[delete][diag] getSession/getUser a jeté", e);
  }
  // ──────────────────────────────────────────────────────────────────────

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    // INSTRUMENTATION TEMPORAIRE — erreur RPC complète (code/message/details/hint).
    console.error("[delete][diag] rpc delete_my_account ÉCHEC", {
      message: error.message,
      code: (error as { code?: string }).code,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
    });
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
