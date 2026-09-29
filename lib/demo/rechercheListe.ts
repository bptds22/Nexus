/* ═══════════════════════════════════════════════════════════════
   Recherche dans une liste (cégep, sport) de /12octobre — pur, testé.

   Même règle que la recherche d'école des cartes prospect
   (CreerCarteModal) : sans accents ni casse, chaque mot tapé doit figurer
   dans le nom (normaliserNom). Tri alphabétique à la française ;
   « Autre » toujours en dernier.
═══════════════════════════════════════════════════════════════ */

import { normaliserNom } from "@/lib/cartes/carteProspect";

export interface OptionListe { id: string; nom: string }

const COLLATEUR = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
const estAutre = (o: OptionListe) => normaliserNom(o.nom) === "autre";

/** Ordre alphabétique (accents ignorés), « Autre » en dernier. */
export function trierOptions(options: OptionListe[]): OptionListe[] {
  return [...options].sort((a, b) => {
    const ea = estAutre(a), eb = estAutre(b);
    if (ea !== eb) return ea ? 1 : -1;
    return COLLATEUR.compare(a.nom, b.nom);
  });
}

/** Les options dont le nom contient chaque mot tapé ; vide → toutes.
 *  « Autre » reste proposé en dernier quoi qu'on tape : c'est la sortie. */
export function filtrerOptions(options: OptionListe[], requete: string): OptionListe[] {
  const mots = normaliserNom(requete).split(" ").filter(Boolean);
  const triees = trierOptions(options);
  if (mots.length === 0) return triees;
  return triees.filter((o) => estAutre(o) || mots.every((m) => normaliserNom(o.nom).includes(m)));
}

/** Au-delà de ce nombre d'entrées, une liste devient une recherche. */
export const SEUIL_RECHERCHE = 10;
