/* ═══════════════════════════════════════════════════════════════════════════
   inviteAnchoredAthlete — le coach propose un transfert à partir d'un COURRIEL.

   Le cas : le coach saisit une adresse, la détection lui répond « existe, mais
   pas invitable ici » — un drapeau SEUL, sans identifiant (choix Loi 25). Il ne
   peut donc pas appeler inviteAthleteToTeam(), qui exige un athleteId.

   Ce helper passe par la RPC invite_anchored_athlete_to_team, qui résout le
   courriel côté serveur et ne retourne qu'un code de statut. Le coach
   n'apprend rien de plus qu'avant : ni nom, ni sport, ni identifiant.

   ⚠ NE CONFONDRE AVEC AUCUN DES DEUX AUTRES CHEMINS :
     · createAthleteInvitationLink → athlete_invitations → RÉCLAMATION (/claim),
       pour un athlète SANS compte que le coach a lui-même créé.
     · inviteAthleteToTeam        → team_invitations, quand l'athlète a été
       identifié par une SUGGESTION (athleteId déjà connu légitimement).
     · celui-ci                   → team_invitations, à partir d'un courriel
       OPAQUE. N'écrit JAMAIS dans athlete_invitations.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { attachmentSentinel, attachmentReussi } from "@/lib/queries/shared/attachmentErrors";

export interface InviteAnchoredResult {
  /** true = invitation créée, ou déjà en attente (idempotent côté UI). */
  ok: boolean;
  /** Message FR prêt à afficher — vide quand ok et rien à dire. */
  message: string;
  /** true quand l'invitation existait déjà : ton neutre, pas une erreur. */
  dejaEnvoyee: boolean;
}

export async function inviteAnchoredAthlete(
  supabase: SupabaseClient,
  email: string,
  teamId: string,
): Promise<InviteAnchoredResult> {
  const { data, error } = await supabase.rpc("invite_anchored_athlete_to_team", {
    p_email: email,
    p_team_id: teamId,
  });

  if (error) {
    console.error("[invite_anchored_athlete_to_team]", error);
    // La RPC retourne ses refus en valeur, pas en exception : une erreur ici
    // est réseau/RLS, donc le repli générique du traducteur.
    return { ok: false, message: attachmentSentinel(error.message), dejaEnvoyee: false };
  }

  const sentinelle = typeof data === "string" ? data : null;
  const dejaEnvoyee = sentinelle === "ALREADY_PENDING";

  return {
    ok: attachmentReussi(sentinelle),
    message: dejaEnvoyee
      ? attachmentSentinel(sentinelle)
      : sentinelle === "OK"
        ? ""
        : attachmentSentinel(sentinelle),
    dejaEnvoyee,
  };
}
