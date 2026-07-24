/* ═══════════════════════════════════════════════════════════════
   findOrCreateRecruiterConversation — iter 7.8e-UI Section D
   Trouve ou crée la conversation (recruiter, coach, athlete) côté
   client (SELECT → INSERT si manquant). Surfaces les erreurs RLS
   tier-related comme `tierDenial: true` pour que le caller puisse
   pointer vers le paywall plutôt qu'un toast générique.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";

export interface FindOrCreateInput {
  coachId: string;
  athleteId: string;
}

export type FindOrCreateResult =
  | { ok: true; conversationId: string; created: boolean }
  | { ok: false; tierDenial: boolean; error: string };

export async function findOrCreateRecruiterConversation(
  input: FindOrCreateInput,
): Promise<FindOrCreateResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, tierDenial: false, error: "Non authentifié." };

  const { data: existing, error: selectErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("recruiter_id", user.id)
    .eq("coach_id", input.coachId)
    .eq("athlete_id", input.athleteId)
    .maybeSingle();

  if (selectErr) {
    return { ok: false, tierDenial: false, error: selectErr.message };
  }
  if (existing) {
    return { ok: true, conversationId: existing.id, created: false };
  }

  const { data: newConv, error: insertErr } = await supabase
    .from("conversations")
    .insert({
      recruiter_id: user.id,
      coach_id: input.coachId,
      athlete_id: input.athleteId,
      status: "ACTIVE",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !newConv) {
    const tierDenial =
      insertErr?.code === "42501" ||
      /permission denied|row-level security|policy/i.test(insertErr?.message ?? "");
    return {
      ok: false,
      tierDenial,
      error: tierDenial
        ? "L'envoi de messages nécessite un abonnement Pro."
        : insertErr?.message || "Impossible de créer la conversation.",
    };
  }

  return { ok: true, conversationId: newConv.id, created: true };
}

/* ═══════════════════════════════════════════════════════════════
   findOrCreateRecruiterAthleteConversation — P3 recruteur→athlète
   (migration 20260722110100). Recruiter initiates a RECRUTEUR_ATHLETE
   thread (coach_id NULL). RLS gates it on the athlete being in the
   recruiter's favorites + eligibility(stub) + no active blackout — the
   UI enforces the favorite-first prompt before ever calling this. The
   conversation INSERT fires the first-contact notification (coach +
   parent); the recruiter's first message (Pro-gated) advances pipeline
   to CONTACTE.
═══════════════════════════════════════════════════════════════ */

export async function findOrCreateRecruiterAthleteConversation(
  athleteId: string,
): Promise<FindOrCreateResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, tierDenial: false, error: "Non authentifié." };

  const { data: existing, error: selectErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("conversation_type", "RECRUTEUR_ATHLETE")
    .eq("recruiter_id", user.id)
    .eq("athlete_id", athleteId)
    .maybeSingle();

  if (selectErr) return { ok: false, tierDenial: false, error: selectErr.message };
  if (existing) return { ok: true, conversationId: existing.id, created: false };

  const { data: newConv, error: insertErr } = await supabase
    .from("conversations")
    .insert({
      conversation_type: "RECRUTEUR_ATHLETE",
      recruiter_id: user.id,
      athlete_id: athleteId,
      status: "ACTIVE",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !newConv) {
    const blackout = /black-out|blackout/i.test(insertErr?.message ?? "");
    const tierDenial =
      insertErr?.code === "42501" ||
      /permission denied|row-level security|policy/i.test(insertErr?.message ?? "");
    return {
      ok: false,
      tierDenial,
      error: blackout
        ? "La messagerie est temporairement suspendue par la ligue (période de black-out)."
        : tierDenial
          ? "Tu dois ajouter cet athlète à tes favoris pour le contacter."
          : insertErr?.message || "Impossible de créer la conversation.",
    };
  }

  return { ok: true, conversationId: newConv.id, created: true };
}
