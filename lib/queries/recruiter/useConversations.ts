/* ═══════════════════════════════════════════════════════════════
   useConversations — TanStack hook (iter 5.2)
   Liste des conversations du recruteur courant + dernier message
   par conversation. Reproduit fidèlement le useEffect ligne 146 de
   app/recruteur/messages/page.tsx.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface ThreadData {
  id: string;
  /** 'RECRUTEUR_COACH' (about an athlete, counterparty = coach) |
      'RECRUTEUR_ATHLETE' (DIRECT, counterparty = athlete). */
  conversationType: string;
  coachName: string;
  coachInitials: string;
  coachSchool: string;
  coachId: string;
  coachPhotoUrl: string | null;
  athleteName: string;
  athleteInitials: string;
  athleteId: string;
  athletePhotoUrl: string | null;
  athletePosition: string;
  athleteVerified: boolean;
  athleteStars: number;
  athleteRecruitmentStatus: string;
  lastMessage: string;
  lastMessageAt: string;
  /** sender_id du DERNIER message du fil (null si aucun message). Sert au
      filtre "Sans réponse" : lastSenderId === recruteur courant → en attente. */
  lastSenderId: string | null;
  unreadCount: number;
  status: string;
}

export function useConversations() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<ThreadData[]>({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();

      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, conversation_type, status, last_message_at, unread_count, created_at,
          coach:users!coach_id(id, first_name, last_name, photo_url, avatar_url, school_id, schools!school_id(name)),
          athlete:athletes!athlete_id(
            id, first_name, last_name, photo_url, verified, cote_globale_entraineur,
            numero_jersey, annee_diplomation, recruitment_status,
            sports!sport_id(nom),
            positions!position_id(nom, abreviation),
            schools!school_id(name, region)
          )
        `)
        .eq("recruiter_id", userId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // Récupérer le dernier message par conversation
      const convIds = data.map((c: Record<string, unknown>) => c.id as string);
      const lastMsgMap = new Map<string, string>();
      const lastSenderMap = new Map<string, string>();
      if (convIds.length > 0) {
        const { data: msgData } = await supabase
          .from("messages")
          .select("conversation_id, content, sender_id")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });
        if (msgData) {
          // Premier vu par conversation = le plus récent (ordre desc) → contenu + expéditeur.
          for (const m of msgData as { conversation_id: string; content: string; sender_id: string }[]) {
            if (!lastMsgMap.has(m.conversation_id)) {
              lastMsgMap.set(m.conversation_id, m.content);
              lastSenderMap.set(m.conversation_id, m.sender_id);
            }
          }
        }
      }

      // Mapping identique à la page existante
      return data.map((c: Record<string, unknown>): ThreadData => {
        const coachRaw = c.coach;
        const coach = (Array.isArray(coachRaw) ? coachRaw[0] : coachRaw) as Record<string, unknown> | null;
        const coachSchoolRaw = coach?.schools;
        const coachSchool = (Array.isArray(coachSchoolRaw) ? coachSchoolRaw[0] : coachSchoolRaw) as { name?: string } | null;
        const athleteRaw = c.athlete;
        const athlete = (Array.isArray(athleteRaw) ? athleteRaw[0] : athleteRaw) as Record<string, unknown> | null;
        const posRaw = athlete?.positions;
        const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string } | null;

        const coachFirst = (coach?.first_name as string) || "";
        const coachLast = (coach?.last_name as string) || "";
        const athFirst = (athlete?.first_name as string) || "";
        const athLast = (athlete?.last_name as string) || "";

        return {
          id: c.id as string,
          conversationType: (c.conversation_type as string) || "RECRUTEUR_COACH",
          coachName: `${coachFirst} ${coachLast}`.trim() || "Coach",
          coachInitials: `${coachFirst[0] || ""}${coachLast[0] || ""}`.toUpperCase(),
          coachSchool: coachSchool?.name || "",
          coachId: (coach?.id as string) || "",
          coachPhotoUrl: (coach?.photo_url as string) || (coach?.avatar_url as string) || null,
          athleteName: `${athFirst} ${athLast}`.trim() || "Athlète",
          athleteInitials: `${athFirst[0] || ""}${athLast[0] || ""}`.toUpperCase(),
          athleteId: (athlete?.id as string) || "",
          athletePhotoUrl: (athlete?.photo_url as string) || null,
          athletePosition: pos?.abreviation || "",
          athleteVerified: !!athlete?.verified,
          athleteStars: (athlete?.cote_globale_entraineur as number) || 0,
          athleteRecruitmentStatus: (athlete?.recruitment_status as string) || "OUVERT",
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
