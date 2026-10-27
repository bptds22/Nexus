/**
 * Catégories d'âge — LISTE CANONIQUE UNIQUE (chantier cégep, lot B4, décision BP 2026-10-26).
 *
 * Source unique de l'axe « Catégorie » de TOUS les filtres et de l'ordre dans lequel les
 * catégories s'affichent : recherche coach, recherche recruteur, recherche / classements /
 * tendances partenaire, calendrier recruteur, carte des matchs. La valeur vient de
 * `teams.age_group` (athlètes, via son équipe) ou de `games.category` (matchs) ; les deux
 * vocabulaires passent par ici.
 *
 * ⚠ CHANTIER CIVIL (lot 7 et suivants) : réutiliser CE module. Ne pas créer de deuxième liste,
 * ni dans `civilVocab.ts` (qui reste la liste de SAISIE du formulaire d'équipe, avec « Autre »),
 * ni ailleurs. Une nouvelle catégorie s'ajoute ICI, à sa place dans l'ordre par âge.
 *
 * Règles :
 *   · rangée par âge, groupe par groupe : secondaire, civil, soccer civil, Ouvert, Collégial ;
 *   · AUCUN regroupement : « Midget », « Midget AAA » et « M18 AAA » restent trois catégories,
 *     comme « M18 » (secondaire) et « M18 AAA » (civil). Seules les variantes d'ÉCRITURE d'une
 *     même catégorie se rejoignent (casse, espaces, accents ; « cegep » s'affiche « Collégial ») ;
 *   · rien n'est réécrit en base : la correspondance se fait à la lecture ;
 *   · une valeur inconnue de la liste reste affichée telle quelle, rangée après les connues
 *     (ordre alphabétique) : elle ne disparaît jamais d'un filtre.
 */

/** La liste, dans l'ordre d'affichage. */
export const CATEGORIES_CANONIQUES: readonly string[] = [
  // Secondaire (RSEQ), du plus jeune au plus vieux, puis les catégories par âge maximal.
  "Moustique",
  "Atome",
  "Benjamin",
  "Cadet",
  "Juvénile",
  "M14",
  "M15",
  "M18",
  // Civil (hockey, football), du plus jeune au plus vieux.
  "Moustique AAA",
  "Pee-Wee AAA",
  "Bantam AAA",
  "M18 AAA",
  "Midget",
  "Midget AAA",
  "Junior Majeur",
  // Soccer civil.
  "U9",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
  "U19",
  "U21",
  "Senior",
  // Sans âge, puis le collégial.
  "Ouvert",
  "Collégial",
];

/** Clé de comparaison : casse, accents et espaces ignorés. */
function cle(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Variantes d'écriture connues qui ne se déduisent pas de la clé (pas des regroupements). */
const ALIAS: Record<string, string> = {
  cegep: "Collégial",
};

const PAR_CLE = new Map<string, string>(CATEGORIES_CANONIQUES.map((c) => [cle(c), c]));
const RANG = new Map<string, number>(CATEGORIES_CANONIQUES.map((c, i) => [c, i]));

/** Libellé affiché d'une catégorie brute (`teams.age_group`, `games.category`).
 *  Vide ou absente → null (« Non renseigné » pour l'appelant). Inconnue → telle quelle, nettoyée. */
export function libelleCategorie(brut: string | null | undefined): string | null {
  if (brut == null) return null;
  const propre = brut.replace(/\s+/g, " ").trim();
  if (!propre) return null;
  const k = cle(propre);
  return ALIAS[k] ?? PAR_CLE.get(k) ?? propre;
}

/** Compare deux libellés (déjà passés par `libelleCategorie`) dans l'ordre canonique ;
 *  les inconnus après les connus, par ordre alphabétique. */
export function comparerCategories(a: string, b: string): number {
  const ra = RANG.get(a);
  const rb = RANG.get(b);
  if (ra !== undefined && rb !== undefined) return ra - rb;
  if (ra !== undefined) return -1;
  if (rb !== undefined) return 1;
  return a.localeCompare(b, "fr", { numeric: true });
}

/** Libellés distincts d'une liste de valeurs brutes, dans l'ordre canonique. */
export function categoriesTriees(bruts: readonly (string | null | undefined)[]): string[] {
  const vus = new Set<string>();
  for (const b of bruts) {
    const l = libelleCategorie(b);
    if (l) vus.add(l);
  }
  return [...vus].sort(comparerCategories);
}

/** Valeurs BRUTES qui s'affichent sous ce libellé : le libellé lui-même et ses variantes connues
 *  (« cegep » pour « Collégial »). Pour un filtre côté serveur (`.in(colonne, …)`). */
export function variantesCategorie(libelle: string): string[] {
  const k = cle(libelle);
  const canon = PAR_CLE.get(k) ?? libelle;
  return [canon, ...Object.entries(ALIAS).filter(([, v]) => v === canon).map(([a]) => a)];
}

/** Une valeur brute correspond-elle au libellé choisi (`""` = pas de filtre) ? */
export function correspondCategorie(brut: string | null | undefined, choisi: string): boolean {
  if (!choisi) return true;
  return libelleCategorie(brut) === choisi;
}
