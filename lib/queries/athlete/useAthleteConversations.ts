/* ═══════════════════════════════════════════════════════════════
   useAthleteConversations — TanStack hook (Phase B — athlete web).
   The athlete's own ATHLETE_COACH threads. Counterparty = the
   coach/director. Mirror of useCoachConversations, athlete-side.

   Cache key : ["conversations", "athlete", userId] — shares the
   "conversations" prefix so useSendMessage / mark-read invalidations
   (["conversations"]) catch it.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface AthleteThreadData {
  id: string;
  coachId: string;
  coachName: string;
  coachInitials: string;
  coachPhotoUrl: string | null;
  /** "Entraîneur" | "Directeur sportif" (from school_coaches.role). */
  coachRole: string;
  coachSchool: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string | null;
  unreadCount: number;
  status: string;
}

function roleLabel(scRole: string | undefined): string {
  if (scRole === "DIRECTEUR" || scRole === "DIRECTEUR_INTERIM") return "Directeur sportif";
  return "Entraîneur";
}

export function useAthleteConversations() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<AthleteThreadData[]>({
    queryKey: ["conversations", "athlete", userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();

      // Resolve my athlete row (the anchor athlete_id).
      const { data: athleteRow } = await supabase
        .from("athletes")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      const athleteId = athleteRow?.id as string | undefined;
      if (!athleteId) return [];

      // My ATHLETE_COACH conversations (RLS scopes to mine anyway).
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, status, last_message_at, unread_count, created_at,
          coach:users!coach_id(
            id, first_name, last_name, photo_url, avatar_url, school_id,
            schools!school_id(name)
          )
        `)
        .eq("conversation_type", "ATHLETE_COACH")
        .eq("athlete_id", athleteId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];

      const convIds = data.map((c: Record<string, unknown>) => c.id as string);
      const coachIds = [
        ...new Set(
          data.map((c: Record<string, unknown>) => {
            const raw = c.coach;
            const co = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
            return (co?.id as string) || "";
          }).filter(Boolean),
        ),
      ];

      // Last message + unread inbound count per conversation.
      const lastMsgMap = new Map<string, string>();
      const lastSenderMap = new Map<string, string>();
      const unreadMap = new Map<string, number>();
      if (convIds.length > 0) {
        const { data: msgData } = await supabase
          .from("messages")
          .select("conversation_id, content, created_at, sender_id, read_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });
        if (msgData) {
          for (const m of msgData as { conversation_id: string; content: string; sender_id: string; read_at: string | null }[]) {
            if (!lastMsgMap.has(m.conversation_id)) {
              lastMsgMap.set(m.conversation_id, m.content);
              lastSenderMap.set(m.conversation_id, m.sender_id);
            }
            if (m.sender_id !== userId && !m.read_at) {
              unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
            }
          }
        }
      }

      // Coach role labels (school_coaches).
      const roleMap = new Map<string, string>();
      if (coachIds.length > 0) {
        const { data: scRows } = await supabase
          .from("school_coaches")
          .select("coach_id, role")
          .in("coach_id", coachIds);
        for (const r of (scRows ?? []) as { coach_id: string; role: string }[]) {
          // Prefer a director role if the coach has multiple rows.
          const existing = roleMap.get(r.coach_id);
          if (!existing || r.role.startsWith("DIRECTEUR")) roleMap.set(r.coach_id, r.role);
        }
      }

      return data.map((c: Record<string, unknown>): AthleteThreadData => {
        const raw = c.coach;
        const co = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
        const schoolRaw = co?.schools;
        const school = (Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw) as { name?: string } | null;
        const cf = (co?.first_name as string) || "";
        const cl = (co?.last_name as string) || "";
        const cid = (co?.id as string) || "";

        return {
          id: c.id as string,
          coachId: cid,
          coachName: `${cf} ${cl}`.trim() || "Entraîneur",
          coachInitials: `${cf[0] || ""}${cl[0] || ""}`.toUpperCase() || "?",
          coachPhotoUrl: (co?.photo_url as string) || (co?.avatar_url as string) || null,
          coachRole: roleLabel(roleMap.get(cid)),
          coachSchool: school?.name || "",
          lastMessage: lastMsgMap.get(c.id as string) || "",
          lastMessageAt: (c.last_message_at as string) || (c.created_at as string) || "",
          lastSenderId: lastSenderMap.get(c.id as string) ?? null,
          unreadCount: unreadMap.get(c.id as string) ?? 0,
          status: (c.status as string) || "ACTIVE",
        };
      });
    },
    enabled: !!userId,
  });
}
