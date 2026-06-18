/* ═══════════════════════════════════════════════════════════════
   createCoachConversation — shared data-layer for coach-initiated
   conversations (Phase A).

   Consumed by BOTH surfaces in Phase B/C :
   - app/coach/demandes/nouveau/page.tsx   (web)
   - a future CoachDemandesNouveauMobile   (Capacitor)

   Why a shared function : the existing /coach/demandes/nouveau page
   has three latent bugs that this layer fixes once, for both
   surfaces :
     1. status: "envoye"  → violates conversations_status_check
        (valid : 'ACTIVE' | 'ARCHIVE'). We always write 'ACTIVE'.
     2. convError destructured but never checked → silent RLS denial
        masked by a hard-coded success toast. We return { error } and
        the caller branches on it.
     3. No recruiter notification → handled here for free : the
        existing log_coach_reply trigger (SECURITY DEFINER, owned by
        postgres) fires AFTER INSERT on messages when sender_id =
        c.coach_id, and writes a COACH_REPLY row into
        recruiter_activity_log. So inserting the first message IS
        the notification — no extra write needed in app code.

   RLS expectations (from the companion migration
   20260614100000_coach_conversations_insert.sql) :
   - conversations INSERT : coach_id = auth.uid() AND athlete is on
     the coach's roster (athletes.coach_id = auth.uid()). Recruiter
     unconstrained.
   - messages INSERT : the messages_insert policy from
     20260418090000_phase2a_rls_tier_gates_p0.sql already allows a
     COACH role to insert into messages for a conversation they're a
     participant of.

   Pure data layer : takes a SupabaseClient + params, returns
   { conversationId?, error? }. No router, no toasts, no caches.
   Callers handle navigation + ["conversations"] invalidation.
═══════════════════════════════════════════════════════════════ */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export interface CreateCoachConversationParams {
  /** auth.uid() of the coach initiating. */
  coachUserId: string;
  /** Any recruiter user id (no roster constraint). */
  recruiterId: string;
  /** Must be one of the coach's own athletes (enforced by RLS). */
  athleteId: string;
  /** First message body — trimmed inside ; empty/whitespace rejected. */
  message: string;
}

export interface CreateCoachConversationResult {
  conversationId?: string;
  error?: PostgrestError | { message: string; code?: string };
}

export async function createCoachConversation(
  supabase: SupabaseClient,
  params: CreateCoachConversationParams,
): Promise<CreateCoachConversationResult> {
  const { coachUserId, recruiterId, athleteId, message } = params;

  /* ── 1. Validate inputs ──────────────────────────────────── */
  if (!coachUserId) return { error: { message: "Coach manquant (non authentifié)." } };
  if (!recruiterId) return { error: { message: "Recruteur manquant." } };
  if (!athleteId)   return { error: { message: "Athlète manquant." } };
  const trimmed = message.trim();
  if (!trimmed) return { error: { message: "Message vide." } };

  const nowIso = new Date().toISOString();

  /* ── 2. Insert the conversation row ──────────────────────── */
  // status is 'ACTIVE' (canon — only ACTIVE/ARCHIVE pass the table
  // CHECK constraint). The legacy "envoye" string from the desktop
  // page silently violated the check.
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({
      coach_id: coachUserId,
      recruiter_id: recruiterId,
      athlete_id: athleteId,
      status: "ACTIVE",
      last_message_at: nowIso,
    })
    .select("id")
    .single();

  if (convError || !conv) {
    return { error: convError ?? { message: "Création de la conversation échouée." } };
  }

  const conversationId = conv.id as string;

  /* ── 3. Insert the first message ─────────────────────────── */
  // This INSERT triggers log_coach_reply (AFTER INSERT on messages),
  // which inserts a COACH_REPLY row into recruiter_activity_log →
  // the recruiter's notification feed picks it up. No app-layer
  // notification write needed.
  const { error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: coachUserId,
      content: trimmed,
    })
    .select("id")
    .single();

  if (msgError) {
    // Surface the message-side error to the caller. Note : the
    // conversation row was created and is left in place ; the user
    // can retry sending the first message inside the empty thread.
    return { conversationId, error: msgError };
  }

  return { conversationId };
}
