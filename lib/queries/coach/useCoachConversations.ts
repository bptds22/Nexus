/* ═══════════════════════════════════════════════════════════════
   useCoachConversations — TanStack hook (Phase 2 — coach mobile)
   Mirror of useConversations but coach-side : eq("coach_id", userId).
   Surface the RECRUITER (counterparty) + their CÉGEP + the athlete
   the recruiter is asking about — the row content the coach mobile
   list renders.

   Cache key prefix : ["conversations", "coach", userId]. Sharing the
   "conversations" prefix lets useSendMessage's invalidation
   (`["conversations"]`) catch both sides without forking. The
   "coach" segment isolates the cache shape from the recruiter's
   (different ThreadData layout).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface CoachThreadData {
  id: string;
  /** 'RECRUTEUR_COACH' (default) | 'ATHLETE_COACH'. */
  conversationType: string;
  /** Recruiter — counterparty. */
  recruiterId: string;
  recruiterName: string;
  recruiterInitials: string;
  recruiterPhotoUrl: string | null;
  recruiterCegep: string;
  /** Athlete subject (which player the recruiter is asking about). */
  athleteId: string;
  athleteName: string;
  athleteInitials: string;
  athletePosition: string;
  /** Last message preview + meta. */
  lastMessage: string;
  lastMessageAt: string;
  /** sender_id du DERNIER message du fil (null si aucun message). Sert au
      filtre "Sans réponse" : lastSenderId === coach courant → en attente. */
  lastSenderId: string | null;
  unreadCount: number;
  status: string;
}

export function useCoachConversations() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<CoachThreadData[]>({
    queryKey: ["conversations", "coach", userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();

      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, conversation_type, status, last_message_at, unread_count, created_at,
          recruiter:users!recruiter_id(
            id, first_name, last_name, avatar_url, photo_url, school_id,
            schools!school_id(name)
          ),
          athlete:athletes!athlete_id(
            id, first_name, last_name,
            positions!position_id(nom, abreviation)
          )
        `)
        .eq("coach_id", userId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // Last message per conversation (preview line).
      const convIds = data.map((c: Record<string, unknown>) => c.id as string);
      const lastMsgMap = new Map<string, string>();
      const lastSenderMap = new Map<string, string>();
      if (convIds.length > 0) {
        const { data: msgData } = await supabase
          .from("messages")
          .select("conversation_id, content, created_at, sender_id")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });
        if (msgData) {
          // Premier vu par conversation = le plus récent (ordre desc) → on
          // capture son contenu ET son expéditeur en même temps.
          for (const m of msgData as { conversation_id: string; content: string; sender_id: string }[]) {
            if (!lastMsgMap.has(m.conversation_id)) {
              lastMsgMap.set(m.conversation_id, m.content);
              lastSenderMap.set(m.conversation_id, m.sender_id);
            }
          }
        }
      }

      return data.map((c: Record<string, unknown>): CoachThreadData => {
        const recRaw = c.recruiter;
        const rec = (Array.isArray(recRaw) ? recRaw[0] : recRaw) as Record<string, unknown> | null;
        const recSchoolRaw = rec?.schools;
        const recSchool = (Array.isArray(recSchoolRaw) ? recSchoolRaw[0] : recSchoolRaw) as { name?: string } | null;
        const athRaw = c.athlete;
        const ath = (Array.isArray(athRaw) ? athRaw[0] : athRaw) as Record<string, unknown> | null;
        const posRaw = ath?.positions;
        const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string } | null;

        const rf = (rec?.first_name as string) || "";
        const rl = (rec?.last_name as string) || "";
        const af = (ath?.first_name as string) || "";
        const al = (ath?.last_name as string) || "";

        return {
          id: c.id as string,
          conversationType: (c.conversation_type as string) || "RECRUTEUR_COACH",
          recruiterId: (rec?.id as string) || "",
          recruiterName: `${rf} ${rl}`.trim() || "Recruteur",
          recruiterInitials: `${rf[0] || ""}${rl[0] || ""}`.toUpperCase(),
          recruiterPhotoUrl: (rec?.photo_url as string) || (rec?.avatar_url as string) || null,
          recruiterCegep: recSchool?.name || "",
          athleteId: (ath?.id as string) || "",
          athleteName: `${af} ${al}`.trim() || "Athlète",
          athleteInitials: `${af[0] || ""}${al[0] || ""}`.toUpperCase(),
          athletePosition: pos?.abreviation || "",
          lastMessage: lastMsgMap.get(c.id as string) || "",
          lastMessageAt: (c.last_message_at as string) || (c.created_at as string) || "",
          lastSenderId: lastSenderMap.get(c.id as string) ?? null,
          unreadCount: (c.unread_count as number) || 0,
          status: (c.status as string) || "ACTIVE",
        };
      });
    },
    enabled: !!userId,
  });
}
