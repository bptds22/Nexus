// send-invitation-carte/config.ts — constantes de l'expéditeur, relues de
// _shared/emailLayout.ts (une seule source).
//
// Expéditeur : « Nexus <info@nexussports.ca> », comme tous les courriels de
// Nexus (retour BP 2026-09-28 : « Rémi Test via Nexus » faisait amateur).
// Règle RSEQ (2026-10-16) : ni l'objet ni le corps ne nomment le recruteur,
// le cégep ou un coach collégial.
export { FROM, SUPPORT, APP_URL } from "../_shared/emailLayout.ts";
