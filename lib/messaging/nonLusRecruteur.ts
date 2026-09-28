/* ═══════════════════════════════════════════════════════════════
   nonLusRecruteur — UNE définition du « non lu » côté recruteur.

   Bug du 2026-09-28 (test prod BP) : la barre latérale affichait « 8 »
   messages non lus, le filtre « Non lu » de la page Messages n'en montrait
   aucun. Les deux avaient tort, chacun à sa manière :
   - la PAGE lisait `conversations.unread_count` — colonne MORTE : rien ne
     l'incrémente, `mark_conversation_read` ne fait que la remettre à 0.
     Toujours 0, donc « Non lu » n'aurait jamais rien montré, même un vrai
     nouveau message ;
   - la BARRE LATÉRALE comptait `messages.read_at IS NULL` (la bonne règle),
     mais le fil web du recruteur ne posait JAMAIS `read_at` (il remettait
     seulement `unread_count` à 0). Elle comptait donc tous les messages
     reçus depuis toujours, lus ou non.

   La règle, la même que côté coach (useCoachConversations) et athlète :
     un message est NON LU s'il a été REÇU (sender_id <> moi) et que
     read_at IS NULL, dans une conversation du recruteur NON ARCHIVÉE.
   On le marque lu par la RPC `mark_conversation_read` (pose read_at).

   Tout ce qui compte des non-lus recruteur passe par ici : la pastille de
   la barre latérale, le compte par fil de la page Messages, le filtre
   « Non lu ». Un compteur juste sur une seule surface apprend à l'usager
   que le compteur ment.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Statut de conversation exclu des non-lus (pastille ET filtre). */
export const STATUT_ARCHIVE = "ARCHIVE";

/** Vrai si le message est non lu pour `moi`. */
export function estNonLu(m: { sender_id: string | null; read_at: string | null }, moi: string): boolean {
  return m.sender_id !== moi && !m.read_at;
}

/** Vrai si la conversation compte dans les non-lus (pas archivée). */
export function conversationCompte(statut: string | null | undefined): boolean {
  return statut !== STATUT_ARCHIVE;
}

/** Total des non-lus du recruteur — la pastille de la barre latérale. */
export async function compterNonLusRecruteur(supabase: SupabaseClient, moi: string): Promise<number> {
  const { data: convs, error } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("recruiter_id", moi);
  if (error) throw error;
  const ids = ((convs ?? []) as { id: string; status: string | null }[])
    .filter((c) => conversationCompte(c.status))
    .map((c) => c.id);
  if (ids.length === 0) return 0;
  const { count, error: errMsg } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", ids)
    .neq("sender_id", moi)
    .is("read_at", null);
  if (errMsg) throw errMsg;
  return count ?? 0;
}

/* ── Rafraîchissement des compteurs ────────────────────────────────
   Le même mécanisme que les notifications athlète : un événement window
   `notifications-updated`. Tout geste qui change un compteur (lire un fil,
   marquer les activités lues) le déclenche ; la barre latérale l'écoute. */
export const EVENEMENT_COMPTEURS = "notifications-updated";

export function signalerCompteursAJour(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_COMPTEURS));
}
