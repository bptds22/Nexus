/* Bandeau « Les cégeps sont maintenant sur Nexus ! » (lot C1 cégep, décision BP 2026-10-27, point 5).

   Montré SEULEMENT quand l'interrupteur lancement_collegial est ON, à un athlète qui :
     · a tapé un cégep dans « Mon école n'est pas listée » (ecole_non_listee, même détecteur que
       l'onboarding : ressembleACegep) et n'est pas encore dans une équipe de cégep ;
     · ou est ancré à un cégep (schools.type CEGEP) sans faire partie d'une équipe de ce cégep.
   Rien n'est modifié en base pour lui : le bandeau l'envoie choisir son cégep et son équipe
   (/athlete/transfert), où il confirme aussi son année de fin de cégep. */

import { ressembleACegep } from "@/lib/athlete/detecterCegep";

export const TEXTE_BANDEAU_CEGEPS =
  "Les cégeps sont maintenant sur Nexus ! Choisis ton cégep et ton équipe, et confirme ton année de fin de cégep.";

export type EtatBandeauCegeps = {
  /** Interrupteur lancement_collegial lu ON. */
  lancementCollegial: boolean;
  /** schools.type de athletes.school_id (null sans école). */
  typeEcole: string | null;
  /** L'athlète fait partie d'une équipe dont l'école est un cégep. */
  dansEquipeDeCegep: boolean;
  /** athletes.ecole_non_listee. */
  ecoleNonListee: string | null;
};

export function doitVoirBandeauCegeps(e: EtatBandeauCegeps, nomsCegeps: readonly string[] = []): boolean {
  if (!e.lancementCollegial || e.dansEquipeDeCegep) return false;
  if ((e.typeEcole ?? "").toUpperCase() === "CEGEP") return true;
  const texte = (e.ecoleNonListee ?? "").trim();
  return texte.length >= 2 && ressembleACegep(texte, nomsCegeps);
}
