/* ═══════════════════════════════════════════════════════════════
   Règle RSEQ (décision BP du 2026-10-15) appliquée à l'aperçu d'un CODE
   D'ÉQUIPE et à la réclamation d'une fiche préparée — écrans destinés à
   l'athlète (onboarding mobile, registre §93).

   Même règle que le web (equipeNommable, déjà utilisée par JoinCodeField et
   ClaimProfileModal) : l'équipe, son école et ses coachs ne sont montrés que
   pour une équipe secondaire ou civile. Collégiale ou type inconnu : « Code
   valide », rien qui désigne le cégep ni un coach.
═══════════════════════════════════════════════════════════════ */

import { equipeNommable } from "@/lib/invitations/equipeNommable";
import type { OrphanProfile } from "@/components/auth/ClaimProfileModal";

export interface CodeEquipeAdopte {
  teamName: string;
  schoolName: string;
  schoolType: string;
  details: { essentiel: string; contexte: string };
}

export interface ApercuCodeEquipe {
  /** Vrai seulement pour une équipe secondaire ou civile. */
  nommable: boolean;
  /** Nom de l'équipe, ou « Code valide » si elle n'est pas nommable. */
  titre: string;
  /** Lignes de détail (catégorie, division…) — null si non nommable. */
  details: { essentiel: string; contexte: string } | null;
  /** Nom de l'école ou du club — null si non nommable. */
  organisation: string | null;
  /** « club » pour le civil, « école » sinon (le mot ne nomme personne). */
  motOrganisation: "club" | "école";
  /** La liste des coachs de l'équipe peut-elle être montrée ? Le civil n'a
   *  pas de choix de coach ici ; le collégial n'est jamais nommé. */
  coachsVisibles: boolean;
}

export const TITRE_CODE_NON_NOMMABLE = "Code valide";

export function apercuCodeEquipe(c: CodeEquipeAdopte): ApercuCodeEquipe {
  const nommable = equipeNommable(c.schoolType);
  const civil = c.schoolType?.trim().toUpperCase() === "LIGUE_CIVILE";
  const titre = nommable && c.teamName.trim() ? c.teamName.trim() : TITRE_CODE_NON_NOMMABLE;
  return {
    nommable,
    titre,
    details: nommable ? c.details : null,
    organisation: nommable && c.schoolName.trim() ? c.schoolName.trim() : null,
    motOrganisation: civil ? "club" : "école",
    coachsVisibles: nommable && !civil,
  };
}

/** Noms à poser dans l'état d'affichage (« ✓ {école} », « ✓ {équipe} ») après
 *  l'adoption d'un code : vides si l'équipe n'est pas nommable. Les IDENTIFIANTS
 *  restent posés par l'appelant (rattachement inchangé) ; seuls les noms
 *  affichés tombent. Web et mobile (applyCodeLock). */
export function nomsAffichablesCode(t: {
  teamName?: string | null; schoolName?: string | null; schoolType?: string | null;
}): { equipe: string; organisation: string } {
  if (!equipeNommable(t.schoolType)) return { equipe: "", organisation: "" };
  return { equipe: t.teamName ?? "", organisation: t.schoolName ?? "" };
}

/** Une fiche orpheline lue en base → ce que la modale de réclamation reçoit.
 *  Jamais de coach (règle RSEQ) ; le TYPE d'école voyage pour que la modale
 *  décide d'afficher l'école ou non. Sans type : rien n'est nommé. */
export function orphelinPourReclamation(row: {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  sport?: { nom?: string | null } | null;
  ecole?: { name?: string | null; type?: string | null } | null;
}): OrphanProfile {
  return {
    id: row.id,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    sport_name: row.sport?.nom ?? null,
    school_name: row.ecole?.name ?? null,
    school_type: row.ecole?.type ?? null,
  };
}
