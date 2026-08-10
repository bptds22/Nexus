/* ═══════════════════════════════════════════════════════════════
   useParentConversations — TanStack hook (P2 — parent web).
   The parent's own PARENT_COACH threads. Counterparty = the
   coach/director ; context = which child. Mirror of
   useAthleteConversations, parent-side (single type).

   Cache key : ["conversations", "parent", userId] — shares the
   "conversations" prefix so send / mark-read invalidations catch it.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface ParentThreadData {
  id: string;
  conversationType: string;
  coachId: string;
  coachName: string;
  coachInitials: string;
  coachPhotoUrl: string | null;
  coachRole: string;        // "Entraîneur" | "Directeur sportif"
  coachSchool: string;
  /** The child this thread is about. */
  childId: string;
  childName: string;
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

export function useParentConversations() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<ParentThreadData[]>({
    queryKey: ["conversations", "parent", userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();

      // My PARENT_COACH threads (RLS scopes to parent_id = me).
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, conversation_type, status, last_message_at, unread_count, created_at,
          coach:users!coach_id(
            id, first_name, last_name, photo_url, avatar_url, school_id,
            schools!school_id(name)
          ),
          child:athletes!athlete_id(id, first_name, last_name)
        `)
        .eq("conversation_type", "PARENT_COACH")
        .eq("parent_id", userId)
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
          const existing = roleMap.get(r.coach_id);
          if (!existing || r.role.startsWith("DIRECTEUR")) roleMap.set(r.coach_id, r.role);
        }
      }

      return data.map((c: Record<string, unknown>): ParentThreadData => {
        const cid_status = c.id as string;
        const raw = c.coach;
        const co = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
        const schoolRaw = co?.schools;
        const school = (Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw) as { name?: string } | null;
        const childRaw = c.child;
        const ch = (Array.isArray(childRaw) ? childRaw[0] : childRaw) as Record<string, unknown> | null;

        const cf = (co?.first_name as string) || "";
        const cl = (co?.last_name as string) || "";
        const cid = (co?.id as string) || "";
        const schoolName = school?.name || "";
        const role = roleLabel(roleMap.get(cid));
        const realName = `${cf} ${cl}`.trim();
        const coachName = realName || (schoolName ? `${role} — ${schoolName}` : role);
        const initials = realName
          ? `${cf[0] || ""}${cl[0] || ""}`.toUpperCase()
          : (schoolName ? schoolName.slice(0, 2).toUpperCase() : "•");
        const childName = `${(ch?.first_name as string) || ""} ${(ch?.last_name as string) || ""}`.trim() || "Mon enfant";

        return {
          id: cid_status,
          conversationType: "PARENT_COACH",
          coachId: cid,
          coachName,
          coachInitials: initials || "•",
          coachPhotoUrl: (co?.photo_url as string) || (co?.avatar_url as string) || null,
          coachRole: role,
          coachSchool: schoolName,
          childId: (ch?.id as string) || "",
          childName,
          lastMessage: lastMsgMap.get(cid_status) || "",
          lastMessageAt: (c.last_message_at as string) || (c.created_at as string) || "",
          lastSenderId: lastSenderMap.get(cid_status) ?? null,
          unreadCount: unreadMap.get(cid_status) ?? 0,
          status: (c.status as string) || "ACTIVE",
        };
      });
    },
    enabled: !!userId,
  });
}
