/* ═══════════════════════════════════════════════════════════════
   csv — construction d'un CSV qu'Excel en FRANÇAIS ouvre directement
   (lot B, export du pipeline recruteur — décision BP 2026-09-24).

   · UTF-8 avec BOM : sans lui, Excel lit le fichier en ANSI et les accents
     sortent en « Ã© ».
   · Séparateur « ; » : Excel FR attend le point-virgule (la virgule y est
     le séparateur décimal).
   · Fin de ligne CRLF.
   · Une case contenant « ; », un guillemet ou un retour à la ligne est
     entourée de guillemets, et ses guillemets sont doublés (RFC 4180).
     Un retour à la ligne DANS une case est permis : Excel l'affiche comme
     une case sur plusieurs lignes (note de suivi rassemblée).
   · INJECTION DE FORMULE : une case qui commence par = + - @ (ou tabulation,
     retour chariot) serait EXÉCUTÉE par Excel à l'ouverture. Les noms
     d'athlètes et les notes sont saisis par des tiers : on préfixe par une
     apostrophe, qu'Excel masque à l'affichage.

   Pur, sans dépendance au navigateur : le téléchargement vit chez l'appelant.
═══════════════════════════════════════════════════════════════ */

export type ValeurCsv = string | number | null | undefined;

const DEBUT_DE_FORMULE = /^[=+\-@\t\r]/;

/** Une case, prête à écrire. `null` / `undefined` → case vide. */
export function caseCsv(valeur: ValeurCsv): string {
  if (valeur === null || valeur === undefined) return "";
  let texte = String(valeur);
  // Un NOMBRE négatif légitime n'est pas une formule ; seules les chaînes
  // saisies par des tiers sont neutralisées.
  if (typeof valeur === "string" && DEBUT_DE_FORMULE.test(texte)) texte = `'${texte}`;
  return /[";\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/** Le fichier complet : BOM + en-têtes + lignes, séparateur « ; », CRLF. */
export function construireCsv(entetes: string[], lignes: ValeurCsv[][]): string {
  const rangees = [entetes, ...lignes].map((r) => r.map(caseCsv).join(";"));
  return "﻿" + rangees.join("\r\n") + "\r\n";
}

/** Nombre décimal à la française (4,5), pour qu'Excel FR le lise comme un
 *  nombre et non comme du texte. */
export function decimalFr(n: number, decimales = 1): string {
  return n.toFixed(decimales).replace(".", ",");
}
