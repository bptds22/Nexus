/* Critères automatiques de « Quand le cégep cogne » / « Quand l'université cogne » (point 5, liste validée par
   BP le 2026-10-29). Les règles sont ICI, pures et testées ; la page ne fait que les appeler.
   Les trois faits que l'athlète ne peut pas lire lui-même (a répondu à un recruteur, a échangé avec un recruteur
   universitaire, visite enregistrée) viennent de la fonction mes_criteres_parcours() (migration 20261029180000). */

import { isValidationExpired } from "@/lib/utils/profileValidation";

/** Réponse de mes_criteres_parcours(). Absente (erreur, pas de fiche) = tout faux. */
export type FaitsParcours = {
  repondu_recruteur: boolean;
  echange_recruteur_universitaire: boolean;
  visite: boolean;
};
export const FAITS_VIDES: FaitsParcours = { repondu_recruteur: false, echange_recruteur_universitaire: false, visite: false };

const rempli = (v: unknown): boolean => v !== null && v !== undefined && String(v).trim() !== "";

/** Instagram présent sur la fiche. */
export function instagramPresent(url: string | null | undefined): boolean {
  return rempli(url);
}

/** « Tes chiffres sont sur ta fiche » : au moins 2 tests physiques remplis. */
export const SEUIL_TESTS_PHYSIQUES = 2;
export function chiffresRemplis(tests: readonly unknown[]): boolean {
  return tests.filter(rempli).length >= SEUIL_TESTS_PHYSIQUES;
}

/** Vidéo de faits saillants de moins de 12 mois (date posée par la base à chaque changement de lien). */
export function videoRecente(url: string | null | undefined, majLe: string | Date | null | undefined, maintenant: Date = new Date()): boolean {
  if (!rempli(url) || !majLe) return false;
  const d = majLe instanceof Date ? majLe : new Date(majLe);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date(maintenant);
  limite.setFullYear(limite.getFullYear() - 1);
  return d.getTime() > limite.getTime();
}

/** Profil vérifié : crochet bleu posé ET re-validation du mois pas expirée (même règle que le badge affiché). */
export function profilVerifie(verified: boolean | null | undefined, derniereValidation: string | null | undefined, maintenant: Date = new Date()): boolean {
  return verified === true && !isValidationExpired({ verified, last_profile_validation: derniereValidation ?? null }, maintenant);
}

/** Programme universitaire visé choisi (catalogue ou texte libre). */
export function programmeUniversitaireChoisi(id: string | null | undefined, libelle: string | null | undefined): boolean {
  return rempli(id) || rempli(libelle);
}

/** Lit la réponse brute de la fonction ; toute forme inattendue vaut « tout faux ». */
export function lireFaits(brut: unknown): FaitsParcours {
  if (!brut || typeof brut !== "object") return FAITS_VIDES;
  const o = brut as Record<string, unknown>;
  return {
    repondu_recruteur: o.repondu_recruteur === true,
    echange_recruteur_universitaire: o.echange_recruteur_universitaire === true,
    visite: o.visite === true,
  };
}
