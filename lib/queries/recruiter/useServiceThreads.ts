/* ═══════════════════════════════════════════════════════════════
   useServiceThreads — les fils de SERVICE (ADMIN_USER) d'un recruteur,
   et RIEN d'autre.

   POURQUOI UN HOOK À PART plutôt que de filtrer useConversations
   ──────────────────────────────────────────────────────────────
   Ce hook est monté quand le FeatureGate Pro BLOQUE la messagerie.
   Monter useConversations pour n'en garder que les ADMIN_USER
   ramènerait TOUS les fils du recruteur dans le client — exactement
   la fuite que FeatureGate existe pour empêcher (« conditional render,
   les enfants ne sont pas montés, leurs appels Supabase ne partent
   jamais »). Un filtre côté client cache une donnée, il ne l'empêche
   pas de partir : elle reste lisible dans l'onglet Réseau.

   Donc : `.eq("conversation_type", "ADMIN_USER")` est posé DANS la
   requête, pas après. Trois requêtes au total, toutes bornées —
   les fils de service, les messages de CES fils seulement, et
   l'identité de service. Aucune autre.

   Pourquoi le recruteur gratuit y a droit : un message de maintenance,
   d'information ou de support doit atteindre un compte gratuit. Le
   verrou Pro protège la messagerie de RECRUTEMENT, pas la communication
   de la plateforme — même frontière que le fil sorti devant le
   FeatureGate dans app/recruteur/messages/[id]/PageClient.tsx et que
   l'exemption de black-out en base. Cf. CLAUDE.md, MIGRATION SAFETY
   CHECKLIST règle 11.

   Rien n'est ouvert au passage : la RLS `recruiter_conversations_select`
   est `recruiter_id = auth.uid()`, sans palier. Le palier n'a jamais
   été le contrôle d'accès ici, seulement une couche d'UI.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import {
  fetchServiceIdentity,
  SERVICE_IDENTITY_FALLBACK,
  type ServiceIdentity,
} from "@/lib/messaging/serviceIdentity";

export interface ServiceThread {
  id: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  sender: ServiceIdentity;
}

export function useServiceThreads() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<ServiceThread[]>({
    /* Préfixe ["conversations"] : les invalidations de mark-read
       (queryKey ["conversations"]) rafraîchissent ce hook aussi, donc
       le compteur de non-lus retombe après lecture du fil. */
    queryKey: ["conversations", "service", userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();

      // 1/3 — les fils de service, et eux seuls.
      const { data: convs, error } = await supabase
        .from("conversations")
        .select("id, last_message_at, created_at")
        .eq("conversation_type", "ADMIN_USER")
        .eq("recruiter_id", userId)
        .order("last_message_at", { ascending: false });
      if (error) throw error;

      const rows = (convs ?? []) as { id: string; last_message_at: string | null; created_at: string }[];
      // Au plus UN fil, par construction : l'index unique partiel
      // conversations_admin_recruiter_uniq. On boucle quand même — un
      // invariant de base ne se recopie pas en hypothèse de rendu.
      if (rows.length === 0) return [];

      // 2/3 — les messages de CES conversations seulement.
      const ids = rows.map((c) => c.id);
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at, sender_id, read_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false });

      const lastMsg = new Map<string, string>();
      const lastAt = new Map<string, string>();
      const unread = new Map<string, number>();
      for (const m of (msgs ?? []) as { conversation_id: string; content: string; created_at: string; sender_id: string; read_at: string | null }[]) {
        if (!lastMsg.has(m.conversation_id)) {
          lastMsg.set(m.conversation_id, m.content);
          lastAt.set(m.conversation_id, m.created_at);
        }
        // conversations.unread_count n'est pas maintenu par
        // send_admin_message : on compte les entrants non lus, comme le
        // fait le hook athlète.
        if (m.sender_id !== userId && !m.read_at) {
          unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
        }
      }

      // 3/3 — l'identité de service (une ligne, policy dédiée).
      const sender = (await fetchServiceIdentity(supabase)) ?? SERVICE_IDENTITY_FALLBACK;

      return rows.map((c) => ({
        id: c.id,
        lastMessage: lastMsg.get(c.id) || "",
        lastMessageAt: lastAt.get(c.id) || c.last_message_at || c.created_at || "",
        unreadCount: unread.get(c.id) ?? 0,
        sender,
      }));
    },
    enabled: !!userId,
  });
}
