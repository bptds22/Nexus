/* ═══════════════════════════════════════════════════════════════
   journalFiltres — la partie PURE de la télémétrie des filtres : quels
   changements méritent une ligne dans `search_filter_events`, et sous quelle
   valeur. Sans React ni Supabase, pour être testable seule
   (`__tests__/journalFiltres.test.ts`). Le hook `useJournalFiltres` ne fait
   que l'appeler, différer et écrire. Les règles sont documentées là-bas.
═══════════════════════════════════════════════════════════════ */

export type ValeurFiltre = string | boolean | readonly string[];

/* Mappé plutôt que `Record<string, …>` : une INTERFACE (FiltresRecherche)
   n'a pas de signature d'index implicite et ne satisferait pas un Record. */
export type JeuDeFiltres<F> = { [K in keyof F]: ValeurFiltre };

/** Miroir du CHECK `char_length(valeur) <= 80` de la table. */
export const LONGUEUR_MAX_VALEUR = 80;

export function valeursEgales(a: ValeurFiltre | undefined, b: ValeurFiltre | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

/** Sérialise une valeur. `null` = rien à journaliser. */
export function serialiserValeur(cle: string, avant: ValeurFiltre, apres: ValeurFiltre): string | null {
  if (cle === "search") {
    // Seule la transition vide → rempli compte, et le texte ne part jamais.
    return String(avant).trim() === "" && String(apres).trim() !== "" ? "on" : null;
  }
  if (Array.isArray(apres)) return String(apres.length);
  if (typeof apres === "boolean") return apres ? "on" : "off";
  return String(apres).slice(0, LONGUEUR_MAX_VALEUR);
}

/**
 * Les changements `avant → apres` à journaliser, en paires [clé, valeur].
 * Un retour au défaut n'en produit aucun (purges automatiques, reset).
 * `defauts` peut porter plus de clés que les filtres : seules celles des
 * filtres sont lues.
 */
export function changementsAJournaliser<F extends JeuDeFiltres<F>>(
  avant: F,
  apres: F,
  defauts: JeuDeFiltres<F>,
): [string, string][] {
  const sortie: [string, string][] = [];
  for (const cle of Object.keys(apres) as (keyof F & string)[]) {
    const a = avant[cle];
    const b = apres[cle];
    if (valeursEgales(a, b) || valeursEgales(b, defauts[cle])) continue;
    const valeur = serialiserValeur(cle, a, b);
    if (valeur !== null) sortie.push([cle, valeur]);
  }
  return sortie;
}
