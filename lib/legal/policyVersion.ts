/* Version canonique de la politique de confidentialité — source unique.
   Écrite dans consent_audit_trail à chaque changement de consentement parent
   (Lot 1b) via set_child_consent. Bumper cette valeur quand la politique
   change matériellement. (Il n'existe pas de table de versions — surdimensionné
   pour l'usage actuel ; cette constante est la source.) */
// 2026-10-v2 (BP 2026-10-19) : le consentement partenaires couvre aussi les VIDÉOS et les
// RÉSEAUX SOCIAUX. La base (consentement_partenaire_politiques_v2) reconnaît cette valeur :
// tout accord partenaires journalisé avec elle vaut v2. Ne pas la changer sans y ajouter
// la nouvelle valeur côté base.
export const PRIVACY_POLICY_VERSION = "2026-10-v2";

/** Accord partenaires donné sur une surface qui ne montre QUE la carte (évaluation de
 *  partenaire à recevoir, notification, lien courriel du parent, reprise d'une inscription
 *  commencée avant la v2). Journalisé tel quel : la base ne le compte PAS comme v2, le
 *  partenaire voit la carte mais ni les vidéos ni les réseaux. La v2 se donne sur la carte
 *  plein écran, dans les paramètres ou à l'inscription — là où son texte est affiché. */
export const POLITIQUE_CARTE_SEULE = `${PRIVACY_POLICY_VERSION}+carte`;

/** Libellé de date affiché à côté de la version sur la politique publiée
 *  (app/confidentialite/page.tsx). Bumper avec PRIVACY_POLICY_VERSION. */
export const PRIVACY_POLICY_DATE_LABEL = "Octobre 2026";
