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
import { mapDbStatus, type ThreadStatus } from "@/lib/messaging/threadStatus";

export interface AthleteThreadData {
  id: string;
  /** 'ATHLETE_COACH' today ; 'RECRUTEUR_ATHLETE' auto-appears with P3. */
  conversationType: string;
  coachId: string;
  coachName: string;
  coachInitials: string;
  coachPhotoUrl: string | null;
  /** "Entraîneur" | "Directeur sportif" (from school_coaches.role). */
  coachRole: string;
  coachSchool: string;
  /** false when the counterparty has no users-profile name (bare fixture
      row) → coachName holds the "{role} — {école}" fallback and the row
      suppresses the redundant role·école subtitle. */
  hasCoachName: boolean;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string | null;
  unreadCount: number;
  /** Raw conversation status (ACTIVE / ARCHIVE). */
  status: string;
  /** Viewer-relative status for the shared status-pill filter. */
  threadStatus: ThreadStatus;
}

function roleLabel(scRole: string | undefined): string {
  if (scRole === "DIRECTEUR" || scRole === "DIRECTEUR_INTERIM") return "Directeur sportif";
  return "Entraîneur";
}

/** School initials for the avatar fallback ("Académie Antoine-Manseau" → "AA"). */
function schoolInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

      // My ATHLETE_COACH threads (counterparty = coach) + my RECRUTEUR_ATHLETE
      // threads (counterparty = recruiter — P3, coach_id NULL). RLS scopes to
      // mine anyway. The athlete only ever RECEIVES/REPLIES to RA threads.
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, conversation_type, status, last_message_at, unread_count, created_at, recruiter_id,
          coach:users!coach_id(
            id, first_name, last_name, photo_url, avatar_url, school_id,
            schools!school_id(name)
          )
        `)
        .in("conversation_type", ["ATHLETE_COACH", "RECRUTEUR_ATHLETE"])
        .eq("athlete_id", athleteId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // RA counterparty = recruiter. Fetch separately (a second `users` embed
      // alongside the coach one triggers PostgREST FK ambiguity) — same pattern
      // useCoachConversations uses for recruiters.
      const recruiterIds = [...new Set(
        data.filter((c: Record<string, unknown>) => c.conversation_type === "RECRUTEUR_ATHLETE")
          .map((c: Record<string, unknown>) => c.recruiter_id as string)
          .filter(Boolean),
      )];
      const recruiterMap = new Map<string, { name: string; initials: string; photo: string | null; school: string }>();
      if (recruiterIds.length > 0) {
        const { data: recs } = await supabase
          .from("users")
          .select("id, first_name, last_name, photo_url, avatar_url, school_id")
          .in("id", recruiterIds);
        const schoolIds = [...new Set((recs ?? []).map((r) => (r as Record<string, unknown>).school_id as string).filter(Boolean))];
        const schoolNameMap = new Map<string, string>();
        if (schoolIds.length > 0) {
          const { data: sc } = await supabase.from("schools").select("id, name").in("id", schoolIds);
          for (const s of (sc ?? []) as { id: string; name: string }[]) schoolNameMap.set(s.id, s.name);
        }
        for (const r of (recs ?? []) as Record<string, unknown>[]) {
          const rf = (r.first_name as string) || "";
          const rl = (r.last_name as string) || "";
          recruiterMap.set(r.id as string, {
            name: `${rf} ${rl}`.trim() || "Recruteur",
            initials: `${rf[0] || ""}${rl[0] || ""}`.toUpperCase() || "R",
            photo: (r.photo_url as string) || (r.avatar_url as string) || null,
            school: schoolNameMap.get(r.school_id as string) || "",
          });
        }
      }

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

      // Last message + unread inbound count + "who replied" per conversation.
      const lastMsgMap = new Map<string, string>();
      const lastSenderMap = new Map<string, string>();
      const unreadMap = new Map<string, number>();
      const meRepliedMap = new Map<string, boolean>();   // athlete sent ≥1
      const otherRepliedMap = new Map<string, boolean>(); // coach sent ≥1
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
            if (m.sender_id === userId) meRepliedMap.set(m.conversation_id, true);
            else otherRepliedMap.set(m.conversation_id, true);
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
        const isRA = (c.conversation_type as string) === "RECRUTEUR_ATHLETE";
        const cid_status = (c.id as string);

        // RECRUTEUR_ATHLETE : counterparty = recruiter (from recruiterMap).
        if (isRA) {
          const r = recruiterMap.get(c.recruiter_id as string);
          const rName = r?.name || "Recruteur";
          return {
            id: cid_status,
            conversationType: "RECRUTEUR_ATHLETE",
            coachId: (c.recruiter_id as string) || "",
            coachName: rName,
            coachInitials: r?.initials || "R",
            coachPhotoUrl: r?.photo || null,
            coachRole: "Recruteur",
            coachSchool: r?.school || "",
            hasCoachName: !!r?.name,
            lastMessage: lastMsgMap.get(cid_status) || "",
            lastMessageAt: (c.last_message_at as string) || (c.created_at as string) || "",
            lastSenderId: lastSenderMap.get(cid_status) ?? null,
            unreadCount: unreadMap.get(cid_status) ?? 0,
            status: (c.status as string) || "ACTIVE",
            threadStatus: mapDbStatus(c.status as string, meRepliedMap.get(cid_status), otherRepliedMap.get(cid_status)),
          };
        }

        // ATHLETE_COACH : counterparty = coach.
        const raw = c.coach;
        const co = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
        const schoolRaw = co?.schools;
        const school = (Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw) as { name?: string } | null;
        const cf = (co?.first_name as string) || "";
        const cl = (co?.last_name as string) || "";
        const cid = (co?.id as string) || "";
        const schoolName = school?.name || "";
        const role = roleLabel(roleMap.get(cid));

        // Name-resolution fallback : a bare fixture coach (no first/last
        // name on its users row) resolves gracefully to "{role} — {école}"
        // instead of a generic label + "?" avatar.
        const realName = `${cf} ${cl}`.trim();
        const hasCoachName = realName.length > 0;
        const coachName = hasCoachName ? realName : schoolName ? `${role} — ${schoolName}` : role;
        const initials = hasCoachName
          ? `${cf[0] || ""}${cl[0] || ""}`.toUpperCase()
          : schoolName ? schoolInitials(schoolName) : "•";

        return {
          id: cid_status,
          conversationType: (c.conversation_type as string) || "ATHLETE_COACH",
          coachId: cid,
          coachName,
          coachInitials: initials || "•",
          coachPhotoUrl: (co?.photo_url as string) || (co?.avatar_url as string) || null,
          coachRole: role,
          coachSchool: schoolName,
          hasCoachName,
          lastMessage: lastMsgMap.get(cid_status) || "",
          lastMessageAt: (c.last_message_at as string) || (c.created_at as string) || "",
          lastSenderId: lastSenderMap.get(cid_status) ?? null,
          unreadCount: unreadMap.get(cid_status) ?? 0,
          status: (c.status as string) || "ACTIVE",
          threadStatus: mapDbStatus(c.status as string, meRepliedMap.get(cid_status), otherRepliedMap.get(cid_status)),
        };
      });
    },
    enabled: !!userId,
    // Fix #4 : rafraîchit l'inbox au premier plan pour qu'une diffusion reçue
    // apparaisse sans action manuelle (la publication realtime n'inclut pas
    // `messages` en prod). refetchOnWindowFocus complète resume/visibilitychange.
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });
}
