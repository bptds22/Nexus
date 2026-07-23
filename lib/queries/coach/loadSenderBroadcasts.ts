/* ═══════════════════════════════════════════════════════════════
   loadSenderBroadcasts — Annonce (consolidated sender view)

   Delivery stays N private 1-on-1 threads (migration 20260723140000).
   The SENDER's inbox, however, must NOT show N rows for one broadcast.
   These loaders fold every broadcast the sender emitted into ONE
   "Annonce · [cible] · Envoyé à N" entry, and expose the set of member
   conversation ids so the inbox can DROP those N rows (they're replaced
   by the single Annonce entry — no double-clutter).

   Two loaders, shared by web (/coach/demandes) + mobile
   (useCoachConversations) :
     - loadSenderBroadcastSummaries → inbox list (counts + label + last
       activity ; no per-recipient identity resolution).
     - loadAnnonceDetail → the Annonce view (announcement once + every
       recipient's replies, each linking back into its 1-on-1 thread).

   The N underlying threads stay individually accessible (opening a
   recipient from the Annonce routes into /coach/demandes/[convId]).
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Human label for a broadcast audience (jsonb → French). */
export function broadcastTargetLabel(
  audience: Record<string, unknown> | null,
  teamNames?: Map<string, string>,
): string {
  const kind = (audience?.kind as string) || "";
  const ids = Array.isArray(audience?.ids) ? (audience!.ids as unknown[]) : [];
  switch (kind) {
    case "all_athletes":
      return "Tous les athlètes";
    case "athletes":
      return `${ids.length} athlète${ids.length > 1 ? "s" : ""}`;
    case "team":
      return teamNames?.get(audience?.team_id as string) || "Une équipe";
    case "all_coaches":
      return "Tous les entraîneurs";
    case "coaches":
      return `${ids.length} entraîneur${ids.length > 1 ? "s" : ""}`;
    case "favorited_coaches":
      return "Coachs favoris";
    default:
      return "Diffusion";
  }
}

export interface AnnonceSummary {
  broadcastId: string;
  targetLabel: string;
  recipientCount: number;
  /** The announcement body (identical across every member thread). */
  content: string;
  createdAt: string;
  /** max(createdAt, latest reply) — sorts the Annonce among the inbox. */
  lastActivityAt: string;
  /** Replies received across all member threads still unread by the sender. */
  unreadReplies: number;
  replyCount: number;
}

/**
 * Inbox summaries + the set of conversation ids that belong to a broadcast.
 * The caller REMOVES memberConvIds from the normal thread list and renders
 * one Annonce row per summary instead.
 */
export async function loadSenderBroadcastSummaries(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ annonces: AnnonceSummary[]; memberConvIds: Set<string> }> {
  const memberConvIds = new Set<string>();

  const { data: broadcasts } = await supabase
    .from("broadcasts")
    .select("id, audience, recipient_count, created_at")
    .eq("sender_id", userId)
    .order("created_at", { ascending: false });

  if (!broadcasts || broadcasts.length === 0) {
    return { annonces: [], memberConvIds };
  }

  const bIds = broadcasts.map((b: Record<string, unknown>) => b.id as string);

  // The sender's own copies carry broadcast_id → they map conversation → broadcast
  // and give us the announcement content.
  const { data: sentMsgs } = await supabase
    .from("messages")
    .select("conversation_id, broadcast_id, content")
    .in("broadcast_id", bIds)
    .eq("sender_id", userId);

  const contentByB = new Map<string, string>();
  const convToB = new Map<string, string>();
  for (const m of (sentMsgs || []) as Record<string, unknown>[]) {
    const b = m.broadcast_id as string;
    const c = m.conversation_id as string;
    convToB.set(c, b);
    memberConvIds.add(c);
    if (!contentByB.has(b)) contentByB.set(b, (m.content as string) || "");
  }

  // Replies (anything the sender didn't write) inside those member threads.
  // replyCount = recipients who replied (distinct member threads with >=1
  // reply), matching the Annonce detail's "N reponse(s)" — NOT raw message
  // count, so the inbox badge and the detail header agree.
  const lastActivityByB = new Map<string, string>();
  const unreadByB = new Map<string, number>();
  const repliedConvsByB = new Map<string, Set<string>>();
  if (memberConvIds.size > 0) {
    const { data: replies } = await supabase
      .from("messages")
      .select("conversation_id, created_at, sender_id, read_at")
      .in("conversation_id", [...memberConvIds])
      .neq("sender_id", userId);
    for (const m of (replies || []) as Record<string, unknown>[]) {
      const c = m.conversation_id as string;
      const b = convToB.get(c);
      if (!b) continue;
      const at = (m.created_at as string) || "";
      if (!lastActivityByB.has(b) || at > (lastActivityByB.get(b) as string)) {
        lastActivityByB.set(b, at);
      }
      (repliedConvsByB.get(b) ?? repliedConvsByB.set(b, new Set()).get(b)!).add(c);
      if (!m.read_at) unreadByB.set(b, (unreadByB.get(b) || 0) + 1);
    }
  }

  // Resolve team names for {kind:'team'} labels.
  const teamIds = [...new Set(
    broadcasts
      .map((b: Record<string, unknown>) => (b.audience as Record<string, unknown> | null)?.team_id)
      .filter(Boolean) as string[],
  )];
  const teamNames = new Map<string, string>();
  if (teamIds.length > 0) {
    const { data: teams } = await supabase.from("teams").select("id, name").in("id", teamIds);
    for (const t of (teams || []) as Record<string, unknown>[]) {
      teamNames.set(t.id as string, (t.name as string) || "");
    }
  }

  const annonces: AnnonceSummary[] = broadcasts.map((b: Record<string, unknown>) => {
    const id = b.id as string;
    const createdAt = (b.created_at as string) || "";
    return {
      broadcastId: id,
      targetLabel: broadcastTargetLabel(b.audience as Record<string, unknown> | null, teamNames),
      recipientCount: (b.recipient_count as number) || 0,
      content: contentByB.get(id) || "",
      createdAt,
      lastActivityAt: (() => {
        const reply = lastActivityByB.get(id);
        return reply && reply > createdAt ? reply : createdAt;
      })(),
      unreadReplies: unreadByB.get(id) || 0,
      replyCount: repliedConvsByB.get(id)?.size || 0,
    };
  });

  return { annonces, memberConvIds };
}

/* ── Detail (the Annonce view) ─────────────────────────────────── */

export interface AnnonceRecipient {
  conversationId: string;
  kind: "athlete" | "coach" | "recruiter";
  name: string;
  initials: string;
  photoUrl: string | null;
  /** Latest reply preview (null → recipient hasn't replied). */
  lastReply: string | null;
  lastReplyAt: string | null;
  replyCount: number;
  hasUnread: boolean;
}

export interface AnnonceDetail {
  broadcastId: string;
  targetLabel: string;
  recipientCount: number;
  content: string;
  createdAt: string;
  recipients: AnnonceRecipient[];
}

/**
 * Full Annonce view : the announcement once + every recipient (with their
 * replies). RLS lets the sender read broadcasts.sender_id = auth.uid() and
 * the member conversations they own, so this is safe for the sender only.
 */
export async function loadAnnonceDetail(
  supabase: SupabaseClient,
  userId: string,
  broadcastId: string,
): Promise<AnnonceDetail | null> {
  const { data: b } = await supabase
    .from("broadcasts")
    .select("id, sender_id, audience, recipient_count, created_at")
    .eq("id", broadcastId)
    .maybeSingle();
  if (!b || (b as Record<string, unknown>).sender_id !== userId) return null;

  const audience = (b as Record<string, unknown>).audience as Record<string, unknown> | null;
  let targetLabel = broadcastTargetLabel(audience, undefined);
  if (audience?.kind === "team" && audience?.team_id) {
    const { data: team } = await supabase.from("teams").select("name").eq("id", audience.team_id as string).maybeSingle();
    if (team) targetLabel = ((team as Record<string, unknown>).name as string) || targetLabel;
  }

  // Member conversations + the announcement content.
  const { data: sentMsgs } = await supabase
    .from("messages")
    .select("conversation_id, content")
    .eq("broadcast_id", broadcastId)
    .eq("sender_id", userId);
  const convIds = [...new Set((sentMsgs || []).map((m: Record<string, unknown>) => m.conversation_id as string))];
  const content = ((sentMsgs || [])[0] as Record<string, unknown> | undefined)?.content as string || "";

  if (convIds.length === 0) {
    return {
      broadcastId,
      targetLabel,
      recipientCount: ((b as Record<string, unknown>).recipient_count as number) || 0,
      content,
      createdAt: ((b as Record<string, unknown>).created_at as string) || "",
      recipients: [],
    };
  }

  // The member conversations (to identify each recipient).
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, conversation_type, coach_id, coach_b_id, recruiter_id, athlete_id")
    .in("id", convIds);

  // Resolve recipient identities in bulk.
  const athleteIds = new Set<string>();
  const userIds = new Set<string>();
  for (const c of (convs || []) as Record<string, unknown>[]) {
    const type = c.conversation_type as string;
    if (type === "ATHLETE_COACH" && c.athlete_id) athleteIds.add(c.athlete_id as string);
    else if (type === "COACH_COACH") {
      const other = c.coach_id === userId ? c.coach_b_id : c.coach_id;
      if (other) userIds.add(other as string);
    } else if (type === "RECRUTEUR_COACH" && c.recruiter_id) userIds.add(c.recruiter_id as string);
  }

  const athleteMap = new Map<string, { name: string; photo: string | null }>();
  if (athleteIds.size > 0) {
    const { data: aths } = await supabase.from("athletes").select("id, first_name, last_name, photo_url").in("id", [...athleteIds]);
    for (const a of (aths || []) as Record<string, unknown>[]) {
      athleteMap.set(a.id as string, {
        name: `${a.first_name || ""} ${a.last_name || ""}`.trim() || "Athlète",
        photo: (a.photo_url as string) || null,
      });
    }
  }
  const userMap = new Map<string, { name: string }>();
  if (userIds.size > 0) {
    const { data: us } = await supabase.from("users").select("id, first_name, last_name").in("id", [...userIds]);
    for (const u of (us || []) as Record<string, unknown>[]) {
      userMap.set(u.id as string, { name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Contact" });
    }
  }

  // Replies per member conversation.
  const { data: replies } = await supabase
    .from("messages")
    .select("conversation_id, content, created_at, sender_id, read_at")
    .in("conversation_id", convIds)
    .neq("sender_id", userId)
    .order("created_at", { ascending: true });
  const replyByConv = new Map<string, { content: string; at: string; count: number; unread: boolean }>();
  for (const m of (replies || []) as Record<string, unknown>[]) {
    const c = m.conversation_id as string;
    const prev = replyByConv.get(c);
    const unread = prev?.unread || !m.read_at;
    replyByConv.set(c, {
      content: (m.content as string) || "",
      at: (m.created_at as string) || "",
      count: (prev?.count || 0) + 1,
      unread,
    });
  }

  const recipients: AnnonceRecipient[] = (convs || []).map((c: Record<string, unknown>) => {
    const type = c.conversation_type as string;
    let kind: AnnonceRecipient["kind"] = "athlete";
    let name = "Contact";
    let photo: string | null = null;
    if (type === "ATHLETE_COACH") {
      kind = "athlete";
      const a = athleteMap.get(c.athlete_id as string);
      name = a?.name || "Athlète";
      photo = a?.photo || null;
    } else if (type === "COACH_COACH") {
      kind = "coach";
      const other = c.coach_id === userId ? c.coach_b_id : c.coach_id;
      name = userMap.get(other as string)?.name || "Coach";
    } else if (type === "RECRUTEUR_COACH") {
      kind = "recruiter";
      name = userMap.get(c.recruiter_id as string)?.name || "Recruteur";
    }
    const r = replyByConv.get(c.id as string);
    const parts = name.split(" ");
    return {
      conversationId: c.id as string,
      kind,
      name,
      initials: `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "?",
      photoUrl: photo,
      lastReply: r?.content ?? null,
      lastReplyAt: r?.at ?? null,
      replyCount: r?.count ?? 0,
      hasUnread: r?.unread ?? false,
    };
  });

  // Replied recipients first (most recent), then the silent ones.
  recipients.sort((a, b) => {
    if (!!a.lastReplyAt !== !!b.lastReplyAt) return a.lastReplyAt ? -1 : 1;
    if (a.lastReplyAt && b.lastReplyAt) return b.lastReplyAt.localeCompare(a.lastReplyAt);
    return a.name.localeCompare(b.name);
  });

  return {
    broadcastId,
    targetLabel,
    recipientCount: ((b as Record<string, unknown>).recipient_count as number) || 0,
    content,
    createdAt: ((b as Record<string, unknown>).created_at as string) || "",
    recipients,
  };
}
