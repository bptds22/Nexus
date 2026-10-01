/* ═══════════════════════════════════════════════════════════════
   rappelInvitation — l'état du bouton « Renvoyer l'invitation »
   (rappel ENVOYÉ PAR NEXUS, décision BP 2026-09-30), pur et testé.

   Règle « seulement si partie » : un rappel n'existe que si
   l'invitation automatique de CETTE carte est partie. Une carte
   écartée affiche « Impossible d'envoyer à cette adresse », sans
   raison — la base (demander_rappel_invitation) tranche de toute
   façon, et répond la même chose pour un compte créé ou un
   désabonnement survenus depuis.
   Au plus un envoi par 7 jours (l'invitation automatique compte
   comme le premier), au plus 3 rappels par carte.
═══════════════════════════════════════════════════════════════ */

import type { InvitationEtat } from "@/lib/cartes/invitationEtat";

export const RAPPELS_MAX = 3;
export const DELAI_RAPPEL_JOURS = 7;
export const TEXTE_IMPOSSIBLE = "Impossible d'envoyer à cette adresse";

export interface CarteRappel {
  courriel: string | null;
  invitationEtat: InvitationEtat | null;
  inviteeLe: string | null;
  renvoisInvitation: number;
  dernierRenvoiLe: string | null;
}

export type EtatRappel =
  | { type: "IMPOSSIBLE" }
  /** Invitation automatique en attente ou en échec : pas de rappel Nexus. */
  | { type: "AUCUN" }
  | { type: "LIMITE"; renvois: number }
  | { type: "ATTENTE"; dernierLe: string; disponibleLe: string; dejaRenvoye: boolean }
  | { type: "DISPONIBLE"; renvois: number };

function plusJours(iso: string, jours: number): string {
  return new Date(new Date(iso).getTime() + jours * 86_400_000).toISOString();
}

export function etatRappel(c: CarteRappel, maintenant: Date = new Date()): EtatRappel | null {
  if (!c.courriel || !c.courriel.trim()) return null;
  if (c.invitationEtat === "NON_ENVOYEE") return { type: "IMPOSSIBLE" };
  if (c.invitationEtat !== "ENVOYEE" || !c.inviteeLe) return { type: "AUCUN" };
  if (c.renvoisInvitation >= RAPPELS_MAX) return { type: "LIMITE", renvois: c.renvoisInvitation };
  const dernier = c.dernierRenvoiLe && c.dernierRenvoiLe > c.inviteeLe ? c.dernierRenvoiLe : c.inviteeLe;
  const disponible = plusJours(dernier, DELAI_RAPPEL_JOURS);
  if (new Date(disponible) > maintenant) {
    return { type: "ATTENTE", dernierLe: dernier, disponibleLe: disponible, dejaRenvoye: !!c.dernierRenvoiLe };
  }
  return { type: "DISPONIBLE", renvois: c.renvoisInvitation };
}

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });

/** Le texte du bouton quand il ne peut pas servir. */
export function libelleRappelIndisponible(e: EtatRappel): string | null {
  switch (e.type) {
    case "IMPOSSIBLE": return TEXTE_IMPOSSIBLE;
    case "LIMITE": return `${RAPPELS_MAX} rappels envoyés — plus de renvoi possible`;
    case "ATTENTE": return e.dejaRenvoye
      ? `Renvoyé le ${jour(e.dernierLe)} — disponible à nouveau le ${jour(e.disponibleLe)}`
      : `Rappel possible le ${jour(e.disponibleLe)}`;   // « Invitation envoyée le … » est déjà affiché au-dessus
    default: return null;
  }
}

/** Réponse de demander_rappel_invitation → état à afficher tout de suite. */
export type ReponseRappel =
  | { etat: "ENVOI_LANCE" }
  | { etat: "EN_COURS" }
  | { etat: "IMPOSSIBLE" }
  | { etat: "LIMITE"; renvois?: number }
  | { etat: "TROP_TOT"; dernier_le: string; disponible_le: string };

export function messageReponse(r: ReponseRappel): { ton: "ok" | "neutre"; texte: string } {
  switch (r.etat) {
    case "ENVOI_LANCE": return { ton: "ok", texte: "Rappel en cours d'envoi — la carte affichera « Renvoyé le … » dès qu'il est parti." };
    case "EN_COURS": return { ton: "neutre", texte: "Un rappel est déjà en cours d'envoi." };
    case "IMPOSSIBLE": return { ton: "neutre", texte: TEXTE_IMPOSSIBLE };
    case "LIMITE": return { ton: "neutre", texte: `${RAPPELS_MAX} rappels envoyés — plus de renvoi possible` };
    case "TROP_TOT": return { ton: "neutre", texte: `Renvoyé le ${jour(r.dernier_le)} — disponible à nouveau le ${jour(r.disponible_le)}` };
  }
}
