/* Recherche d'école / de cégep / de club par nom ou ville (lot C1 cégep, retour de test BP 2026-10-27).

   La recherche par sous-chaîne d'avant était trop rigide : « st-j » ne trouvait pas « Cégep de
   Saint-Jérôme », « cegep st » ne trouvait rien. Ici :
     · accents et majuscules ignorés (jerome = Jérôme) ;
     · St / St. ⇔ Saint, Ste / Ste. ⇔ Sainte, dans les deux sens (le nom ET la saisie sont ramenés à
       la forme longue) ;
     · tirets, apostrophes, points et espaces équivalents (st-j = st j = st.j) ;
     · mot par mot : chaque mot tapé doit se trouver dans le nom ou la ville, dans n'importe quel ordre,
       avec n'importe quels mots entre ; un mot tapé est le DÉBUT d'un mot du nom (« j » → Jérôme), ou,
       à partir de 4 lettres, n'importe où dans un mot (« rochebelle » dans « De Rochebelle ») ;
     · les petits mots (de, du, la, le, les, des, d', l') sont ignorés, dans la saisie comme dans le nom.

   Une seule implémentation pour le web (components/ui/SchoolSelect.tsx). Les copies MOBILES
   (AthleteOnboardingMobile, AthleteWizardMobile, CoachOnboardingMobileSchool, feuille de
   MonEquipeSection) filtrent encore par sous-chaîne : à brancher ici dans la 1.4.6. */

const PETITS_MOTS = new Set(["de", "du", "la", "le", "les", "des", "d", "l", "et"]);
const ABREVIATIONS: Record<string, string> = { st: "saint", ste: "sainte" };

/** Mots normalisés d'un texte : minuscules, sans accents, abréviations développées, petits mots retirés. */
export function motsRecherche(texte: string | null | undefined): string[] {
  return (texte ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['‘’`´.\-–—_/,()]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((m) => ABREVIATIONS[m] ?? m)
    .filter((m) => !PETITS_MOTS.has(m));
}

function motCorrespond(tape: string, mot: string): boolean {
  return mot.startsWith(tape) || (tape.length >= 4 && mot.includes(tape));
}

export type Cherchable = { name: string; city?: string | null };

/** Rang d'un établissement pour une saisie : null = ne correspond pas ; plus petit = meilleur.
 *  0 = tous les mots dans le NOM ; 1 = il a fallu la ville. */
export function rangRecherche(e: Cherchable, saisie: string): number | null {
  const tapes = motsRecherche(saisie);
  if (tapes.length === 0) return 0;
  const nom = motsRecherche(e.name);
  const ville = motsRecherche(e.city);
  let parVille = false;
  for (const t of tapes) {
    if (nom.some((m) => motCorrespond(t, m))) continue;
    if (ville.some((m) => motCorrespond(t, m))) { parVille = true; continue; }
    return null;
  }
  return parVille ? 1 : 0;
}

/** Filtre et range une liste : correspondances par le nom d'abord, puis par la ville ; l'ordre de la
 *  liste d'origine départage. Saisie vide → la liste telle quelle. */
export function rechercherEcoles<T extends Cherchable>(liste: readonly T[], saisie: string, max = Infinity): T[] {
  if (motsRecherche(saisie).length === 0) return liste.slice(0, max);
  const trouves: { e: T; r: number; i: number }[] = [];
  liste.forEach((e, i) => {
    const r = rangRecherche(e, saisie);
    if (r !== null) trouves.push({ e, r, i });
  });
  trouves.sort((a, b) => a.r - b.r || a.i - b.i);
  return trouves.slice(0, max).map((t) => t.e);
}
