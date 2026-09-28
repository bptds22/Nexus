// send-invitation-carte/config.ts — constantes de l'expéditeur, relues de
// _shared/emailLayout.ts (une seule source).
import { FROM, SUPPORT, APP_URL } from "../_shared/emailLayout.ts";

/** L'adresse nue de FROM (« Nexus <info@…> » → « info@… ») : le nom
 *  d'affichage de l'invitation est celui du recruteur. */
export const FROM_ADRESSE_NU = FROM.replace(/^.*<([^>]+)>.*$/, "$1");
export { SUPPORT, APP_URL };
