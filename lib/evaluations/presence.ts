/* ═══════════════════════════════════════════════════════════════
   presence — « y a-t-il une note à montrer ? »

   DEUX PRÉDICATS, UN SEUL ENDROIT.

   POURQUOI CE FICHIER EXISTE. La même maladie a été corrigée
   surface par surface, cinq fois, avec cinq conditions locales :

     2026-09-04  corps recruteur web    — `coteGlobale >= 0` était
                 TOUJOURS vrai : la section s'affichait pour un
                 athlète jamais évalué, avec « 0,0/5 » sous cinq
                 étoiles vides.
     2026-09-09  fiche coach            — dépliait les 14 critères à
                 « 0/5 » pour une cote rapide.
     2026-09-09  corps recruteur web    — la garde `> 0` manquait
                 dans la branche détaillée (compensation du retrait
                 du toggle).
     2026-09-09  fiche admin            — même garde, posée à la main.
     2026-09-09  corps recruteur MOBILE — deux rendus nus.

   Cinq gardes locales, c'est le bug qui revient à la sixième surface.
   Le prédicat vit donc ici, et les surfaces l'appellent.

   CE QUE ÇA VEUT DIRE, ET QUI N'EST PAS ÉVIDENT :
   une note ABSENTE n'est pas une note de ZÉRO. Personne ne met 0/5 à
   un jeune ; 0 est la valeur que porte un champ que personne n'a
   rempli. L'afficher, c'est affirmer un jugement que le coach n'a pas
   porté — et un recruteur le lit comme tel.
   ═══════════════════════════════════════════════════════════════ */

/** Y a-t-il une cote à afficher ? `null`, `undefined`, `0` et `NaN`
 *  veulent tous dire « pas de note », jamais « note de zéro ». */
export function aUneCote(cote: number | null | undefined): boolean {
  return typeof cote === "number" && Number.isFinite(cote) && cote > 0;
}

/** Au moins un critère noté ? Accepte l'objet de traits tel que les
 *  surfaces le portent — clés libres, valeurs éventuellement nulles.
 *  Un objet plein de zéros est une évaluation à la COTE RAPIDE : elle
 *  est complète, elle n'a simplement pas de détail à déplier. */
export function aDesCriteres(traits: object | null | undefined): boolean {
  if (!traits) return false;
  /* `object` et non `Record<string, …>` : les surfaces portent des INTERFACES
     nommées (AthleteTraitRatings), qui n'ont pas d'index signature et ne sont
     donc pas assignables à un Record. Exiger un Record aurait forcé un cast à
     chaque appel — cinq casts pour éviter cinq gardes, on n'aurait rien gagné.
     Les valeurs sont revalidées une par une par aUneCote. */
  return Object.values(traits).some((v) => aUneCote(typeof v === "number" ? v : null));
}
