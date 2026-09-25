/* ═══════════════════════════════════════════════════════════════
   Les requêtes du TABLEAU BLANC — ce que plusieurs recruteurs d'une unité
   écrivent et lisent en même temps (lot B2, correctif du 2026-09-24).

   BUG CORRIGÉ : un geste d'un collègue n'apparaissait pas après F5, parfois
   pas avant une déconnexion. Mesuré en local : après F5, AUCUNE requête ne
   partait — l'écran venait du cache TanStack persisté en sessionStorage
   (30 min, QueryProvider), qu'un F5 ne vide pas. Les requêtes elles-mêmes
   répondent en 5 à 15 ms. Et deux écritures web (favori, étape depuis la
   fiche) n'invalidaient pas le processus du tout.

   Deux règles, une seule liste :
     1. ces clés ne sont JAMAIS persistées (QueryProvider) — un tableau
        partagé n'a rien à faire dans un cache de 30 minutes ;
     2. toute écriture d'unité les invalide TOUTES (invaliderTableauBlanc).

   Une nouvelle lecture du tableau blanc s'ajoute ICI, ou elle retombe dans
   le cache persisté et le bug revient.
═══════════════════════════════════════════════════════════════ */

import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Premier segment des clés du tableau blanc (préfixes TanStack). */
export const CLES_TABLEAU_BLANC = [
  "pipeline",               // Mon processus (démo et unité), relances du tableau de bord
  "pipeline-notes",         // notes de suivi (panneau)
  "pipeline-historique",    // onglet Historique de l'unité
  "unite-auteurs",          // noms des recruteurs de l'unité
  "cegep-sport-unite",      // filtre sport de l'unité (admin)
  "favorites",              // mes favoris
  "favoriteCounts",         // « X recruteurs intéressés »
  "dashboard",              // tuiles, entonnoir, activité du tableau de bord
  "recruiter-lists",        // listes
  "list-athletes",
  "list-notes",
  "athlete-list-membership",
  "recruiting-calendar",    // calendrier
  "activity-feed",          // journal d'activité
  "unread-activity-count",
  "cegep-stats",            // Mon CÉGEP
] as const;

const ENSEMBLE: ReadonlySet<string> = new Set(CLES_TABLEAU_BLANC);

/** Vrai si la requête appartient au tableau blanc (ne pas la persister). */
export function estCleTableauBlanc(queryKey: QueryKey | undefined): boolean {
  const tete = queryKey?.[0];
  return typeof tete === "string" && ENSEMBLE.has(tete);
}

/** Invalide TOUTES les lectures du tableau blanc. Les requêtes montées se
 *  rechargent aussitôt ; les autres le feront à leur prochain affichage. */
export function invaliderTableauBlanc(queryClient: QueryClient): Promise<void[]> {
  return Promise.all(CLES_TABLEAU_BLANC.map((cle) => queryClient.invalidateQueries({ queryKey: [cle] })));
}
