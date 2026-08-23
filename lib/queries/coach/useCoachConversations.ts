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
import { fetchServiceIdentity, SERVICE_IDENTITY_FALLBACK, SERVICE_IDENTITY_ROLE_LABEL } from "@/lib/messaging/serviceIdentity";

export interface CoachThreadData {
  id: string;
  /** 'RECRUTEUR_COACH' (default) | 'ATHLETE_COACH' | 'COACH_COACH' | 'GROUP'. */
  conversationType: string;
  /** Broadcast (Annonce) pseudo-thread — folds N member threads into one row. */
  isBroadcast?: boolean;
  broadcastId?: string;
  targetLabel?: string;
  recipientCount?: number;
  /** Vrai groupe chat (conversation_type='GROUP'). Une conversation = UNE row
      (avatar de groupe générique + groupName + dernier message visible). */
  isGroup?: boolean;
  /** group_name (ex "Équipe Dragons Juvenile" / "Staff — École X"). */
  groupName?: string;
  /** group_scope : 'STAFF' | 'TEAM'. */
  groupScope?: string;
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
          coach_id, coach_b_id, parent_id, admin_id,
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

      // ADMIN_USER — l'identité de service. Fetch séparé (ambiguïté de FK
      // PostgREST : `conversations` embarque déjà users!recruiter_id).
      const hasAdminThread = data.some((c: Record<string, unknown>) => c.conversation_type === "ADMIN_USER");
      const serviceIdentity = hasAdminThread
        ? (await fetchServiceIdentity(supabase)) ?? SERVICE_IDENTITY_FALLBACK
        : SERVICE_IDENTITY_FALLBACK;

      const threads = data.map((c: Record<string, unknown>): CoachThreadData => {
        const recRaw = c.recruiter;
        const rec = (Array.isArray(recRaw) ? recRaw[0] : recRaw) as Record<string, unknown> | null;
        const recSchoolRaw = rec?.schools;
        const recSchool = (Array.isArray(recSchoolRaw) ? recSchoolRaw[0] : recSchoolRaw) as { name?: string } | null;
        const athRaw = c.athlete;
        const ath = (Array.isArray(athRaw) ? athRaw[0] : athRaw) as Record<string, unknown> | null;
        const posRaw = ath?.positions;
        const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string } | null;

        const isNexus = (c.conversation_type as string) === "ADMIN_USER";
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
          recruiterId: isNexus ? ((c.admin_id as string) || "") : (rec?.id as string) || "",
          /* La contrepartie d'un fil de service voyage dans les champs
             `recruiter*`, comme celle d'un COACH_COACH ou d'un PARENT_COACH :
             le pipeline recherche/tri/statut reste inchangé. Sans ça, le repli
             « Recruteur » s'afficherait — une fausse identité. */
          recruiterName: isNexus ? serviceIdentity.name : `${rf} ${rl}`.trim() || "Recruteur",
          recruiterInitials: isNexus ? serviceIdentity.initials : `${rf[0] || ""}${rl[0] || ""}`.toUpperCase(),
          recruiterPhotoUrl: isNexus ? serviceIdentity.photoUrl : (rec?.photo_url as string) || (rec?.avatar_url as string) || null,
          recruiterCegep: isNexus ? SERVICE_IDENTITY_ROLE_LABEL : recSchool?.name || "",
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

      // ── Branche GROUP (vrai groupe chat) ──────────────────────────
      // Les GROUP n'ont ni coach_id ni coach_b_id (participants bipartites
      // NULL) → invisibles à la query .or ci-dessus. On les charge via ma
      // membership matérialisée : conversation_participants WHERE user_id=me →
      // conversation_id[] (+ mon last_read_at pour les non-lus).
      const groupThreads = await loadGroupThreads(supabase, userId);

      // Fusion + tri unique par dernier message (desc). Un GROUP = UNE row.
      return [...threads, ...groupThreads].sort(
        (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime(),
      );
    },
    enabled: !!userId,
  });
}

/* ═══════════════════════════════════════════════════════════════
   loadGroupThreads — les conversations GROUP dont je suis membre.

   Le "dernier message visible" est viewer-aware GRATUITEMENT : la RLS
   messages filtre déjà (staff = tout ; athlète = audience='ALL' + ses
   propres envois), donc une query messages normale (ordre desc) sous
   l'identité du viewer renvoie déjà le bon sous-ensemble → on prend le
   premier par conversation. Idem pour les non-lus (comptés sur le même
   sous-ensemble RLS-filtré : created_at > mon last_read_at, sender <> moi).
═══════════════════════════════════════════════════════════════ */
async function loadGroupThreads(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<CoachThreadData[]> {
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
      const lr = lastReadMap.get(m.conversation_id) ?? null;
      if (m.sender_id !== userId && (!lr || m.created_at > lr)) {
        gUnread.set(m.conversation_id, (gUnread.get(m.conversation_id) || 0) + 1);
      }
    }
  }

  return (groupConvs as Record<string, unknown>[]).map((c): CoachThreadData => {
    const id = c.id as string;
    return {
      id,
      conversationType: "GROUP",
      isGroup: true,
      groupName: (c.group_name as string) || "Groupe",
      groupScope: (c.group_scope as string) || "",
      otherCoachName: "", otherCoachInitials: "", otherCoachIsDirector: false, otherCoachPhotoUrl: null,
      parentName: "", parentInitials: "", parentPhotoUrl: null,
      recruiterId: "", recruiterName: "", recruiterInitials: "", recruiterPhotoUrl: null, recruiterCegep: "",
      athleteId: "", athleteName: "", athleteInitials: "", athletePhotoUrl: null, athletePosition: "",
      lastMessage: gLastMsg.get(id) || "",
      lastMessageAt: (gLastAt.get(id) as string) || (c.last_message_at as string) || (c.created_at as string) || "",
      lastSenderId: gLastSender.get(id) ?? null,
      unreadCount: gUnread.get(id) || 0,
      status: (c.status as string) || "ACTIVE",
    };
  });
}
