/* ═══════════════════════════════════════════════════════════════
   findOrCreateAthleteCoachConversation — shared data-layer for
   ATHLETE_COACH threads (Phase B). Consumed by BOTH initiation paths:
   - athlete picks a coach/director (app/athlete/messages/nouveau)
   - coach clicks "Envoyer un message" on an athlete (Q4)

   Find-or-create : a partial unique (athlete_id, coach_id) WHERE
   conversation_type='ATHLETE_COACH' exists in DB, so at most one
   thread per (athlete, coach). We SELECT first (RLS lets each side
   read their own ATHLETE_COACH rows), INSERT if absent, and on a
   23505 race re-SELECT. recruiter_id is null (per the type CHECK).

   RLS (migrations 20260722100100 / 100000) :
   - athlete_conversations_insert : athlete owns athlete_id +
     athlete_messageable_coach(coach_id).
   - coach_athlete_conversations_insert : coach_id = auth.uid() +
     the athlete is at the coach's school/club.

   Pure data layer : SupabaseClient + params → { conversationId?, error? }.
═══════════════════════════════════════════════════════════════ */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export interface FindOrCreateAthleteCoachParams {
  athleteId: string;
  coachId: string;
}

export interface FindOrCreateAthleteCoachResult {
  conversationId?: string;
  error?: PostgrestError | { message: string; code?: string };
}

async function selectExisting(
  supabase: SupabaseClient,
  athleteId: string,
  coachId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("conversation_type", "ATHLETE_COACH")
    .eq("athlete_id", athleteId)
    .eq("coach_id", coachId)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function findOrCreateAthleteCoachConversation(
  supabase: SupabaseClient,
  params: FindOrCreateAthleteCoachParams,
): Promise<FindOrCreateAthleteCoachResult> {
  const { athleteId, coachId } = params;
  if (!athleteId) return { error: { message: "Athlète manquant." } };
  if (!coachId) return { error: { message: "Destinataire manquant." } };

  // 1. Existing thread?
  const existing = await selectExisting(supabase, athleteId, coachId);
  if (existing) return { conversationId: existing };

  // 2. Create (recruiter_id null — ATHLETE_COACH per the type CHECK).
  const { data: created, error: insErr } = await supabase
    .from("conversations")
    .insert({
      conversation_type: "ATHLETE_COACH",
      athlete_id: athleteId,
      coach_id: coachId,
      recruiter_id: null,
      status: "ACTIVE",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (!insErr && created) return { conversationId: created.id as string };

  // 3. Unique race (partial unique) → re-select the row the other write made.
  if ((insErr as PostgrestError | null)?.code === "23505") {
    const raced = await selectExisting(supabase, athleteId, coachId);
    if (raced) return { conversationId: raced };
  }

  return { error: insErr ?? { message: "Création de la conversation échouée." } };
}
