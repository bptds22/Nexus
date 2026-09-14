/* ═══════════════════════════════════════════════════════════════
   deconnexion — LA sortie. Un seul endroit, parce qu'il y a un ORDRE.

   POURQUOI CE FICHIER EXISTE. Le jeton push doit être retiré de la base
   AVANT le signOut, et cette contrainte n'est pas une préférence de
   style : la policy de `device_tokens` est

     device_tokens_delete_own : DELETE  USING (auth.uid() = user_id)

   Après `signOut()` il n'y a plus d'`auth.uid()` — le DELETE ne lève
   AUCUNE erreur, il ne trouve simplement zéro ligne. Le jeton reste donc
   en base, et le téléphone continue de recevoir les notifications d'un
   compte déconnecté. Un échec silencieux, dans le sens le plus littéral.

   Quinze surfaces appellent `signOut()`. Recopier « clearPushToken()
   d'abord » quinze fois, c'est garantir que la seizième l'oubliera.
   L'ordre vit ici, et les surfaces appellent `deconnexion()`.

   CE QUE ÇA NE FAIT PAS : la navigation. Chaque surface a sa
   destination (/, /auth, /compte-desactive) et son routeur — c'est à
   elle de rediriger, juste après.
   ═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { clearPushToken } from "@/lib/push/registerPush";
import { JOIN_CODE_STORAGE_KEY } from "@/lib/queries/athlete/teamAttachment";

/** Les clés de travail du wizard, stashées hors React pour survivre à un
 *  aller-retour /join → signup → onboarding. Elles ne survivent PAS à un
 *  changement de compte : fuite inter-comptes sur appareil partagé. */
const STASH_WIZARD = [JOIN_CODE_STORAGE_KEY];

/**
 * Termine la session sur CET appareil : retrait du jeton push, puis signOut.
 *
 * @param supabase client déjà en main (optionnel). Le client navigateur est un
 *   singleton — l'omettre donne strictement la même instance ; le paramètre
 *   n'existe que pour ne rien changer aux appelants qui en tiennent déjà un.
 */
export async function deconnexion(supabase?: SupabaseClient): Promise<void> {
  // Jamais bloquer la sortie. Un jeton qu'on n'a pas pu retirer est un défaut
  // à corriger ; un usager coincé sur un écran parce que Firebase a hoqueté
  // est un défaut PIRE. La garde native/web est dans clearPushToken.
  try {
    await clearPushToken();
  } catch (err) {
    console.error("[deconnexion] clearPushToken", err);
  }
  /* Fuite inter-comptes sur appareil partagé : le code d'équipe stashé au
     signup survivait à la déconnexion et était relu au montage de l'onboarding
     par le compte SUIVANT, qui se retrouvait rattaché à une équipe qu'il n'a
     jamais demandée. Le stash est un état de parcours, pas un état d'appareil —
     il sort avec la session. */
  for (const cle of STASH_WIZARD) {
    try { sessionStorage.removeItem(cle); } catch { /* privé / quota / SSR */ }
  }
  await (supabase ?? createClient()).auth.signOut();
}
