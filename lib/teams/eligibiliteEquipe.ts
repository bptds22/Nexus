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

export type Tranche = "-18" | "18+";

const MOINS_18 = new Set([
  "benjamin", "cadet", "juvenile", "atome", "moustique", "pee-wee", "peewee", "bantam", "midget", "novice", "mini",
]);
const DIX_HUIT_PLUS = new Set(["senior", "junior", "junior majeur", "collegial"]);

function normaliser(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Tranche d'une catégorie d'équipe, ou null si on ne sait pas la classer. */
export function trancheCategorie(ageGroup: string | null | undefined): Tranche | null {
  if (!ageGroup) return null;
  const c = normaliser(ageGroup);
  // U14, U-17, M15, M18 AAA, « U17 (juvénile) » : le nombre décide (moins de 19 = moins de 18 ans)
  const m = c.match(/^[um]-?\s?(\d{1,2})\b/);
  if (m) return Number(m[1]) <= 18 ? "-18" : "18+";
  const premier = c.replace(/\s+(aaa|aa|a|d\d)$/, "");
  if (DIX_HUIT_PLUS.has(premier) || DIX_HUIT_PLUS.has(c)) return "18+";
  if (MOINS_18.has(premier) || MOINS_18.has(premier.split(" ")[0])) return "-18";
  return null;
}

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
