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

/* Club civil 18+ (lot 7 civil, décision BP 2026-10-27 : le cœur réutilise athlete_targets).
   Un club n'a pas de recruteur : AUCUN compte ne lit la cible d'un club (athletes_targeting_my_cegep
   ne rend que les cibles de l'école du recruteur, toujours un cégep). La phrase le dit, sans promettre
   un regard qui n'existe pas. */
export const CIBLE_DIVULGATION_CLUB_AVANT =
  "Le club ne voit pas tes cibles : elles restent dans ta liste, pour toi.";
export const CIBLE_DIVULGATION_CLUB_APRES =
  "Ce club est dans ta liste. Le club ne voit pas tes cibles.";

/**
 * La bonne phrase selon l'état du bouton. À préférer à un ternaire écrit
 * sur place : c'est le point unique où le temps du verbe se décide.
 */
/* Université (lot E4, sous lancement_universitaire ON) : seul le cégépien cible une université (E1) ; les recruteurs
   universitaires de l'université lisent la cible (athletes_targeting_my_cegep rend les cibles de l'école du recruteur). */
export const CIBLE_DIVULGATION_UNIVERSITE_AVANT =
  "Les recruteurs de cette université verront que tu les as ciblés.";
export const CIBLE_DIVULGATION_UNIVERSITE_APRES =
  "Les recruteurs de cette université voient que tu les as ciblés.";

export function divulgationCible(dansLesCibles: boolean, club = false, universite = false): string {
  if (club) return dansLesCibles ? CIBLE_DIVULGATION_CLUB_APRES : CIBLE_DIVULGATION_CLUB_AVANT;
  if (universite) return dansLesCibles ? CIBLE_DIVULGATION_UNIVERSITE_APRES : CIBLE_DIVULGATION_UNIVERSITE_AVANT;
  return dansLesCibles ? CIBLE_DIVULGATION_APRES : CIBLE_DIVULGATION_AVANT;
}

/**
 * Boîte « besoins » d'une page équipe, poste sans ouverture (web ET appli).
 * La cible se pose sur le cégep : ce sont ses RECRUTEURS qui la lisent, pas
 * des coachs (corrigé au lot 0 sur le web, repris tel quel par l'appli).
 */
export const PHRASE_SANS_OUVERTURE =
  "Pas d'ouverture à ton poste pour l'instant — mais montre ton intérêt : les recruteurs voient qui les cible.";
