/* ═══════════════════════════════════════════════════════════════
   Filtre « sport de l'unité » de Mon CÉGEP — logique pure (lot A).

   Décision BP 2026-09-24 (question 4) : l'admin cégep voit TOUT son cégep,
   avec un filtre par sport OUVERT PAR DÉFAUT sur son propre sport. Le sport
   est celui du RECRUTEUR (users.sport_id), pas celui de l'athlète : une
   unité = cégep × sport du recruteur.

   Valeurs du choix : un sports.id, SANS_SPORT (recruteurs du cégep qui n'ont
   pas encore de sport — ils ne sont d'aucune unité), ou TOUS.
═══════════════════════════════════════════════════════════════ */

export const TOUS = "tous";
export const SANS_SPORT = "sans-sport";

export interface MembreCegep {
  id: string;
  sport_id: string | null;
}

export interface OptionSport {
  valeur: string;
  libelle: string;
  nb: number;
}

/** Les options du menu : un sport par sport PRÉSENT chez les recruteurs du
 *  cégep (compté), puis « Sans sport » s'il y en a, puis « Tous ». Le sport
 *  de l'admin vient en tête. */
export function optionsSport(
  membres: MembreCegep[],
  nomsSports: Map<string, string>,
  monSportId: string | null,
): OptionSport[] {
  const compte = new Map<string, number>();
  let sans = 0;
  for (const m of membres) {
    if (m.sport_id) compte.set(m.sport_id, (compte.get(m.sport_id) ?? 0) + 1);
    else sans++;
  }
  const sports = [...compte.entries()]
    .map(([id, nb]) => ({ valeur: id, libelle: nomsSports.get(id) ?? "Sport inconnu", nb }))
    .sort((a, b) =>
      a.valeur === monSportId ? -1 : b.valeur === monSportId ? 1 : a.libelle.localeCompare(b.libelle, "fr"));
  const options: OptionSport[] = [...sports];
  if (sans > 0) options.push({ valeur: SANS_SPORT, libelle: "Sans sport", nb: sans });
  options.push({ valeur: TOUS, libelle: "Tous les sports", nb: membres.length });
  return options;
}

/** Le choix effectif : le choix mémorisé s'il est encore offert, sinon le
 *  sport de l'admin, sinon « Tous ». */
export function choixEffectif(
  memorise: string | null,
  options: OptionSport[],
  monSportId: string | null,
): string {
  const offerts = new Set(options.map((o) => o.valeur));
  if (memorise && offerts.has(memorise)) return memorise;
  if (monSportId && offerts.has(monSportId)) return monSportId;
  return TOUS;
}

/** Les ids retenus par le choix ; `null` = aucun filtre (Tous). */
export function idsRetenus(membres: MembreCegep[], choix: string): Set<string> | null {
  if (choix === TOUS) return null;
  return new Set(
    membres
      .filter((m) => (choix === SANS_SPORT ? m.sport_id === null : m.sport_id === choix))
      .map((m) => m.id),
  );
}

/** Le menu ne s'affiche que s'il offre un vrai choix : au moins deux groupes
 *  (deux sports, ou un sport + des recruteurs sans sport). Sinon « Tous » et
 *  l'unique groupe désignent les mêmes personnes. */
export function menuUtile(options: OptionSport[]): boolean {
  return options.filter((o) => o.valeur !== TOUS).length >= 2;
}
