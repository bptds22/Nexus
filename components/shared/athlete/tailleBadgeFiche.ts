/* ═══════════════════════════════════════════════════════════════
   Taille « fiche » des badges — la section Distinctions d'une fiche
   athlète (recruteur, coach, partenaire, profil de l'athlète). Décision BP
   du 2026-10-15 : ~40 % plus grands que `lg`, effet métal intact, MÊME
   boîte pour tous (badge Nexus et badge propre d'un partenaire), l'image
   centrée en `contain`.

   Bureau et tablette (≥ 640 px) : boîte 134 px (96 × 1,4) dans une cellule
   de 154 px. Mobile web : boîte 120 px, cellule 140 px — deux badges par
   rangée tiennent dans la colonne la plus étroite (2 × 140 + 16 = 296 px),
   là où 2 × 154 + 16 = 324 px frôlait le bord des cartes à marge intérieure.

   Un seul endroit pour ces valeurs : DistinctionBadge (size="fiche") et la
   vignette des badges partenaire les lisent ici, pour ne jamais diverger.
═══════════════════════════════════════════════════════════════ */

/** Largeur de la cellule (borne aussi le retour à la ligne du libellé). */
export const FICHE_CELLULE = "w-[140px] sm:w-[154px]";
/** Boîte carrée du picto : la même pour tous, l'image y est centrée. */
export const FICHE_BOITE = "w-[120px] h-[120px] sm:w-[134px] sm:h-[134px]";
/** Libellé sous le badge. */
export const FICHE_LIBELLE = "text-[11px] sm:text-[12px] max-w-[140px] sm:max-w-[154px]";
/** La rangée : retour à la ligne, centrée sur mobile, sans débordement. */
export const FICHE_RANGEE = "flex flex-wrap items-start justify-center sm:justify-start gap-x-4 gap-y-5 sm:gap-x-8";
