/* ═══════════════════════════════════════════════════════════════
   createGroup — ouvre (ou crée) LE groupe d'une entité via le RPC
   DEFINER `create_group` (migration 20260730110000), qui seed les
   participants selon l'autorité légale (mineur-safety). Remplace
   sendBroadcast pour le chemin « Groupe ».

   audience :
     { kind: 'team', team_id }   → GROUP TEAM (hybride : staff + athlètes ;
                                    réponses athlètes visibles staff seulement)
     { kind: 'all_coaches' }     → GROUP STAFF (tous les coachs de l'école,
                                    symétrique)
═══════════════════════════════════════════════════════════════ */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type GroupAudience =
  | { kind: "team"; team_id: string }
  | { kind: "all_coaches" };

export interface CreateGroupResult {
  conversationId?: string;
  created?: boolean;
  error?: PostgrestError | { message: string; code?: string };
}

export async function createGroup(
  supabase: SupabaseClient,
  audience: GroupAudience,
): Promise<CreateGroupResult> {
  const { data, error } = await supabase.rpc("create_group", { p_audience: audience });
  if (error) return { error };
  const res = (data ?? {}) as { conversation_id?: string; created?: boolean };
  return { conversationId: res.conversation_id, created: res.created };
}

/* Groupe CUSTOM (ad-hoc, #2) : nom libre + sélection de membres (user_id) DU
   PÉRIMÈTRE de l'expéditeur (coach = ses athlètes + staff école ; directeur =
   toute l'école). Le RPC valide chaque membre et ignore les hors-périmètre ;
   member_role est déduit serveur (athlète → ATHLETE, coach → STAFF). La
   visibilité suit la composition (un ATHLETE dedans → réponses staff-seulement). */
export async function createCustomGroup(
  supabase: SupabaseClient,
  name: string,
  memberUserIds: string[],
): Promise<CreateGroupResult & { seeded?: number }> {
  const { data, error } = await supabase.rpc("create_custom_group", {
    p_name: name,
    p_member_ids: memberUserIds,
  });
  if (error) return { error };
  const res = (data ?? {}) as { conversation_id?: string; seeded?: number };
  return { conversationId: res.conversation_id, seeded: res.seeded };
}
