/* Actions offertes sous un badge PARTENAIRE sur une fiche athlète, selon qui
   regarde — les mêmes que le web (registre §97) :
   - coach  → « Masquer / Réafficher » (fiche coach web : actions="coach") ;
   - recruteur, aperçu de l'athlète → aucune (fiche recruteur web, /athlete/profil).
   Le partenaire auteur retire les siens depuis son portail web, pas l'app. */
export type ActionsBadgePartenaire = "coach" | "partenaire" | null;

export function actionsBadgePartenaireFiche(viewer: string | null | undefined): ActionsBadgePartenaire {
  return viewer === "coach" ? "coach" : null;
}
