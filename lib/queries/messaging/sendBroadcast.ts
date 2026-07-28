/* ═══════════════════════════════════════════════════════════════
   sendBroadcast — diffusion via the send_broadcast RPC
   (migration 20260723140000). One call → N individual 1-on-1 threads,
   gated per-recipient server-side. Returns how many were sent.

   ⚠️ DÉPRÉCIÉ pour le chemin coach → équipe / entraîneurs.
   Le vrai chat de groupe (RPC create_group, cf. lib/queries/messaging/
   createGroup.ts) remplace la diffusion pour les audiences coach :
     { kind:'team', team_id }  et  { kind:'all_coaches' }.
   GroupeCompose n'appelle plus sendBroadcast que pour la SEULE branche
   encore sans groupe : le recruteur → { kind:'favorited_coaches' }.
   Ne pas rebrancher les audiences coach ici — utiliser createGroup.

   Audience shapes (le RPC en accepte encore plusieurs, mais seul
   favorited_coaches reste câblé côté UI) :
     coach sender  → { kind:'coaches', ids:[coachId] } | { kind:'all_coaches' }
                     | { kind:'athletes', ids:[athleteId] } | { kind:'all_athletes' }
                     | { kind:'team', team_id }        (dépréciés côté UI)
     recruiter     → { kind:'favorited_coaches' }      (seul chemin actif)
═══════════════════════════════════════════════════════════════ */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type BroadcastAudience =
  | { kind: "coaches"; ids: string[] }
  | { kind: "all_coaches" }
  | { kind: "athletes"; ids: string[] }
  | { kind: "all_athletes" }
  | { kind: "team"; team_id: string }
  | { kind: "favorited_coaches" };

export interface BroadcastResult {
  sent?: number;
  broadcastId?: string;
  error?: PostgrestError | { message: string; code?: string };
}

export async function sendBroadcast(
  supabase: SupabaseClient,
  audience: BroadcastAudience,
  content: string,
): Promise<BroadcastResult> {
  const { data, error } = await supabase.rpc("send_broadcast", {
    p_audience: audience,
    p_content: content,
  });
  if (error) return { error };
  const res = (data ?? {}) as { sent?: number; broadcast_id?: string };
  return { sent: res.sent ?? 0, broadcastId: res.broadcast_id };
}
