/* ═══════════════════════════════════════════════════════════════
   « Ton entraîneur-chef : X » — point 9, option A (décision BP 2026-10-17).

   L'athlète ne CHOISIT plus son coach : doctrine « responsable d'équipe » du
   2026-09-09 (athletes.coach_id = le responsable de l'équipe, recalculé en base
   par trg_team_athletes_referent / trg_team_coaches_referent). La liste « Mon
   coach » est retirée partout où l'athlète la voyait (onboarding web et appli,
   paramètres web et appli) ; à la place, une ligne en LECTURE SEULE, et
   seulement si l'entraîneur-chef de l'équipe est nommable à l'athlète.

   « Nommable » = présent dans coachs_nommables_equipe (règle RSEQ, filtre en
   base, migration 20261016040000) : un coach collégial n'y figure jamais, une
   équipe collégiale rend une liste vide → rien n'est affiché. Aucun changement
   en base ni à l'aiguillage des recruteurs.
═══════════════════════════════════════════════════════════════ */

import type { CoachNommableEquipe } from "@/lib/queries/athlete/coachsNommables";

/** Rôles d'entraîneur-chef, dans l'ordre de la doctrine (le chef, puis l'intérim). */
const ROLES_CHEF = ["head_coach", "head_coach_interim"] as const;

/** L'entraîneur-chef nommable d'une équipe, ou null (aucun, ou pas nommable). */
export function entraineurChefNommable(coachs: readonly Pick<CoachNommableEquipe, "role" | "first_name" | "last_name">[]): string | null {
  for (const role of ROLES_CHEF) {
    const c = coachs.find((x) => x.role === role);
    if (!c) continue;
    const nom = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
    if (nom) return nom;
  }
  return null;
}

/** Le texte affiché, identique web et appli. */
export function texteEntraineurChef(nom: string): string {
  return `Ton entraîneur-chef : ${nom}`;
}
