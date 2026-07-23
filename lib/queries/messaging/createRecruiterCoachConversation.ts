/* ═══════════════════════════════════════════════════════════════
   findOrCreateRecruiterCoachConversation — COACH-initiated
   RECRUTEUR_COACH thread (favoris-symmetric, migration 20260723130000).

   Reuses the RECRUTEUR_COACH type (recruiter_id + coach_id=self +
   athlete_id). RLS (coach_initiate_recruteur_coach) only allows it when
   the recruiter favorited the anchor athlete AND the anchor is the
   coach's own athlete. First message is written in the thread view.

   Pure data layer : { conversationId?, error? }.
═══════════════════════════════════════════════════════════════ */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export interface RecruiterCoachParams {
  selfId: string;       // coach auth.uid()
  recruiterId: string;  // interested recruiter
  athleteId: string;    // favorited athlete (anchor, NOT NULL)
}

export interface RecruiterCoachResult {
  conversationId?: string;
  error?: PostgrestError | { message: string; code?: string };
}

export async function findOrCreateRecruiterCoachConversation(
  supabase: SupabaseClient,
  { selfId, recruiterId, athleteId }: RecruiterCoachParams,
): Promise<RecruiterCoachResult> {
  if (!selfId) return { error: { message: "Coach manquant (non authentifié)." } };
  if (!recruiterId) return { error: { message: "Recruteur manquant." } };
  if (!athleteId) return { error: { message: "Athlète manquant." } };

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("conversation_type", "RECRUTEUR_COACH")
    .eq("recruiter_id", recruiterId)
    .eq("coach_id", selfId)
    .eq("athlete_id", athleteId)
    .limit(1);
  if (existing && existing.length > 0) return { conversationId: (existing[0] as { id: string }).id };

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({
      conversation_type: "RECRUTEUR_COACH",
      recruiter_id: recruiterId,
      coach_id: selfId,
      athlete_id: athleteId,
      status: "ACTIVE",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !conv) return { error: error ?? { message: "Création de la conversation échouée." } };
  return { conversationId: conv.id as string };
}
