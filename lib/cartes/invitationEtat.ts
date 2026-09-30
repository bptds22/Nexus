/* ═══════════════════════════════════════════════════════════════
   invitationEtat — ce que la carte dit de l'invitation automatique
   (décision BP 2026-09-30), pur et testé.

   · invitee_le posé               → « Invitation envoyée le … » ;
   · invitation_etat = NON_ENVOYEE → la mention NEUTRE ci-dessous ;
   · sinon (pas d'adresse, envoi en attente ou en échec) → rien.

   La mention ne donne JAMAIS la raison : « compte existant » dirait
   qu'un compte (peut-être d'un mineur) existe à cette adresse ;
   « déjà invité » trahirait la carte d'une autre unité. La raison
   reste dans cartes_prospect_invitations, lisible par l'admin seul.
═══════════════════════════════════════════════════════════════ */

export type InvitationEtat = "ENVOYEE" | "NON_ENVOYEE";

export const MENTION_INVITATION_NON_ENVOYEE =
  "Aucune invitation envoyée depuis cette carte : cette adresse a déjà reçu une invitation Nexus récemment, ou ne peut pas en recevoir.";

export type MentionInvitation =
  | { type: "ENVOYEE"; le: string }
  | { type: "NON_ENVOYEE"; texte: string }
  | null;

export function mentionInvitation(inviteeLe: string | null | undefined, etat: InvitationEtat | null | undefined): MentionInvitation {
  if (inviteeLe) return { type: "ENVOYEE", le: inviteeLe };
  if (etat === "NON_ENVOYEE") return { type: "NON_ENVOYEE", texte: MENTION_INVITATION_NON_ENVOYEE };
  return null;
}
