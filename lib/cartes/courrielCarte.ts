/* ═══════════════════════════════════════════════════════════════
   courrielCarte — le courriel d'une carte, modifiable dans Infos
   (lot 2 cartes, décisions BP 2026-10-07), pur et testé.

   · AJOUT (la carte n'avait pas de courriel) → fenêtre « Envoyer
     l'invitation ? ». « Enregistrer et inviter » enregistre ; c'est la BASE
     qui envoie (trigger trg_carte_z_inviter_ajout, lot 1) — l'interface
     n'envoie rien elle-même. « Annuler » n'enregistre RIEN.
   · CHANGEMENT (la carte en avait déjà un) → aucune invitation
     automatique, pas de fenêtre : une ligne d'aide sous le champ.
   · RETRAIT → refusé ici (voir REGLE_RETRAIT) : un courriel retiré puis
     remis n'enverrait rien (une invitation par carte), et la fenêtre
     « Envoyer l'invitation ? » mentirait.

   Après l'ajout, la carte relue dit ce qui s'est passé : « Nexus envoie
   l'invitation à … » ou la mention NEUTRE (jamais le motif).
═══════════════════════════════════════════════════════════════ */

import { MENTION_INVITATION_NON_ENVOYEE, type InvitationEtat } from "@/lib/cartes/invitationEtat";

export type GesteCourriel = "AJOUT" | "CHANGEMENT" | "RETRAIT" | "INCHANGE";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function gesteCourriel(ancien: string | null | undefined, nouveau: string | null | undefined): GesteCourriel {
  const a = norm(ancien);
  const n = norm(nouveau);
  if (a === n) return "INCHANGE";
  if (!a) return "AJOUT";
  if (!n) return "RETRAIT";
  return "CHANGEMENT";
}

export const TITRE_CONFIRMATION = "Envoyer l'invitation ?";

export function texteConfirmation(adresse: string): string {
  return `Nexus enverra automatiquement à ${adresse.trim()} un courriel l'invitant à s'inscrire, à ton nom et à celui de ton cégep. Une seule fois.`;
}

export const AIDE_COURRIEL_CHANGE =
  "Aucune nouvelle invitation n'est envoyée. Tu peux copier le texte pour l'envoyer toi-même.";

export const REGLE_RETRAIT = "Le courriel ne peut pas être retiré. Tu peux le remplacer par une autre adresse.";

/** Ce que la carte relue dit, juste après l'ajout : le même message qu'à la
 *  création. La raison d'un écart n'est JAMAIS donnée. */
export function messageApresAjout(adresse: string, etat: InvitationEtat | null | undefined): { ton: "ok" | "neutre"; texte: string } {
  if (etat === "NON_ENVOYEE") return { ton: "neutre", texte: MENTION_INVITATION_NON_ENVOYEE };
  return { ton: "ok", texte: `Nexus envoie l'invitation à ${adresse.trim()}.` };
}
