/* Version canonique de la politique de confidentialité — source unique.
   Écrite dans consent_audit_trail à chaque changement de consentement parent
   (Lot 1b) via set_child_consent. Bumper cette valeur quand la politique
   change matériellement. (Il n'existe pas de table de versions — surdimensionné
   pour l'usage actuel ; cette constante est la source.) */
export const PRIVACY_POLICY_VERSION = "2026-07-v1";
