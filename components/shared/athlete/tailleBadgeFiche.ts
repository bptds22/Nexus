/* ═══════════════════════════════════════════════════════════════
   Taille des badges PROPRES à un partenaire (partner_badges, image
   téléversée) dans la section Distinctions d'une fiche athlète. Décision BP
   du 2026-10-15, corrigée le même jour : SEULS ces badges sont ~40 % plus
   grands ; les badges Nexus (y compris ceux posés par un partenaire) gardent
   le gabarit `lg` de DistinctionBadge (cellule 110 px, picto 96 px).
   Effet métal intact, boîte carrée, l'image centrée en `contain` : un
   badge large (« ES ») paraît aussi présent qu'un badge carré.

   Bureau et tablette (≥ 640 px) : boîte 134 px (96 × 1,4) dans une cellule
   de 154 px. Mobile web : boîte 120 px, cellule 140 px.

   Lu par BadgePartenaireVignette (BadgesPartenaire.tsx).
═══════════════════════════════════════════════════════════════ */

/** Largeur de la cellule (borne aussi le retour à la ligne du libellé). */
export const FICHE_CELLULE = "w-[140px] sm:w-[154px]";
/** Boîte carrée du picto, la même pour chaque badge propre ; l'image y est centrée. */
export const FICHE_BOITE = "w-[120px] h-[120px] sm:w-[134px] sm:h-[134px]";
/** Libellé sous le badge. */
export const FICHE_LIBELLE = "text-[11px] sm:text-[12px] max-w-[140px] sm:max-w-[154px]";
