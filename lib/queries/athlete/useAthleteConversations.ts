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
  /** 'ATHLETE_COACH' | 'RECRUTEUR_ATHLETE' | 'GROUP'. */
  conversationType: string;
  /** Vrai groupe chat (conversation_type='GROUP'). Une conversation = UNE row
      (avatar de groupe générique + groupName + dernier message visible). */
  isGroup?: boolean;
  /** group_name (ex "Équipe Dragons Juvenile" / "Staff — École X"). */
  groupName?: string;
  /** group_scope : 'STAFF' | 'TEAM'. */
  groupScope?: string;
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

      const bipartite = data.map((c: Record<string, unknown>): AthleteThreadData => {
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

      // ── Branche GROUP (vrai groupe chat) ──────────────────────────
      // Les GROUP ont athlete_id NULL (participants bipartites NULL) →
      // invisibles à la query .eq("athlete_id", …). On les charge via ma
      // membership matérialisée : conversation_participants WHERE user_id=me.
      const groupThreads = await loadGroupThreads(supabase, userId);

      return [...bipartite, ...groupThreads].sort(
        (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime(),
      );
    },
    enabled: !!userId,
    // Fix #4 : rafraîchit l'inbox au premier plan pour qu'une diffusion reçue
    // apparaisse sans action manuelle (la publication realtime n'inclut pas
    // `messages` en prod). refetchOnWindowFocus complète resume/visibilitychange.
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });
}

/* ═══════════════════════════════════════════════════════════════
   loadGroupThreads — les conversations GROUP dont l'athlète est membre.

   Le "dernier message visible" est viewer-aware GRATUITEMENT : la RLS
   messages filtre déjà (l'athlète ne voit que audience='ALL' + ses
   propres envois — la réponse privée d'un coéquipier est masquée), donc
   une query messages normale (ordre desc) renvoie déjà le bon sous-
   ensemble → on prend le premier par conversation. Idem pour les non-lus
   (created_at > mon last_read_at, sender <> moi, sur le même sous-ensemble).
═══════════════════════════════════════════════════════════════ */
async function loadGroupThreads(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<AthleteThreadData[]> {
  const { data: cpRows } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);
  const groupIds = [...new Set((cpRows || []).map((r) => (r as Record<string, unknown>).conversation_id as string))];
  if (groupIds.length === 0) return [];

  const lastReadMap = new Map<string, string | null>();
  for (const r of (cpRows || []) as { conversation_id: string; last_read_at: string | null }[]) {
    lastReadMap.set(r.conversation_id, r.last_read_at);
  }

  const { data: groupConvs } = await supabase
    .from("conversations")
    .select("id, conversation_type, group_scope, group_name, status, last_message_at, created_at")
    .in("id", groupIds)
    .eq("conversation_type", "GROUP");
  if (!groupConvs || groupConvs.length === 0) return [];

  const gConvIds = groupConvs.map((c: Record<string, unknown>) => c.id as string);
  const gLastMsg = new Map<string, string>();
  const gLastAt = new Map<string, string>();
  const gLastSender = new Map<string, string>();
  const gUnread = new Map<string, number>();
  const gMeReplied = new Map<string, boolean>();
  const gOtherReplied = new Map<string, boolean>();
  if (gConvIds.length > 0) {
    const { data: gMsgs } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at, sender_id")
      .in("conversation_id", gConvIds)
      .order("created_at", { ascending: false });
    for (const m of (gMsgs || []) as { conversation_id: string; content: string; created_at: string; sender_id: string }[]) {
      if (!gLastMsg.has(m.conversation_id)) {
        gLastMsg.set(m.conversation_id, m.content);
        gLastAt.set(m.conversation_id, m.created_at);
        gLastSender.set(m.conversation_id, m.sender_id);
      }
      if (m.sender_id === userId) gMeReplied.set(m.conversation_id, true);
      else gOtherReplied.set(m.conversation_id, true);
      const lr = lastReadMap.get(m.conversation_id) ?? null;
      if (m.sender_id !== userId && (!lr || m.created_at > lr)) {
        gUnread.set(m.conversation_id, (gUnread.get(m.conversation_id) || 0) + 1);
      }
    }
  }

  return (groupConvs as Record<string, unknown>[]).map((c): AthleteThreadData => {
    const id = c.id as string;
    return {
      id,
      conversationType: "GROUP",
      isGroup: true,
      groupName: (c.group_name as string) || "Groupe",
      groupScope: (c.group_scope as string) || "",
      coachId: "",
      coachName: (c.group_name as string) || "Groupe",
      coachInitials: "",
      coachPhotoUrl: null,
      coachRole: "",
      coachSchool: "",
      hasCoachName: false,
      lastMessage: gLastMsg.get(id) || "",
      lastMessageAt: (gLastAt.get(id) as string) || (c.last_message_at as string) || (c.created_at as string) || "",
      lastSenderId: gLastSender.get(id) ?? null,
      unreadCount: gUnread.get(id) || 0,
      status: (c.status as string) || "ACTIVE",
      threadStatus: mapDbStatus(c.status as string, gMeReplied.get(id), gOtherReplied.get(id)),
    };
  });
}
