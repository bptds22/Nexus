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
import { loadSenderBroadcastSummaries } from "@/lib/queries/coach/loadSenderBroadcasts";

export interface CoachThreadData {
  id: string;
  /** 'RECRUTEUR_COACH' (default) | 'ATHLETE_COACH' | 'COACH_COACH' | 'BROADCAST'. */
  conversationType: string;
  /** Broadcast (Annonce) pseudo-thread — folds N member threads into one row. */
  isBroadcast?: boolean;
  broadcastId?: string;
  targetLabel?: string;
  recipientCount?: number;
  /** COACH_COACH counterparty (the other coach/director). */
  otherCoachName: string;
  otherCoachInitials: string;
  otherCoachIsDirector: boolean;
  otherCoachPhotoUrl: string | null;
  /** PARENT_COACH counterparty (the linked parent). Child = athlete fields. */
  parentName: string;
  parentInitials: string;
  parentPhotoUrl: string | null;
  /** Recruiter — counterparty. */
  recruiterId: string;
  recruiterName: string;
  recruiterInitials: string;
  recruiterPhotoUrl: string | null;
  recruiterCegep: string;
  /** Athlete subject (RECRUTEUR_COACH) OR counterparty (ATHLETE_COACH). */
  athleteId: string;
  athleteName: string;
  athleteInitials: string;
  athletePhotoUrl: string | null;
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
          coach_id, coach_b_id, parent_id,
          recruiter:users!recruiter_id(
            id, first_name, last_name, avatar_url, photo_url, school_id,
            schools!school_id(name)
          ),
          athlete:athletes!athlete_id(
            id, first_name, last_name, photo_url,
            positions!position_id(nom, abreviation)
          )
        `)
        .or(`coach_id.eq.${userId},coach_b_id.eq.${userId}`)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // COACH_COACH — resolve the "other coach" (coach_b_id when I'm coach_id)
      // + director status (label only). Secondary fetch keeps the FK join simple.
      const otherCoachIds = [...new Set(data
        .filter((c: Record<string, unknown>) => c.conversation_type === "COACH_COACH")
        .map((c: Record<string, unknown>) => (c.coach_id === userId ? c.coach_b_id : c.coach_id) as string)
        .filter(Boolean))];
      const otherCoachMap = new Map<string, { name: string; initials: string; isDirector: boolean; photoUrl: string | null }>();
      if (otherCoachIds.length > 0) {
        const { data: cu } = await supabase.from("users").select("id, first_name, last_name, photo_url, avatar_url").in("id", otherCoachIds);
        const { data: dr } = await supabase.from("school_coaches").select("coach_id, role").in("coach_id", otherCoachIds);
        const directorSet = new Set((dr || []).filter((r) => (r as { role: string }).role === "DIRECTEUR" || (r as { role: string }).role === "DIRECTEUR_INTERIM").map((r) => (r as { coach_id: string }).coach_id));
        for (const u of cu || []) {
          const uu = u as { id: string; first_name?: string; last_name?: string; photo_url?: string; avatar_url?: string };
          const f = uu.first_name || ""; const l = uu.last_name || "";
          otherCoachMap.set(uu.id, { name: `${f} ${l}`.trim() || "Coach", initials: `${f[0] || ""}${l[0] || ""}`.toUpperCase(), isDirector: directorSet.has(uu.id), photoUrl: uu.photo_url || uu.avatar_url || null });
        }
      }

      // PARENT_COACH — resolve the linked parent's name (counterparty). The
      // coach can read these users rows via the coach_reads_athlete_parent RLS
      // policy (migration 20260725120000).
      const parentIds = [...new Set(data
        .filter((c: Record<string, unknown>) => c.conversation_type === "PARENT_COACH")
        .map((c: Record<string, unknown>) => c.parent_id as string)
        .filter(Boolean))];
      const parentMap = new Map<string, { name: string; initials: string; photoUrl: string | null }>();
      if (parentIds.length > 0) {
        const { data: pu } = await supabase.from("users").select("id, first_name, last_name, photo_url, avatar_url").in("id", parentIds);
        for (const u of pu || []) {
          const uu = u as { id: string; first_name?: string; last_name?: string; photo_url?: string; avatar_url?: string };
          const f = uu.first_name || ""; const l = uu.last_name || "";
          parentMap.set(uu.id, { name: `${f} ${l}`.trim() || "Parent", initials: `${f[0] || ""}${l[0] || ""}`.toUpperCase() || "P", photoUrl: uu.photo_url || uu.avatar_url || null });
        }
      }

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

      // Annonce (broadcast) folding — one pseudo-thread per broadcast this
      // coach sent, and DROP its N member threads (replaced by the Annonce row).
      const { annonces, memberConvIds } = await loadSenderBroadcastSummaries(supabase, userId);
      const annonceThreads: CoachThreadData[] = annonces.map((a) => ({
        id: `annonce:${a.broadcastId}`,
        conversationType: "BROADCAST",
        isBroadcast: true,
        broadcastId: a.broadcastId,
        targetLabel: a.targetLabel,
        recipientCount: a.recipientCount,
        otherCoachName: "", otherCoachInitials: "", otherCoachIsDirector: false, otherCoachPhotoUrl: null,
        parentName: "", parentInitials: "", parentPhotoUrl: null,
        recruiterId: "", recruiterName: "", recruiterInitials: "", recruiterPhotoUrl: null, recruiterCegep: "",
        athleteId: "", athleteName: "", athleteInitials: "", athletePhotoUrl: null, athletePosition: "",
        lastMessage: a.content,
        lastMessageAt: a.lastActivityAt,
        lastSenderId: null,
        unreadCount: a.unreadReplies,
        status: "ACTIVE",
      }));

      const threads = data.map((c: Record<string, unknown>): CoachThreadData => {
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

        const otherId = (c.coach_id === userId ? c.coach_b_id : c.coach_id) as string | undefined;
        const oc = otherId ? otherCoachMap.get(otherId) : undefined;
        const pm = parentMap.get(c.parent_id as string);

        return {
          id: c.id as string,
          conversationType: (c.conversation_type as string) || "RECRUTEUR_COACH",
          otherCoachName: oc?.name || "Coach",
          otherCoachInitials: oc?.initials || "",
          otherCoachIsDirector: !!oc?.isDirector,
          otherCoachPhotoUrl: oc?.photoUrl ?? null,
          parentName: pm?.name || "Parent",
          parentInitials: pm?.initials || "P",
          parentPhotoUrl: pm?.photoUrl ?? null,
          recruiterId: (rec?.id as string) || "",
          recruiterName: `${rf} ${rl}`.trim() || "Recruteur",
          recruiterInitials: `${rf[0] || ""}${rl[0] || ""}`.toUpperCase(),
          recruiterPhotoUrl: (rec?.photo_url as string) || (rec?.avatar_url as string) || null,
          recruiterCegep: recSchool?.name || "",
          athleteId: (ath?.id as string) || "",
          athleteName: `${af} ${al}`.trim() || "Athlète",
          athleteInitials: `${af[0] || ""}${al[0] || ""}`.toUpperCase(),
          athletePhotoUrl: (ath?.photo_url as string) || null,
          athletePosition: pos?.abreviation || "",
          lastMessage: lastMsgMap.get(c.id as string) || "",
          lastMessageAt: (c.last_message_at as string) || (c.created_at as string) || "",
          lastSenderId: lastSenderMap.get(c.id as string) ?? null,
          unreadCount: (c.unread_count as number) || 0,
          status: (c.status as string) || "ACTIVE",
        };
      });

      const visible = memberConvIds.size > 0 ? threads.filter((t) => !memberConvIds.has(t.id)) : threads;
      // Annonces first (newest broadcasts), then the normal threads (already
      // sorted by last_message_at desc from the query).
      return [...annonceThreads, ...visible];
    },
    enabled: !!userId,
  });
}
