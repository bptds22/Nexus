/* ═══════════════════════════════════════════════════════════════
   findOrCreateCoachCoachConversation — coach↔coach (P4) thread.

   Mirrors findOrCreateAthleteCoachConversation : pick recipient
   (+ optional attached athlete), find-or-create the thread, then the
   caller routes into it (the first message is written in the thread
   view, like the athlete↔coach flow).

   Dedup matches the DB unique index uq_conversations_coach_coach
   (unordered coach pair + athlete-slot, athlete NULL = its own slot).
   RLS (coach_coach_conversations_insert) enforces same-school staff +
   optional athlete belonging to the initiator's school.

   Pure data layer : { conversationId?, error? }. No router/toast/cache.
═══════════════════════════════════════════════════════════════ */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export interface CoachCoachParams {
  /** auth.uid() of the initiating coach/director. */
  selfId: string;
  /** Recipient coach/director (same-school staff, ≠ self). */
  otherCoachId: string;
  /** Optional athlete context — null for a plain staff thread. */
  athleteId?: string | null;
}

export interface CoachCoachResult {
  conversationId?: string;
  error?: PostgrestError | { message: string; code?: string };
}

export async function findOrCreateCoachCoachConversation(
  supabase: SupabaseClient,
  params: CoachCoachParams,
): Promise<CoachCoachResult> {
  const { selfId, otherCoachId } = params;
  const athleteId = params.athleteId ?? null;

  if (!selfId) return { error: { message: "Coach manquant (non authentifié)." } };
  if (!otherCoachId) return { error: { message: "Destinataire manquant." } };
  if (otherCoachId === selfId) return { error: { message: "Impossible de s'écrire à soi-même." } };

  /* ── 1. Find existing (unordered pair, matching athlete-slot) ─── */
  const { data: existing } = await supabase
    .from("conversations")
    .select("id, coach_id, coach_b_id, athlete_id")
    .eq("conversation_type", "COACH_COACH")
    .or(
      `and(coach_id.eq.${selfId},coach_b_id.eq.${otherCoachId}),and(coach_id.eq.${otherCoachId},coach_b_id.eq.${selfId})`,
    );
  const match = (existing ?? []).find(
    (c) => ((c as { athlete_id: string | null }).athlete_id ?? null) === athleteId,
  );
  if (match) return { conversationId: (match as { id: string }).id };

  /* ── 2. Create ───────────────────────────────────────────────── */
  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({
      conversation_type: "COACH_COACH",
      coach_id: selfId,
      coach_b_id: otherCoachId,
      athlete_id: athleteId,
      status: "ACTIVE",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !conv) {
    return { error: error ?? { message: "Création de la conversation échouée." } };
  }
  return { conversationId: conv.id as string };
}
