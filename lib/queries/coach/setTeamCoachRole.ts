/* ═══════════════════════════════════════════════════════════════
   setTeamCoachRole — changer le rôle d'un coach sur une équipe.

   Le cas intéressant est la PASSATION : nommer B entraîneur-chef alors que A
   l'est déjà. L'index unique partiel de la vague 1
   (`team_coaches_one_referent_per_team`) interdit deux responsables, donc
   promouvoir B avant de rétrograder A ÉCHOUE. L'ordre n'est pas un détail de
   style : c'est la seule séquence que la base accepte.

     1. rétrograder A  (head_coach → assistant)
     2. promouvoir  B  (→ head_coach)

   Entre les deux, l'équipe n'a aucun responsable pendant quelques
   millisecondes. Si l'étape 2 échoue, on REMET A tel qu'il était — sinon un
   échec réseau laisserait l'équipe orpheline, ce qui est pire que l'état de
   départ. C'est un rollback applicatif, pas transactionnel : une vraie
   atomicité demanderait une RPC, à faire si la passation devient fréquente.

   Consommé par les deux surfaces de la page équipe (web + mobile).
   ═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isReferentRole, type TeamRole } from "@/lib/coach/teamRoles";

export interface SetRoleResult {
  ok: boolean;
  /** Message prêt à afficher — récapitule la bascule quand il y en a une. */
  message: string;
  /** true si un autre coach a été rétrogradé au passage. */
  demoted?: { rowId: string; name: string } | null;
}

export interface TeamCoachRow {
  /** id de la ligne team_coaches (pas le coach_id). */
  id: string;
  coachId: string;
  name: string;
  role: string;
}

export async function setTeamCoachRole(
  supabase: SupabaseClient,
  params: {
    teamId: string;
    target: TeamCoachRow;
    nextRole: TeamRole;
    /** Tous les coachs de l'équipe, pour trouver le responsable en place. */
    roster: TeamCoachRow[];
  },
): Promise<SetRoleResult> {
  const { target, nextRole, roster } = params;

  if (target.role === nextRole) return { ok: true, message: "" };

  // Le responsable actuel, s'il existe et si ce n'est pas la cible elle-même.
  const sortant = roster.find((c) => c.id !== target.id && isReferentRole(c.role)) ?? null;
  const besoinDeBascule = isReferentRole(nextRole) && sortant !== null;

  if (besoinDeBascule && sortant) {
    const { error: demErr } = await supabase
      .from("team_coaches")
      .update({ role: "assistant" })
      .eq("id", sortant.id);

    if (demErr) {
      return { ok: false, message: `Impossible de modifier le rôle de ${sortant.name}. Rien n'a été changé.` };
    }

    const { error: promErr } = await supabase
      .from("team_coaches")
      .update({ role: nextRole })
      .eq("id", target.id);

    if (promErr) {
      // Rollback : sans ça, l'équipe reste SANS responsable.
      await supabase.from("team_coaches").update({ role: sortant.role }).eq("id", sortant.id);
      return {
        ok: false,
        message: `La passation a échoué. ${sortant.name} reste responsable de l'équipe.`,
      };
    }

    return {
      ok: true,
      message: `${target.name} est maintenant responsable — ${sortant.name} devient assistant.`,
      demoted: { rowId: sortant.id, name: sortant.name },
    };
  }

  const { error } = await supabase
    .from("team_coaches")
    .update({ role: nextRole })
    .eq("id", target.id);

  if (error) {
    const msg = (error as { message?: string }).message || "";
    return {
      ok: false,
      message: msg.includes("one_referent_per_team")
        ? "Cette équipe a déjà un responsable. Recharge la page."
        : "Le changement de rôle a échoué.",
    };
  }

  return { ok: true, message: `${target.name} — rôle mis à jour.`, demoted: null };
}
