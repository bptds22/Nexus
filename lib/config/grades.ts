/* ═══════════════════════════════════════════════════════════════
   GRADE RECRUTEUR — source unique des 7 valeurs (Lot 2)

   Le grade est le jugement PRIVÉ du recruteur sur un athlète. Ce n'est ni
   l'évaluation du coach (`evaluations`), ni le stage de pipeline
   (`recruiter_pipeline.stage`) : c'est son opinion concurrentielle, que lui
   seul lit. La table `recruiter_athlete_grades` est propriétaire seul sur
   les quatre verbes.

   ⚠ CONTRAT AVEC LA BASE — CE FICHIER ET LE CHECK SQL SONT LE MÊME ENSEMBLE.
   Le CHECK vit dans
   supabase/migrations/20260904022136_recruiter_athlete_grades.sql :

       check (grade in ('A+','A','B+','B','C+','C','D'))

   Ajouter ou retirer une valeur ICI sans toucher au CHECK produit un picker
   qui propose un grade que la base refuse : l'erreur tombe à l'écriture, sur
   le geste de l'utilisateur, jamais au build. tsc et ESLint sont aveugles à
   cet écart — les deux listes se modifient ensemble, dans la même migration
   que le lot qui les change.

   L'ORDRE EST LE TRI. GRADES est déclaré du meilleur au moins bon, et
   GRADE_RANK en dérive plutôt que de le recopier : une seule liste à tenir.
   Un rang PLUS PETIT = un MEILLEUR grade (A+ = 0, D = 6).
═══════════════════════════════════════════════════════════════ */

/** Les 7 valeurs, du meilleur au moins bon. L'ordre EST la règle de tri. */
export const GRADES = ["A+", "A", "B+", "B", "C+", "C", "D"] as const;

export type Grade = (typeof GRADES)[number];

/** Rang de tri dérivé de l'ordre de GRADES. A+ = 0 … D = 6. */
export const GRADE_RANK: Record<Grade, number> = Object.fromEntries(
  GRADES.map((grade, index) => [grade, index]),
) as Record<Grade, number>;

/** Rang des cartes SANS grade : après toutes les cartes gradées.
 *  « Pas encore jugé » n'est pas « jugé mauvais » — un athlète non gradé ne
 *  descend pas sous les D, il se range à la suite. */
export const UNGRADED_RANK = GRADES.length;

/** Rang triable d'un grade éventuellement absent. Le tri du Lot 3 passe par
 *  ici plutôt que de lire GRADE_RANK directement, pour que le sort des cartes
 *  non gradées soit décidé à un seul endroit. */
export function gradeRank(grade: Grade | null | undefined): number {
  return grade ? GRADE_RANK[grade] : UNGRADED_RANK;
}

/** Garde de type pour les valeurs qui viennent de PostgREST (donc `unknown`).
 *  Le CHECK garantit déjà l'ensemble côté base ; ceci empêche une valeur
 *  inattendue — colonne élargie, cache PostgREST périmé — de traverser en
 *  silence jusqu'au rendu. */
export function isGrade(value: unknown): value is Grade {
  return typeof value === "string" && (GRADES as readonly string[]).includes(value);
}
