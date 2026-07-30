/* ═══════════════════════════════════════════════════════════════
   useGroupThreadMeta — contexte partagé d'un fil de GROUPE (Phase A).
   Charge, sous l'identité du VIEWER (donc filtré par la RLS group_*) :
     • la conversation GROUP (group_name, group_scope) ;
     • les membres visibles (conversation_participants → member_role,
       athlete_id) — staff voit tout le monde, un athlète ne voit que
       le staff + lui-même (policy group_participants_select) ;
     • les noms des membres résolus via users(first_name, last_name)
       sur user_id (= sender_id des messages : seuls des participants
       peuvent écrire).

   Le rôle du viewer se lit sur SA ligne participant (member_role) ;
   à défaut on retombe sur le défaut passé par le portail appelant
   (portail coach ⇒ STAFF, portail athlète ⇒ ATHLETE).

   NB visibilité : on ne re-filtre JAMAIS les messages côté client — la
   RLS est la source de vérité (staff = tout ; athlète = 'ALL' + ses
   envois). On se sert seulement de member_role pour ÉTIQUETER : un
   message dont l'expéditeur est 'ATHLETE' est une réponse privée
   (audience 'STAFF', posée par le trigger) ; 'STAFF' = annonce ('ALL').
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type GroupMemberRole = "STAFF" | "ATHLETE";

export interface GroupThreadMeta {
  meId: string;
  groupName: string;
  groupScope: "STAFF" | "TEAM" | null;
  /** Rôle du viewer dans CE groupe (sa ligne participant, sinon défaut portail). */
  viewerRole: GroupMemberRole;
  /** user_id → member_role (des membres visibles par le viewer). */
  roles: Record<string, GroupMemberRole>;
  /** user_id → "Prénom Nom". */
  names: Record<string, string>;
  /** user_id → initiales (2 lettres max). */
  initials: Record<string, string>;
  memberCount: number;
  notFound: boolean;
}

export function useGroupThreadMeta(
  conversationId: string | null,
  portalDefault: GroupMemberRole,
) {
  return useQuery<GroupThreadMeta>({
    queryKey: ["group-thread-meta", conversationId],
    enabled: !!conversationId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const meId = user?.id ?? "";

      const empty: GroupThreadMeta = {
        meId, groupName: "", groupScope: null, viewerRole: portalDefault,
        roles: {}, names: {}, initials: {}, memberCount: 0, notFound: true,
      };

      if (!conversationId || !meId) return empty;

      const { data: conv } = await supabase
        .from("conversations")
        .select("id, conversation_type, group_scope, group_name")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv || (conv as Record<string, unknown>).conversation_type !== "GROUP") return empty;

      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id, member_role, athlete_id")
        .eq("conversation_id", conversationId);

      const rows = (parts ?? []) as { user_id: string; member_role: GroupMemberRole; athlete_id: string | null }[];
      const roles: Record<string, GroupMemberRole> = {};
      for (const r of rows) roles[r.user_id] = r.member_role;

      // Rôle du viewer : sa ligne participant, sinon le défaut du portail.
      const viewerRole: GroupMemberRole = roles[meId] ?? portalDefault;

      // Noms des membres. ATTENTION à l'asymétrie de la RLS `users` :
      //   • le STAFF est lisible par tous (staff ET athlètes) → noms via users ;
      //   • la ligne `users` d'un ATHLÈTE est CACHÉE au staff → on résout son
      //     nom via `athletes` (first_name/last_name, lisible par le coach via
      //     son autorité équipe/école). Sans ça l'athlète était bien participant
      //     mais absent de la liste côté coach (bug « seuls les coachs »).
      const names: Record<string, string> = {};
      const initials: Record<string, string> = {};
      const applyName = (uid: string, f: string, l: string) => {
        names[uid] = `${f} ${l}`.trim() || "Membre";
        initials[uid] = `${f[0] || ""}${l[0] || ""}`.toUpperCase() || "?";
      };

      const staffIds = rows.filter((r) => r.member_role === "STAFF").map((r) => r.user_id);
      const athleteRows = rows.filter((r) => r.member_role === "ATHLETE");
      const athleteIds = athleteRows.map((r) => r.athlete_id).filter(Boolean) as string[];

      if (staffIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .in("id", staffIds);
        for (const u of (users ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
          applyName(u.id, (u.first_name || "").trim(), (u.last_name || "").trim());
        }
      }
      if (athleteIds.length > 0) {
        const { data: aths } = await supabase
          .from("athletes")
          .select("id, first_name, last_name")
          .in("id", athleteIds);
        const byId = new Map(
          ((aths ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((a) => [a.id, a]),
        );
        for (const r of athleteRows) {
          const a = r.athlete_id ? byId.get(r.athlete_id) : null;
          applyName(r.user_id, (a?.first_name || "").trim(), (a?.last_name || "").trim());
        }
      }

      return {
        meId,
        groupName: ((conv as Record<string, unknown>).group_name as string) || "Groupe",
        groupScope: ((conv as Record<string, unknown>).group_scope as "STAFF" | "TEAM") || null,
        viewerRole,
        roles,
        names,
        initials,
        memberCount: rows.length,
        notFound: false,
      };
    },
  });
}
