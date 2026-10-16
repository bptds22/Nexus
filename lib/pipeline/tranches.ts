/* Affichage par tranches (ListeParTranches) : seul le rendu est découpé, la
   liste reste complète. Pur, testable. */

export const TRANCHE_AFFICHAGE = 50;
/** La première tranche : un écran de téléphone en montre ~6 ; 20 suffisent à l'ouverture. */
export const PREMIERE_TRANCHE = 20;

/** Nombre de lignes à rendre après la tranche suivante, sans dépasser le total. */
export function tailleSuivante(actuel: number, total: number, tranche = TRANCHE_AFFICHAGE): number {
  return Math.min(total, actuel + tranche);
}
