/* ═══════════════════════════════════════════════════════════════
   divulgation — ce que l'athlète doit savoir AVANT de cibler un cégep.

   DÉCISION BP : cibler un cégep le lui fait savoir. Ce n'est pas une
   option, et ce n'est donc pas une information à cacher sous un bouton.

   POURQUOI UNE SOURCE UNIQUE, ET PAS SIX PHRASES RECOPIÉES.
   Le ciblage s'écrit depuis SIX surfaces web distinctes (page collège :
   bouton Suivre + bande CTA ; page équipe : hero + box besoins ;
   recherche cégep : panneau ; Mon parcours : module 02). Une phrase
   recopiée six fois dérive en six phrases différentes, et la septième
   surface naît sans phrase du tout — c'est exactement ce qui est arrivé
   au badge `ambassadeur` (posé en base et dans `public/badges/`, absent
   de `CATALOGUE_BADGE_CODES`, donc invisible partout sauf sur la page
   qui codait son chemin en dur).

   Toute nouvelle surface qui écrit `athlete_targets` importe d'ici.

   CE QUE CES PHRASES NE DISENT PAS, ET C'EST VOULU :
   - pas « tu seras contacté » — le recruteur voit, il n'est obligé à rien ;
   - pas « X recruteurs » — le nombre de recruteurs rattachés à un cégep
     change, et un cégep sans recruteur inscrit verrait quand même la
     phrase (la cible l'attend, elle ne se perd pas) ;
   - pas de nom de recruteur — l'athlète n'a jamais su QUI le regarde
     (cf. `notify_athlete_favorited` : « Un recruteur t'a ajouté… »), la
     symétrie est conservée.
   ═══════════════════════════════════════════════════════════════ */

/** Avant le geste : ce qui va se produire. */
export const CIBLE_DIVULGATION_AVANT =
  "Les recruteurs de ce cégep verront que tu les as ciblés.";

/** Après le geste : ce qui se produit maintenant. Même fait, présent. */
export const CIBLE_DIVULGATION_APRES =
  "Les recruteurs de ce cégep voient que tu les as ciblés.";

/**
 * Contexte de LISTE (Mon parcours) : la phrase porte sur toutes les cibles
 * à la fois, pas sur un collège en particulier.
 */
export const CIBLE_DIVULGATION_LISTE =
  "Les recruteurs de chaque cégep de ta liste voient que tu les as ciblés.";

/**
 * La bonne phrase selon l'état du bouton. À préférer à un ternaire écrit
 * sur place : c'est le point unique où le temps du verbe se décide.
 */
export function divulgationCible(dansLesCibles: boolean): string {
  return dansLesCibles ? CIBLE_DIVULGATION_APRES : CIBLE_DIVULGATION_AVANT;
}
