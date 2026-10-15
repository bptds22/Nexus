/* ═══════════════════════════════════════════════════════════════
   civilSansEquipe — inscription coach CIVIL : l'équipe est-elle requise ?
   (décision BP 2026-10-15, option A « directeur de club sans équipe »)

   Comme à l'école : une personne qui se déclare RESPONSABLE du club
   (« C'est moi » = owner, ou « Je serai intérimaire » = interim) peut
   terminer sans équipe. Un simple coach doit toujours choisir ou créer
   son équipe.

   Le choix « Je ne coache aucune équipe » se fait à l'étape du club et
   des équipes, AVANT l'étape du responsable : on le laisse passer à ce
   moment (final = false), puis on exige le statut de responsable à
   l'étape du responsable et à la fin (final = true).

   Rien ne change côté droits : se déclarer responsable crée une demande
   EN ATTENTE (admin_claims) ; aucun droit avant l'approbation par
   l'administrateur. La base (finish_coach_civil_onboarding) accepte déjà
   p_team_id = null.

   Utilisé par app/onboarding (web) et CoachOnboardingMobileCivil (mobile).
═══════════════════════════════════════════════════════════════ */

export interface EtatEquipeCivile {
  /** Équipe choisie ou créée (id), ou équipe à créer validée. */
  aUneEquipe: boolean;
  /** La personne a choisi « Je ne coache aucune équipe ». */
  sansEquipe: boolean;
  /** Choix du responsable : "owner" (C'est moi), "interim", ou autre / pas encore choisi. */
  choixResponsable: string | null | undefined;
  /** Une invitation d'un autre responsable est en cours (alors ce n'est pas lui le responsable). */
  inviteEnCours?: boolean;
}

export const MSG_EQUIPE_REQUISE = "Sélectionne ou crée une équipe pour continuer.";
export const MSG_SANS_EQUIPE_RESPONSABLE =
  "Sans équipe, tu dois être responsable du club : choisis « C'est moi » ou « Je serai intérimaire ».";

/** Vrai si la personne se déclare responsable du club (owner / interim, sans invitation). */
export function estResponsableDeclare(e: Pick<EtatEquipeCivile, "choixResponsable" | "inviteEnCours">): boolean {
  return (e.choixResponsable === "owner" || e.choixResponsable === "interim") && !e.inviteEnCours;
}

/**
 * L'équipe est-elle en règle ?
 * - final = false : à l'étape du club et des équipes (le responsable n'est pas encore choisi).
 * - final = true  : à l'étape du responsable et au moment de terminer.
 */
export function equipeCivileOk(e: EtatEquipeCivile, final: boolean): { ok: boolean; error: string } {
  if (e.aUneEquipe) return { ok: true, error: "" };
  if (!e.sansEquipe) return { ok: false, error: MSG_EQUIPE_REQUISE };
  if (final && !estResponsableDeclare(e)) return { ok: false, error: MSG_SANS_EQUIPE_RESPONSABLE };
  return { ok: true, error: "" };
}
