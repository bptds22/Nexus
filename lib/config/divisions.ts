/**
 * Divisions (niveaux de jeu) — ORDRE CANONIQUE UNIQUE (chantier civil, lot 7, 2026-10-27).
 *
 * Même rôle que `lib/config/categories.ts` pour les catégories : l'ordre dans lequel une division
 * s'affiche dans un filtre ou départage deux équipes. Avant, les divisions se rangeaient par
 * ordre alphabétique : « Local A » passait devant « PLSJQ », « Régional AA » derrière « LDIR ».
 *
 * Règles :
 *   · du niveau le plus haut au plus bas, groupe par groupe : soccer (Soccer Québec), basket,
 *     calibres civils, divisions numérotées, divisions nommées NLS ;
 *   · « D1 » et « Division 1 » sont la même division (même écriture que libelleDivision) ;
 *   · rien n'est réécrit en base ; une valeur inconnue reste affichée telle quelle, rangée après
 *     les connues (ordre alphabétique) ;
 *   · la liste de SAISIE du formulaire d'équipe reste `civilVocab.ts` (avec « Autre »).
 */

export const DIVISIONS_CANONIQUES: readonly string[] = [
  // Soccer Québec : provincial (PLSJQ, Ligues 1 à 3 QC), Espoirs, puis LDP, LDIR, régional, local.
  "PLSJQ",
  "Ligue 1 QC",
  "Ligue 2 QC",
  "Ligue 3 QC",
  "Espoirs",
  "LDP",
  "LDIR",
  "Régional AA",
  "Local A",
  // Basket (Circuit Élite, MBL).
  "Élite",
  "Majeur",
  // Calibres civils.
  "AAA",
  "AA",
  "A",
  "BB",
  "B",
  "CC",
  "C",
  // Divisions numérotées (RSEQ, ligues civiles).
  "Division 1",
  "Division 2",
  "Division 3",
  "Division 4",
  "Division 5",
  // Divisions nommées NLS.
  "Diamond",
  "Gold",
];

/** Clé de comparaison : casse, accents et espaces ignorés ; « D1 » → « division 1 ». */
function cle(v: string): string {
  const s = v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const d = /^d\s*(\d+)$/.exec(s);
  return d ? `division ${d[1]}` : s;
}

const RANG = new Map<string, number>(DIVISIONS_CANONIQUES.map((d, i) => [cle(d), i]));

/** Compare deux divisions brutes dans l'ordre canonique ; vides en dernier ; inconnues après les
 *  connues, par ordre alphabétique. */
export function comparerDivisions(a: string | null | undefined, b: string | null | undefined): number {
  const va = (a ?? "").trim();
  const vb = (b ?? "").trim();
  if (!va || !vb) return (va ? 0 : 1) - (vb ? 0 : 1);
  const ra = RANG.get(cle(va));
  const rb = RANG.get(cle(vb));
  if (ra !== undefined && rb !== undefined) return ra - rb;
  if (ra !== undefined) return -1;
  if (rb !== undefined) return 1;
  return va.localeCompare(vb, "fr", { numeric: true });
}

/** Valeurs distinctes non vides, dans l'ordre canonique. */
export function divisionsTriees(bruts: readonly (string | null | undefined)[]): string[] {
  const vues = new Set<string>();
  for (const b of bruts) {
    const v = (b ?? "").trim();
    if (v) vues.add(v);
  }
  return [...vues].sort(comparerDivisions);
}
