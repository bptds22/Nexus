/* Éligibilité d'une équipe dans le sélecteur de l'athlète — âge et saison (lot 7 civil, décision BP 2026-10-26).

   Décisions BP :
     · une équipe de moins de 18 ans (U14-U18, Benjamin / Cadet / Juvénile…) n'est proposée qu'à un
       athlète de moins de 18 ans ; une équipe de 18 ans et plus (Senior, U19, U21, Junior…) qu'à un
       athlète de 18 ans et plus ;
     · seules les équipes de la saison en cours (ou d'une saison à venir) sont proposées.

   Une catégorie inconnue ou un âge inconnu ne filtre RIEN : on ne cache jamais une équipe faute
   de savoir la classer. Le filtre trie ce qu'on PROPOSE ; il n'interdit aucun rattachement (la base
   n'en sait rien et les gardes Loi 25 restent celles de _apply_team_attachment_core). */

import { saisonCourante } from "@/lib/queries/schoolPage/saisonEnCours";
import { trancheCategorie, type Tranche } from "@/lib/config/categories";

// La tranche vit dans la liste canonique des catégories (décision BP 2026-10-27, point 5).
export { trancheCategorie, type Tranche };

/** Âge révolu à la date de référence, ou null si la date de naissance est absente ou illisible. */
export function ageRevolu(dateNaissance: string | null | undefined, ref: Date = new Date()): number | null {
  if (!dateNaissance) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateNaissance);
  if (!m) return null;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = ref.getFullYear() - a;
  if (ref.getMonth() + 1 < mo || (ref.getMonth() + 1 === mo && ref.getDate() < j)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

export interface EquipeFiltrable {
  age_group?: string | null;
  season?: string | null;
}

/** L'équipe peut-elle être PROPOSÉE à cet athlète ? */
export function equipeProposable(
  t: EquipeFiltrable, age: number | null, saison: string = saisonCourante(),
): boolean {
  if (t.season && t.season < saison) return false;          // saisons passées : jamais proposées
  if (age === null) return true;
  const tranche = trancheCategorie(t.age_group);
  if (tranche === null) return true;
  return age < 18 ? tranche === "-18" : tranche === "18+";
}
