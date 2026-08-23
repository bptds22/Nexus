/* ═══════════════════════════════════════════════════════════════
   countAthleteUnread — le compte de non-lus du badge « Messages »
   côté athlète. UNE implémentation, deux surfaces : la barre latérale
   web (app/athlete/layout.tsx) et la barre d'onglets mobile
   (app/_components/mobile/MobileTabBar.tsx).

   Elles portaient la même requête recopiée, avec le même
   `conversation_type = 'ATHLETE_COACH'` en dur — donc le même angle
   mort, à corriger deux fois. Un badge juste sur une seule des deux
   surfaces est pire que pas de badge : il apprend à l'utilisateur que
   le compteur ment. D'où la factorisation ici.

   DEUX MÉCANIQUES DE LECTURE, PAS UNE — et c'est le piège
   ───────────────────────────────────────────────────────
   · Fils bipartites (ATHLETE_COACH, RECRUTEUR_ATHLETE, ADMIN_USER) :
     lus quand `messages.read_at` est posé, par la RPC
     mark_conversation_read.
   · Fils de GROUPE : l'athlète n'a AUCUNE policy UPDATE sur `messages`.
     Ses vues de groupe marquent la lecture sur SA ligne
     `conversation_participants.last_read_at`. `messages.read_at` d'un
     message de groupe n'est donc JAMAIS posé côté athlète — vérifié en
     base : 11 messages de groupe, 0 avec read_at.

   Conséquence : mettre GROUP dans la même liste de types et compter
   avec `read_at IS NULL` donnerait un badge qui ne retombe jamais.
   Pire que l'oubli qu'on corrige. Le groupe est donc compté à part,
   par `created_at > last_read_at`, exactement comme loadGroupThreads
   dans useAthleteConversations.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";

/* ALLOWLIST. Un type absent d'ici est INVISIBLE au badge, sans erreur
   ni trace — c'est précisément ce défaut qui a masqué les fils
   ADMIN_USER et, bien avant eux, les messages directs de recruteur
   (RECRUTEUR_ATHLETE, produit principal). Ajouter un type de
   conversation destiné à l'athlète, c'est l'ajouter ICI.
   GROUP n'y figure pas volontairement : voir l'en-tête. */
export const ATHLETE_BADGE_BIPARTITE_TYPES = [
  "ATHLETE_COACH",
  "RECRUTEUR_ATHLETE",
  "ADMIN_USER",
] as const;

export async function countAthleteUnread(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  athleteId: string,
): Promise<number> {
  // 1. Mes fils bipartites. La RLS scope déjà aux miens ; le filtre
  //    athlete_id reste pour ne pas ramener plus large que nécessaire.
  const { data: bip } = await supabase
    .from("conversations")
    .select("id")
    .in("conversation_type", [...ATHLETE_BADGE_BIPARTITE_TYPES])
    .eq("athlete_id", athleteId);
  const bipIds = ((bip ?? []) as { id: string }[]).map((c) => c.id);

  // 2. Mes fils de groupe, via ma membership matérialisée (les GROUP ont
  //    athlete_id NULL — ils sont invisibles à la requête du point 1).
  const { data: parts } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);
  const lastRead = new Map<string, string | null>();
  for (const p of (parts ?? []) as { conversation_id: string; last_read_at: string | null }[]) {
    lastRead.set(p.conversation_id, p.last_read_at);
  }
  let groupIds: string[] = [];
  if (lastRead.size > 0) {
    // Le garde `= GROUP` n'est pas cosmétique : conversation_participants
    // ne porte que du groupe aujourd'hui, mais un invariant de données ne
    // se recopie pas en hypothèse de code.
    const { data: g } = await supabase
      .from("conversations")
      .select("id")
      .in("id", [...lastRead.keys()])
      .eq("conversation_type", "GROUP");
    groupIds = ((g ?? []) as { id: string }[]).map((c) => c.id);
  }

  const allIds = [...bipIds, ...groupIds];
  if (allIds.length === 0) return 0;

  // 3. Un seul aller-retour sur messages, compté selon la mécanique du fil.
  //    La RLS filtre déjà ce que l'athlète a le droit de voir (dans un
  //    groupe : les annonces staff + ses propres envois, jamais la réponse
  //    privée d'un coéquipier) — aucun re-filtre client.
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, created_at, sender_id, read_at")
    .in("conversation_id", allIds);

  const groupSet = new Set(groupIds);
  let unread = 0;
  for (const m of (msgs ?? []) as {
    conversation_id: string; created_at: string; sender_id: string; read_at: string | null;
  }[]) {
    if (m.sender_id === userId) continue;
    if (groupSet.has(m.conversation_id)) {
      const lr = lastRead.get(m.conversation_id) ?? null;
      if (!lr || m.created_at > lr) unread += 1;
    } else if (!m.read_at) {
      unread += 1;
    }
  }
  return unread;
}
