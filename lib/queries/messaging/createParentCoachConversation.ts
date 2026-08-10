/* ═══════════════════════════════════════════════════════════════
   findOrCreateParentCoachConversation — shared data-layer for
   PARENT_COACH threads (P2). Consumed by BOTH initiation paths:
   - parent picks their child + a staff member (app/parent/.../messages/nouveau)
   - coach picks one of their athletes + its linked parent (coach compose)

   Find-or-create : a partial unique (parent_id, coach_id, athlete_id)
   WHERE conversation_type='PARENT_COACH' exists in DB, so at most one
   thread per (parent, coach, child). SELECT first, INSERT if absent,
   re-SELECT on a 23505 race. recruiter_id / coach_b_id are null (type CHECK).

   RLS (migration 20260725120000):
   - parent_initiate_parent_coach : parent=self + is_parent_of(child) +
     coach ∈ the child's messageable staff (coach_reaches_athlete).
   - coach_initiate_parent_coach  : coach=self + parent is the child's real
     parent (is_parent_link) + coach ∈ the child's staff.

   Pure data layer : SupabaseClient + params → { conversationId?, error? }.
═══════════════════════════════════════════════════════════════ */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export interface FindOrCreateParentCoachParams {
  parentId: string;
  coachId: string;
  athleteId: string;
}

export interface FindOrCreateParentCoachResult {
  conversationId?: string;
  error?: PostgrestError | { message: string; code?: string };
}

async function selectExisting(
  supabase: SupabaseClient,
  parentId: string,
  coachId: string,
  athleteId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("conversation_type", "PARENT_COACH")
    .eq("parent_id", parentId)
    .eq("coach_id", coachId)
    .eq("athlete_id", athleteId)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function findOrCreateParentCoachConversation(
  supabase: SupabaseClient,
  params: FindOrCreateParentCoachParams,
): Promise<FindOrCreateParentCoachResult> {
  const { parentId, coachId, athleteId } = params;
  if (!parentId) return { error: { message: "Parent manquant." } };
  if (!coachId) return { error: { message: "Destinataire manquant." } };
  if (!athleteId) return { error: { message: "Enfant manquant." } };

  const existing = await selectExisting(supabase, parentId, coachId, athleteId);
  if (existing) return { conversationId: existing };

  const { data: created, error: insErr } = await supabase
    .from("conversations")
    .insert({
      conversation_type: "PARENT_COACH",
      parent_id: parentId,
      coach_id: coachId,
      athlete_id: athleteId,
      recruiter_id: null,
      status: "ACTIVE",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (!insErr && created) return { conversationId: created.id as string };

  if ((insErr as PostgrestError | null)?.code === "23505") {
    const raced = await selectExisting(supabase, parentId, coachId, athleteId);
    if (raced) return { conversationId: raced };
  }

  return { error: insErr ?? { message: "Création de la conversation échouée." } };
}
