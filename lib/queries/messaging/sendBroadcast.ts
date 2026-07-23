/* ═══════════════════════════════════════════════════════════════
   sendBroadcast — "Groupe" diffusion via the send_broadcast RPC
   (migration 20260723140000). One call → N individual 1-on-1 threads,
   gated per-recipient server-side. Returns how many were sent.

   Audience shapes:
     coach sender  → { kind:'coaches', ids:[coachId] } | { kind:'all_coaches' }
                     | { kind:'athletes', ids:[athleteId] } | { kind:'all_athletes' }
                     | { kind:'team', team_id }
     recruiter     → { kind:'favorited_coaches' }
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
